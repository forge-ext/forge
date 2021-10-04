/*
 * This file is part of the Forge extension for GNOME
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

'use strict';

// Gnome imports
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

// Gnome Shell imports
const DND = imports.ui.dnd;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Logger = Me.imports.logger;
const Tree = Me.imports.tree;
const Utils = Me.imports.utils;

var WINDOW_MODES = Utils.createEnum([
    'FLOAT',
    'TILE',
    'DEFAULT'
]);

// Simplify the grab modes
var GRAB_TYPES = Utils.createEnum([
    "RESIZING",
    "MOVING",
    "UNKNOWN"
]);

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init(ext) {
            super._init();
            this.ext = ext;
            this._tree = new Tree.Tree(this);
            this.eventQueue = new Tree.Queue();
            Logger.info("forge initialized");
        }

        // TODO move this to a new module to handle floating?
        _applyNodeWindowMode(action, metaWindow) {
            let nodeWindow = this.findNodeWindow(metaWindow);
            if (!nodeWindow || !(action || action.mode)) return;
            if (nodeWindow.nodeType !== Tree.NODE_TYPES.WINDOW) return;
            action.mode = action.mode.toUpperCase();

            let floatFlag = action.mode === WINDOW_MODES.FLOAT;

            if (floatFlag) {
                let floating = nodeWindow.mode === WINDOW_MODES.FLOAT;
                if (!floating) {
                    nodeWindow.mode = WINDOW_MODES.FLOAT;
                } else {
                    nodeWindow.mode = WINDOW_MODES.TILE;
                }
            } else {
                nodeWindow.mode = WINDOW_MODES.TILE;
            }
        }

        queueEvent(eventObj) {
            Logger.trace(`queuing event ${eventObj.name}`);
            this.eventQueue.enqueue(eventObj);

            if (!this._queueSourceId) {
                this._queueSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
                    const currEventObj = this.eventQueue.dequeue();
                    if (currEventObj) {
                        currEventObj.callback();
                        Logger.trace(`firing callback ${currEventObj.name}!`);
                    }
                    const result = this.eventQueue.length !== 0;
                    if (!result) {
                        Logger.trace(`queue-event done: removing ${this._queueSourceId}`);
                        this._queueSourceId = 0;
                    }
                    return result;
                });
            }
        }

        /**
         * This is the central place to bind all the non-window signals.
         */
        _bindSignals() {
            if (this._signalsBound)
                return;

            const display = global.display;
            const shellWm = global.window_manager;

            this._displaySignals = [
                display.connect("window-created", this.trackWindow.bind(this)),
                display.connect("window-entered-monitor", (_, monitor, metaWindow) => {
                    this.updateMetaWorkspaceMonitor("window-entered-monitor", monitor, metaWindow);
                }),
                display.connect("window-left-monitor", () => {
                    Logger.debug("window-left-monitor");
                }),
                display.connect("grab-op-end", (_, _display, _metaWindow, grabOp) => {
                    this.unfreezeRender();
                    let focusWindow = this.focusMetaWindow;
                    if (!focusWindow) return;
                    let focusNodeWindow = this.findNodeWindow(focusWindow);
                    if (grabOp === Meta.GrabOp.WINDOW_BASE) {
                        if (focusNodeWindow.parentNode.layout !== Tree.LAYOUT_TYPES.STACKED) {
                            // handle window swapping
                            let pointerCoord = global.get_pointer();
                            Logger.trace(`grab-end:pointer x:${pointerCoord[0]}, y:${pointerCoord[1]} `);
                            let nodeWinAtPointer = this._tree.findNodeWindowAtPointer(
                                this.focusMetaWindow, pointerCoord);
                            Logger.debug(`node at pointer ${nodeWinAtPointer}`);
                            if (nodeWinAtPointer) {
                                this._tree.swapPairs(focusNodeWindow, nodeWinAtPointer);
                            }
                        } else {
                            focusNodeWindow.parentNode.appendChild(focusNodeWindow);
                            focusNodeWindow.nodeValue.raise();
                            focusNodeWindow.nodeValue.activate(global.display.get_current_time());
                        }
                    }

                    if (focusWindow.get_maximized() === 0) {
                        this.renderTree("grab-op-end");
                    }

                    if (focusNodeWindow) {
                        focusNodeWindow.initRect = null;
                    }
                    Logger.debug(`grab op end`);
                }),
                display.connect("grab-op-begin", (_, _display, _metaWindow, grabOp) => {
                    this.freezeRender();
                    let orientation = Utils.orientationFromGrab(grabOp);
                    let direction = Utils.directionFromGrab(grabOp);
                    let focusWindow = this.focusMetaWindow;
                    if (focusWindow) {
                        let focusNodeWindow = this.findNodeWindow(focusWindow);
                        let resizing = Utils.grabMode(grabOp) === GRAB_TYPES.RESIZING;
                        Logger.debug(`grabOp ${grabOp}`);
                        if (resizing) {
                            focusNodeWindow.grabMode = GRAB_TYPES.RESIZING;
                            focusNodeWindow.initGrabOp = grabOp;
                            focusNodeWindow.initRect = Utils.removeGapOnRect(
                                focusWindow.get_frame_rect(),
                                this.calculateGaps(focusWindow));
                        }
                    }
                    Logger.debug(`grab op begin ${grabOp}, orientation ${orientation}, direction ${direction}`);
                }),
                display.connect("showing-desktop-changed", () => {
                    Logger.debug(`display:showing-desktop-changed`);
                }),
                display.connect("workareas-changed", (_display) => {
                    if (this._tree.getNodeByType("WINDOW").length > 0) {
                        this.reloadTree("workareas-changed");
                    }
                    Logger.debug(`workareas-changed`);
                }),
            ];

            this._windowManagerSignals = [
                shellWm.connect("minimize", () => {
                    this.hideWindowBorders();
                    let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
                    if (focusNodeWindow) {
                        if (this._tree.getTiledChildren(focusNodeWindow.parentNode.childNodes).length === 0) {
                            this._tree.resetSiblingPercent(focusNodeWindow.parentNode.parentNode);
                        }
                        this._tree.resetSiblingPercent(focusNodeWindow.parentNode);
                    }
                    this.renderTree("minimize");
                    Logger.debug(`minimized ${this.focusMetaWindow.title}`);
                }),
                shellWm.connect("unminimize", () => {
                    let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
                    if (focusNodeWindow) {
                        this._tree.resetSiblingPercent(focusNodeWindow.parentNode);
                    }
                    this.renderTree("unminimize");
                    Logger.debug(`unminimize`);
                }),
                shellWm.connect("show-tile-preview", (_, _metaWindow, _rect, _num) => {
                    Logger.debug(`show-tile-preview`);
                }),
            ];

            const globalWsm = global.workspace_manager;

            this._workspaceManagerSignals = [
                globalWsm.connect("showing-desktop-changed", () => {
                    this.hideWindowBorders();
                    Logger.debug(`workspace:showing-desktop-changed`);
                }),
                globalWsm.connect("workspace-added", (_, wsIndex) => {
                    let added = this._tree.addWorkspace(wsIndex);
                    Logger.debug(`${added ? "workspace-added" : "workspace-add-skipped"} ${wsIndex}`);
                    this.renderTree("workspace-added");
                }),
                globalWsm.connect("workspace-removed", (_, wsIndex) => {
                    let removed = this._tree.removeWorkspace(wsIndex);
                    Logger.debug(`${removed ? "workspace-removed" : "workspace-remove-skipped"} ${wsIndex}`);
                    if (!this._wsRemoveSrcId) {
                        this._wsRemoveSrcId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
                            this.renderTree("workspace-removed");
                            this._wsRemoveSrcId = 0;
                            return false;
                        });
                    }
                }),
                globalWsm.connect("workspace-switched", (_, _wsIndex) => {
                    this.hideWindowBorders();
                    if (!this._wsSwitchedSrcId) {
                        this._wsSwitchedSrcId = GLib.timeout_add(GLib.PRIORITY_LOW, 450, () => {
                            this.showBorderFocusWindow();
                            this._wsSwitchedSrcId = 0;
                            return false;
                        });
                    }
                    this.ext.indicator.updateTileIcon();
                    this.renderTree("workspace-switched");
                }),
            ];

            let numberOfWorkspaces = globalWsm.get_n_workspaces();

            for (let i = 0; i < numberOfWorkspaces; i++) {
                let workspace = globalWsm.get_workspace_by_index(i);
                this.bindWorkspaceSignals(workspace);
            }

            let settings = this.ext.settings;

            settings.connect("changed", (_, settingName) => {
                switch (settingName) {
                    case "focus-border-toggle":
                        this.showBorderFocusWindow();
                        break;
                    case "tiling-mode-enabled":
                        this.renderTree(settingName);
                        this.showBorderFocusWindow();
                        break;
                    case "window-gap-size-increment":
                    case "window-gap-size":
                    case "window-gap-hidden-on-single":
                    case "workspace-skip-tile":
                        this.renderTree(settingName);
                        break;
                    case "stacked-tiling-mode-enabled":
                        if (!settings.get_boolean(settingName)) {
                            let stackedNodes = this._tree.getNodeByLayout(Tree.LAYOUT_TYPES.STACKED);
                            stackedNodes.forEach((node) => {
                                node.prevLayout = node.layout;
                                node.layout = this.determineSplitLayout();
                            });
                        } else {
                            let hSplitNodes = this._tree.getNodeByLayout(Tree.LAYOUT_TYPES.HSPLIT);
                            let vSplitNodes = this._tree.getNodeByLayout(Tree.LAYOUT_TYPES.VSPLIT);
                            Array.prototype.push.apply(hSplitNodes, vSplitNodes);
                            hSplitNodes.forEach((node) => {
                                if (node.prevLayout && node.prevLayout === Tree.LAYOUT_TYPES.STACKED) {
                                    node.layout = Tree.LAYOUT_TYPES.STACKED;
                                }
                            });
                        }
                        this.renderTree(settingName);
                        break;
                    default:
                        break;
                }
            });

            this._signalsBound = true;
        }

        // TODO move this to workspace.js
        bindWorkspaceSignals(metaWorkspace) {
            if (metaWorkspace) {
                if (!metaWorkspace.workspaceSignals) {
                    let workspaceSignals = [
                        metaWorkspace.connect("window-added", (_, metaWindow) => {
                            if (!this._wsWindowAddSrcId) {
                                this._wsWindowAddSrcId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                                    this.updateMetaWorkspaceMonitor("window-added", metaWindow.get_monitor(), metaWindow);
                                    this._wsWindowAddSrcId = 0;
                                    return false;
                                });
                            }
                        }),
                    ];
                    metaWorkspace.workspaceSignals = workspaceSignals;
                }
            }
        }

        // TODO move this in command.js
        command(action) {
            let focusWindow = this.focusMetaWindow;
            let focusNodeWindow = this.findNodeWindow(focusWindow);
            let currentLayout = focusNodeWindow.parentNode.layout;

            switch(action.name) {
                case "MoveResize":
                    // TODO validate the parameters for MoveResize
                    
                    this._applyNodeWindowMode(action, focusWindow)

                    let moveRect = {
                        x: Utils.resolveX(action, focusWindow),
                        y: Utils.resolveY(action, focusWindow),
                        width: Utils.resolveWidth(action, focusWindow),
                        height: Utils.resolveHeight(action, focusWindow),
                    };
                    this.move(focusWindow, moveRect);
                    // TODO move to Tree
                    let existParent = focusNodeWindow.parentNode;
                    if (this._tree.getTiledChildren(existParent.childNodes).length <= 1) {
                        existParent.percent = 0.0;
                        this._tree.resetSiblingPercent(existParent.parentNode);
                    }
                    this._tree.resetSiblingPercent(existParent);
                    this.renderTree("move-resize");
                    break;
                case "Move":
                    this.unfreezeRender();
                    let moveDirection = Utils.resolveDirection(action.direction);
                    let moved = this._tree.move(focusNodeWindow, moveDirection);
                    if (moved)
                        this.renderTree("move-window");
                    this.showBorderFocusWindow();
                    break;
                case "Focus":
                    this.freezeRender();
                    let focusDirection = Utils.resolveDirection(action.direction);
                    focusNodeWindow = this._tree.focus(focusNodeWindow, focusDirection);
                    if (!focusNodeWindow) {
                        focusNodeWindow = this.findNodeWindow(this.focusMetaWindow);
                    }
                    this.queueEvent({name: "focus", callback: () => {
                        if (this.eventQueue.length <= 0) {
                            Logger.info("focus queue is last, unfreezing render");
                            this.unfreezeRender();
                            if (focusNodeWindow.parentNode.layout === Tree.LAYOUT_TYPES.STACKED) {
                                focusNodeWindow.parentNode.appendChild(focusNodeWindow);
                                focusNodeWindow.nodeValue.raise();
                                focusNodeWindow.nodeValue.activate(global.display.get_current_time());
                                this.renderTree("focus-stacked-queue");
                            }
                        }
                    }})
                    break;
                case "Swap":
                    this.unfreezeRender();
                    let swapDirection = Utils.resolveDirection(action.direction);
                    let nextSwap = this._tree.swap(focusNodeWindow, swapDirection);
                    if (nextSwap && nextSwap.nodeType === Tree.NODE_TYPES.WINDOW) {
                        nextSwap.nodeValue.raise();
                    }
                    focusNodeWindow.nodeValue.activate(global.display.get_current_time());
                    this.renderTree("swap");
                    break;
                case "Split":
                    if (focusNodeWindow.parentNode.layout === Tree.LAYOUT_TYPES.STACKED) {
                        Logger.warn(`split not allowed on ${focusNodeWindow.parentNode.layout}`);
                        return;
                    }
                    let orientation = action.orientation ? action.orientation.
                        toUpperCase() : Tree.ORIENTATION_TYPES.NONE;
                    this._tree.split(focusNodeWindow, orientation);
                    this.renderTree("split");
                    this.showBorderFocusWindow();
                    break;
                case "LayoutToggle":
                    if (currentLayout === Tree.LAYOUT_TYPES.HSPLIT) {
                        focusNodeWindow.parentNode.layout = Tree.LAYOUT_TYPES.VSPLIT;
                    } else if (currentLayout === Tree.LAYOUT_TYPES.VSPLIT) {
                        focusNodeWindow.parentNode.layout = Tree.LAYOUT_TYPES.HSPLIT;
                    }
                    this._tree.attachNode = focusNodeWindow.parentNode;
                    this.renderTree("layout-split-toggle");
                    this.showBorderFocusWindow();
                    break;
                case "FocusBorderToggle":
                    let focusBorderEnabled = this.ext.settings.get_boolean("focus-border-toggle");
                    this.ext.settings.set_boolean("focus-border-toggle", !focusBorderEnabled);
                    break;
                case "TilingModeToggle":
                    let tilingModeEnabled = this.ext.settings.get_boolean("tiling-mode-enabled");
                    this.ext.settings.set_boolean("tiling-mode-enabled", !tilingModeEnabled);
                    break;
                case "GapSize":
                    let gapIncrement = this.ext.settings.get_uint("window-gap-size-increment");
                    let amount = action.amount;
                    gapIncrement = gapIncrement + amount;
                    if (gapIncrement < 0)
                        gapIncrement = 0;
                    if (gapIncrement > 5)
                        gapIncrement = 5;
                    this.ext.settings.set_uint("window-gap-size-increment", gapIncrement);
                    break;
                case "WorkspaceActiveTileToggle":
                    let activeWorkspace = global.workspace_manager.get_active_workspace_index();
                    let skippedWorkspaces = this.ext.settings.get_string("workspace-skip-tile");
                    let workspaceSkipped = false;
                    let skippedArr = [];
                    if (skippedWorkspaces.length === 0) {
                        skippedArr.push(`${activeWorkspace}`);
                    } else {
                        skippedArr = skippedWorkspaces.split(",");
                        Logger.debug(`Current workspace ${activeWorkspace}. List of skipped ${skippedWorkspaces}`);

                        for (let i = 0; i < skippedArr.length; i++) {
                            if (skippedArr[i] === `${activeWorkspace}`) {
                                workspaceSkipped = true;
                                break;
                            }
                        }
                        if (workspaceSkipped) {
                            Logger.debug(`workspace is skipped, removing ${activeWorkspace}`);
                            let indexWs = skippedArr.indexOf(`${activeWorkspace}`);
                            skippedArr.splice(indexWs, 1);
                        } else {
                            Logger.debug(`workspace is not skipped, inserting ${activeWorkspace}`);
                            skippedArr.push(`${activeWorkspace}`);
                        }
                    }

                    Logger.debug(`Updated workspace skipped ${skippedArr.toString()}`);
                    this.ext.settings.set_string("workspace-skip-tile", skippedArr.toString());

                    break;
                case "LayoutStackedToggle":
                    if (!this.ext.settings.get_boolean("stacked-tiling-mode-enabled"))
                        return;

                    // TODO for now do not allow multiple levels of stacked tiles
                    let childWindowNodes = [];
                    focusNodeWindow.parentNode.childNodes.forEach((node) => {
                        Array.prototype.push.apply(childWindowNodes, node.getNodeByLayout(Tree.LAYOUT_TYPES.STACKED));
                    });
                    if (focusNodeWindow.parentNode.nodeType === Tree.NODE_TYPES.MONITOR) {
                        if (childWindowNodes.length > 0) {
                            Logger.warn(`stacked-tiling: do not allow multiple levels of stacking for now`);
                            return;
                        }
                    }

                    if (currentLayout === Tree.LAYOUT_TYPES.STACKED) {
                        focusNodeWindow.parentNode.layout = this.determineSplitLayout();
                    } else {
                        focusNodeWindow.parentNode.layout = Tree.LAYOUT_TYPES.STACKED;
                        let lastChild = focusNodeWindow.parentNode.lastChild;
                        if (lastChild.nodeType === Tree.NODE_TYPES.WINDOW) {
                            lastChild.nodeValue.activate(global.display.get_current_time());
                        }
                    }
                    this.unfreezeRender();
                    this._tree.attachNode = focusNodeWindow.parentNode;
                    this.renderTree("layout-stacked-toggle");
                    this.showBorderFocusWindow();
                    break;
                default:
                    break;
            }
        }

        disable() {
            this._removeSignals();
            this.disabled = true;
            Logger.debug(`extension:disable`);
        }

        enable() {
            this._bindSignals();
            this.reloadTree("enable");
            Logger.debug(`extension:enable`);
        }

        findNodeWindow(metaWindow) {
            return this._tree.findNode(metaWindow);
        }

        get focusMetaWindow() {
            return global.display.get_focus_window();
        }

        get windowsActiveWorkspace() {
            let wsManager = global.workspace_manager;
            return global.display.get_tab_list(Meta.TabList.NORMAL_ALL,
                wsManager.get_active_workspace());
        }

        get windowsAllWorkspaces() {
            let wsManager = global.workspace_manager;
            let windowsAll = [];

            for (let i = 0; i < wsManager.get_n_workspaces(); i++) {
                Array.prototype.push.apply(windowsAll, global.display.
                    get_tab_list(Meta.TabList.NORMAL_ALL, wsManager.get_workspace_by_index(i)));
            }
            Logger.debug(`open-windows: ${windowsAll.length}`);
            windowsAll.sort((w1, w2) => {
                return w1.get_stable_sequence() - w2.get_stable_sequence();
            });
            return windowsAll;
        }

        determineSplitLayout() {
            // if the monitor width is less than height, the monitor could be vertical orientation;
            let monitorRect = global.display.get_monitor_geometry(global.display.get_current_monitor());
            if (monitorRect.width < monitorRect.height) {
                return Tree.LAYOUT_TYPES.VSPLIT;
            }
            return Tree.LAYOUT_TYPES.HSPLIT;
        }

        hideWindowBorders() {
            // TODO - use the tree walk to traverse all node windows?
            this._tree.nodeWindows.forEach((nodeWindow) => {
                if (nodeWindow._actor) { 
                    if (nodeWindow._actor.border) {
                        nodeWindow._actor.border.hide();
                    }
                    if (nodeWindow._actor.splitBorder) {
                        nodeWindow._actor.splitBorder.hide();
                    }
                }
            });
        }

        // Window movement API
        move(metaWindow, rect) {
            if (!metaWindow) return;
            if (metaWindow.grabbed) return;
            metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
            metaWindow.unmaximize(Meta.MaximizeFlags.VERTICAL);
            metaWindow.unmaximize(Meta.MaximizeFlags.BOTH);

            let windowActor = metaWindow.get_compositor_private();
            if (!windowActor) return;
            windowActor.remove_all_transitions();

            metaWindow.move_frame(true, rect.x, rect.y);
            metaWindow.move_resize_frame(true, 
                rect.x,
                rect.y,
                rect.width,
                rect.height
            );
        };

        rectForMonitor(node, targetMonitor) {
            if (!node || node && node.nodeType !== Tree.NODE_TYPES.WINDOW) return null;
            if (targetMonitor < 0) return null;
            let currentWorkArea  = node.nodeValue.get_work_area_current_monitor();
            let nextWorkArea = node.nodeValue.get_work_area_for_monitor(targetMonitor);

            if (currentWorkArea && nextWorkArea) {
                let rect = node.rect;
                let hRatio = 1;
                let wRatio = 1;

                hRatio = nextWorkArea.height / currentWorkArea.height;
                wRatio = nextWorkArea.width / currentWorkArea.width;
                rect.height *= hRatio;
                rect.width *= wRatio;

                if (nextWorkArea.y < currentWorkArea.y) {
                    rect.y = ((nextWorkArea.y + rect.y - currentWorkArea.y) / currentWorkArea.height) * nextWorkArea.height;
                } else if (nextWorkArea.y > currentWorkArea.y) {
                    rect.y = ((rect.y / currentWorkArea.height) * nextWorkArea.height) + nextWorkArea.y;
                }

                if (nextWorkArea.x < currentWorkArea.x) {
                    rect.x = ((nextWorkArea.x + rect.x - currentWorkArea.x) / currentWorkArea.width) * nextWorkArea.width;
                } else if (nextWorkArea.x > currentWorkArea.x) {
                    rect.x = ((rect.x / currentWorkArea.width) * nextWorkArea.width) + nextWorkArea.x;
                }
                return rect;
            }
            return null;
        }

        _removeSignals() {
            if (!this._signalsBound)
                return;

            if (this._displaySignals) {
                for (const displaySignal of this._displaySignals) {
                    global.display.disconnect(displaySignal);
                }
                this._displaySignals.length = 0;
                this._displaySignals = undefined;
            }

            if (this._windowManagerSignals) {
                for (const windowManagerSignal of this._windowManagerSignals) {
                    global.window_manager.disconnect(windowManagerSignal);
                }
                this._windowManagerSignals.length = 0;
                this._windowManagerSignals = undefined;
            }

            const globalWsm = global.workspace_manager;

            if (this._workspaceManagerSignals) {
                for (const workspaceManagerSignal of this._workspaceManagerSignals) {
                    globalWsm.disconnect(workspaceManagerSignal);
                }
                this._workspaceManagerSignals.length = 0;
                this._workspaceManagerSignals = undefined;
            }

            let numberOfWorkspaces = globalWsm.get_n_workspaces();

            for (let i = 0; i < numberOfWorkspaces; i++) {
                let workspace = globalWsm.get_workspace_by_index(i);
                if (workspace.workspaceSignals) {
                    for (const workspaceSignal of workspace.workspaceSignals) {
                        workspace.disconnect(workspaceSignal);
                    }
                    workspace.workspaceSignals.length = 0;
                    workspace.workspaceSignals = undefined;
                }
            }

            let allWindows = this.windowsAllWorkspaces;

            if (allWindows) {
                for (let metaWindow of allWindows) {
                    if (metaWindow.windowSignals !== undefined) {
                        for (const windowSignal of metaWindow.windowSignals) {
                            metaWindow.disconnect(windowSignal);
                        }
                        metaWindow.windowSignals.length = 0;
                        metaWindow.windowSignals = undefined;
                    }

                    let windowActor = metaWindow.get_compositor_private();
                    if (windowActor && windowActor.actorSignals) {
                        for (const actorSignal of windowActor.actorSignals) {
                            windowActor.disconnect(actorSignal);
                        }
                        windowActor.actorSignals.length = 0;
                        windowActor.actorSignals = undefined;
                    }

                    if (windowActor && windowActor.border) {
                        windowActor.border.hide();
                        if (global.window_group) {
                            global.window_group.remove_child(windowActor.border);
                        }
                        windowActor.border = undefined;
                    }

                    if (windowActor && windowActor.splitBorder) {
                        windowActor.splitBorder.hide();
                        if (global.window_group) {
                            global.window_group.remove_child(windowActor.splitBorder);
                        }
                        windowActor.splitBorder = undefined;
                    }
                }
            }


            if (this._renderTreeSrcId) {
                GLib.Source.remove(this._renderTreeSrcId);
                this._renderTreeSrcId = 0;
            }

            if (this._reloadTreeSrcId) {
                GLib.Source.remove(this._reloadTreeSrcId);
                this._reloadTreeSrcId = 0;
            }

            if (this._wsWindowAddSrcId) {
                GLib.Source.remove(this._wsWindowAddSrcId);
                this._wsWindowAddSrcId = 0;
            }

            if (this._wsRemoveSrcId) {
                GLib.Source.remove(this._wsRemoveSrcId);
                this._wsRemoveSrcId = 0;
            }

            if (this._wsSwitchedSrcId) {
                GLib.Source.remove(this._wsSwitchedSrcId);
                this._wsSwitchedSrcId = 0;
            }

            if (this._queueSourceId) {
                GLib.Source.remove(this._queueSourceId);
                this._queueSourceId = 0;
            }

            this._signalsBound = false;
        }

        renderTree(from) {
            if (this._freezeRender ||
                !this.ext.settings.get_boolean("tiling-mode-enabled")) {
                Logger.trace(`render frozen`);
                return;
            }
            
            if (!this._renderTreeSrcId) {
                this._renderTreeSrcId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
                    this._tree.render(from);
                    this._renderTreeSrcId = 0;
                    return false;
                });
            }
        }

        /**
         * Reloads the tree. This is an expensive operation.
         * Useful when using dynamic workspaces in GNOME-shell.
         *
         * TODO: add support to reload the tree from a JSON dump file.
         * TODO: move this to tree.js
         */
        reloadTree(from) {
            if (!this._reloadTreeSrcId) {
                this._reloadTreeSrcId = GLib.idle_add(GLib.PRIORITY_LOW, () => {
                    let treeWorkspaces = this._tree.nodeWorkpaces;
                    let wsManager = global.workspace_manager;
                    let globalWsNum = wsManager.get_n_workspaces();
                    Logger.trace(`tree-workspaces: ${treeWorkspaces.length}, global-workspaces: ${globalWsNum}`);
                    // empty out the root children nodes
                    this._tree.childNodes.length = 0;
                    this._tree.attachNode = undefined;
                    // initialize the workspaces and monitors id strings
                    this._tree._initWorkspaces();
                    this.trackCurrentWindows();
                    this.renderTree(from);
                    this.showBorderFocusWindow();
                    this._reloadTreeSrcId = 0;
                    return false;
                });
            }
        }

        sameParentMonitor(firstNode, secondNode) {
            if (!firstNode || !secondNode) return false;
            if (!firstNode.nodeValue || !secondNode.nodeValue) return false;
            if (!firstNode.nodeValue.get_workspace()) return false;
            if (!secondNode.nodeValue.get_workspace()) return false;
            let firstMonWs = `mo${firstNode.nodeValue.get_monitor()}ws${firstNode.nodeValue.get_workspace().index()}`;
            let secondMonWs = `mo${secondNode.nodeValue.get_monitor()}ws${secondNode.nodeValue.get_workspace().index()}`;
            return firstMonWs === secondMonWs;
        }

        showBorderFocusWindow() {
            this.hideWindowBorders();
            let metaWindow = this.focusMetaWindow;
            if (!metaWindow) return;
            let windowActor = metaWindow.get_compositor_private();
            if (!windowActor) return;
            let nodeWindow = this.findNodeWindow(metaWindow);
            if (!nodeWindow) return;

            let borders = [];
            let focusBorderEnabled = this.ext.settings.get_boolean("focus-border-toggle");
            let splitBorderEnabled = this.ext.settings.get_boolean("split-border-toggle");
            let tilingModeEnabled = this.ext.settings.get_boolean("tiling-mode-enabled");
            let gap = this.calculateGaps(metaWindow);
            let maximized = () => {
                return metaWindow.get_maximized() !== 0 ||
                    metaWindow.is_fullscreen() ||
                    gap === 0;
            }
            let monitorCount = global.display.get_n_monitors();
            let tiled = this._tree.getTiledChildren(nodeWindow.parentNode.childNodes);

            if (windowActor.border && focusBorderEnabled) {
                if (!maximized() ||
                    gap === 0 && tiled.length === 1 && monitorCount > 1 ||
                    gap === 0 && tiled.length > 1 ||
                    this.floatingWindow(nodeWindow))
                    borders.push(windowActor.border);
            }

            // handle the split border
            if (splitBorderEnabled &&
                tilingModeEnabled &&
                !this.floatingWindow(nodeWindow) &&
                nodeWindow.parentNode.childNodes.length === 1 &&
                (nodeWindow.parentNode.nodeType === Tree.NODE_TYPES.CON ||
                    nodeWindow.parentNode.nodeType === Tree.NODE_TYPES.MONITOR)) {
                if (!windowActor.splitBorder) {
                    let splitBorder = new St.Bin({style_class: "window-split-direction-horizontal"});
                    global.window_group.add_child(splitBorder);
                    windowActor.splitBorder = splitBorder;
                    Logger.debug(`focus-border: create split border`);
                } 

                let splitBorder = windowActor.splitBorder;
                if (nodeWindow.parentNode.layout === Tree.LAYOUT_TYPES.VSPLIT) {
                    splitBorder.set_style_class_name("window-split-direction-vertical");
                } else {
                    splitBorder.set_style_class_name("window-split-direction-horizontal");
                }
                borders.push(splitBorder);
            }

            let rect = metaWindow.get_frame_rect();
            let inset = 2; // whether to put border inside the window when 0-gapped or maximized

            if (maximized()) {
                inset = 0;
            }

            borders.forEach((border) => {
                border.set_size(rect.width + (inset * 2), rect.height + (inset * 2));
                border.set_position(rect.x - inset, rect.y - inset);
                if (metaWindow.appears_focused &&
                    !metaWindow.minimized) {
                    border.show();
                }
                if (global.window_group && global.window_group.contains(border)) {
                    global.window_group.remove_child(border);
                    global.window_group.add_child(border);
                }
            });
            Logger.trace(`show-border-focus-window`);
        }

        calculateGaps(metaWindow) {
            let settings = this.ext.settings;
            let gapSize = settings.get_uint("window-gap-size")
            let gapIncrement = settings.get_uint("window-gap-size-increment");
            let gap = gapSize * gapIncrement;
            if (metaWindow && metaWindow.get_workspace()) {
                let monitorWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
                let monitorWsNode = this._tree.findNode(monitorWs);
                if (monitorWsNode) {
                    let tiled = monitorWsNode.getNodeByMode(WINDOW_MODES.TILE)
                        .filter((t) => t.nodeType === Tree.NODE_TYPES.WINDOW);
                    let hideGapWhenSingle = settings.get_boolean("window-gap-hidden-on-single");
                    if (tiled.length === 1 && hideGapWhenSingle) {
                        gap = 0;
                    }
                }
            }
            return gap;
        }

        /**
         * Track meta/mutter windows and append them to the tree.
         * Windows can be attached on any of the following Node Types: 
         * MONITOR, CONTAINER
         *
         */
        trackWindow(_display, metaWindow) {
            // Make window types configurable
            if (this._validWindow(metaWindow)) {
                let existNodeWindow = this._tree.findNode(metaWindow);
                if (!existNodeWindow) {
                    let parentFocusNode = this._tree.attachNode;
                    // check the parentFocusNode is in the tree
                    if (parentFocusNode) {
                        Logger.debug(`checking parentFocusNode if detached from the tree`);
                        parentFocusNode = this._tree.findNode(parentFocusNode.nodeValue);
                    }
                    if (!parentFocusNode) {
                        // Else it could be the initial window
                        // get the containing monitor instead
                        let metaMonWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
                        parentFocusNode = this._tree.findNode(metaMonWs);
                    }
                    if (!parentFocusNode) {
                        // there is nothing to attach to
                        Logger.warn(`track-window: nothing to attach to for ${metaWindow.get_title()}`);
                        return;
                    }
                    Logger.info(`track-window: ${metaWindow.get_title()} attaching to ${parentFocusNode.nodeValue}`);

                    let newNodeWindow = this._tree.createNode(parentFocusNode.nodeValue, Tree.NODE_TYPES.WINDOW, 
                        metaWindow);
                    if (newNodeWindow) {
                        if (metaWindow.get_window_type() === Meta.WindowType.DIALOG ||
                            metaWindow.get_window_type() === Meta.WindowType.MODAL_DIALOG ||
                            metaWindow.get_transient_for() !== null ||
                            !metaWindow.allows_resize()) {
                            newNodeWindow.mode = WINDOW_MODES.FLOAT;
                        } else {
                            metaWindow.firstRender = true;
                            newNodeWindow.mode = WINDOW_MODES.TILE;

                            let childNodes = this._tree.getTiledChildren(parentFocusNode.childNodes);
                            childNodes.forEach((n) => {
                                n.percent = 0.0;
                            });
                        }
                    }
                }

                let windowActor = metaWindow.get_compositor_private();

                if (!metaWindow.windowSignals) {
                    let windowSignals = [
                        metaWindow.connect("position-changed", (_metaWindow) => {
                            let from = "position-changed";
                            this.updateMetaPositionSize(_metaWindow, from);
                        }),
                        metaWindow.connect("size-changed", (_metaWindow) => {
                            let from = "size-changed";
                            this.updateMetaPositionSize(_metaWindow, from);
                        }),
                        metaWindow.connect("focus", (_metaWindowFocus) => {
                            let tilingModeEnabled = this.ext.settings.get_boolean("tiling-mode-enabled");
                            if ((tilingModeEnabled && !_metaWindowFocus.firstRender) ||
                                !tilingModeEnabled ||
                                !this.isActiveWindowWorkspaceTiled(this.focusMetaWindow))
                                this.showBorderFocusWindow();

                            let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
                            if (focusNodeWindow) {
                                // handle the attach node
                                this._tree.attachNode = focusNodeWindow._parent;
                                let childWindows = focusNodeWindow.parentNode.getNodeByType(Tree.NODE_TYPES.WINDOW);
                                childWindows.forEach((node) => {
                                    node.nodeValue.raise();
                                });
                                // handle the stacked focus window
                                if (focusNodeWindow.parentNode.layout === Tree.LAYOUT_TYPES.STACKED && !this._freezeRender) {
                                    focusNodeWindow.parentNode.appendChild(focusNodeWindow);
                                    focusNodeWindow.nodeValue.raise();
                                    this.queueEvent({name: "render-focus-stack", callback: () => {
                                        this.renderTree("focus-stacked");
                                    }});
                                }
                            }

                            Logger.debug(`window:focus`);
                        }),
                        metaWindow.connect("workspace-changed", (metaWindowWs) => {
                            Logger.debug(`workspace-changed ${metaWindowWs.get_wm_class()}`);
                        }),
                    ];
                    metaWindow.windowSignals = windowSignals;
                    Logger.debug(`track-window:binding-metawindow-signal`);
                }

                if (!windowActor.actorSignals) {
                    let actorSignals = [
                        windowActor.connect("destroy", this._windowDestroy.bind(this)),
                    ];
                    windowActor.actorSignals = actorSignals;
                    Logger.debug(`track-window:binding-actor-signal`);
                }

                if (!windowActor.border) {
                    let border = new St.Bin({style_class: "window-clone-border"});

                    if (global.window_group)
                        global.window_group.add_child(border);

                    windowActor.border = border;
                    border.show();
                    Logger.debug(`track-window:create-border`);
                }

                Logger.debug(`window tracked: ${metaWindow.get_wm_class()}`);
                Logger.trace(` on workspace: ${metaWindow.get_workspace().index()}`);
                Logger.trace(` on monitor: ${metaWindow.get_monitor()}`);
            } 
        }

        /**
         * Check if a Meta Window's workspace is skipped for tiling.
         */
        isActiveWindowWorkspaceTiled(metaWindow) {
            if (!metaWindow) return true;
            let skipWs = this.ext.settings.get_string("workspace-skip-tile");
            let skipArr = skipWs.split(",");
            let skipThisWs = false;

            for (let i = 0; i < skipArr.length; i++) {
                let activeWorkspaceForWin = metaWindow.get_workspace();
                if (activeWorkspaceForWin) {
                    let wsIndex = activeWorkspaceForWin.index();
                    if (skipArr[i].trim() === `${wsIndex}`) {
                        Logger.debug(`workspace ${wsIndex} skipped for window ${metaWindow.get_wm_class()}`);
                        skipThisWs = true;
                        break;
                    }
                }
            }
            return !skipThisWs;
        }

        /**
         * Check the current active workspace's tiling mode
         */
        isCurrentWorkspaceTiled() {
            let skipWs = this.ext.settings.get_string("workspace-skip-tile");
            let skipArr = skipWs.split(",");
            let skipThisWs = false;
            let wsMgr = global.workspace_manager;
            let wsIndex = wsMgr.get_active_workspace_index();

            for (let i = 0; i < skipArr.length; i++) {
                if (skipArr[i].trim() === `${wsIndex}`) {
                    Logger.debug(`workspace ${wsIndex} skipped`);
                    skipThisWs = true;
                    break;
                }
            }
            return !skipThisWs;
        }

        trackCurrentWindows() {
            let windowsAll = this.windowsAllWorkspaces;
            for (let i = 0; i < windowsAll.length; i++) {
                this.trackWindow(global.display, windowsAll[i]);
            }
            Logger.debug(`track-current-windows`);
        }

        _validWindow(metaWindow) {
            let windowType = metaWindow.get_window_type();
            return windowType === Meta.WindowType.NORMAL ||
                windowType === Meta.WindowType.MODAL_DIALOG ||
                windowType === Meta.WindowType.DIALOG;
        }

        _windowDestroy(actor) {
            // Release any resources on the window
            let border = actor.border;
            if (border) {
                if (global.window_group) {
                    global.window_group.remove_child(border);
                    border = null;
                }
            }

            let splitBorder = actor.splitBorder;
            if (splitBorder) {
                if (global.window_group) {
                    global.window_group.remove_child(splitBorder);
                    splitBorder = null;
                }
            }
            
            let nodeWindow;
            nodeWindow = this._tree.findNodeByActor(actor);
            if (nodeWindow) {
                Logger.debug(`window destroyed ${nodeWindow.nodeValue.get_wm_class()}`);
                let render = true;
                if (nodeWindow.parentNode.nodeType === Tree.NODE_TYPES.MONITOR && nodeWindow.parentNode.childNodes.length === 1) {
                    render = false;
                }
                this._tree.removeNode(nodeWindow);

                if (render)
                    this.renderTree("window-destroy");
            }

            // find the next attachNode here
            let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
            if (focusNodeWindow) {
                this._tree.attachNode = focusNodeWindow.parentNode;
                Logger.trace(`on-destroy: finding next attach node ${this._tree.attachNode.nodeType}`);
            }

            Logger.debug(`window-destroy`);
        }

        /**
         * Handles any workspace/monitor update for the Meta.Window.
         */
        updateMetaWorkspaceMonitor(from, monitor, metaWindow) {
            if (this._validWindow(metaWindow)) {
                if (metaWindow.get_workspace() === null) return;
                let existNodeWindow = this._tree.findNode(metaWindow);
                let metaMonWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`; 
                let metaMonWsNode = this._tree.findNode(metaMonWs);
                if (existNodeWindow) {
                    if (existNodeWindow.parentNode && metaMonWsNode) {
                        // Uses the existing workspace, monitor that the metaWindow
                        // belongs to.
                        let containsWindow = metaMonWsNode.contains(existNodeWindow);
                        if (!containsWindow) {
                            Logger.debug(`window ${metaWindow.get_wm_class()} is not in same monitor-workspace ${metaMonWs}`);
                            // handle cleanup of resize percentages
                            let existParent = existNodeWindow.parentNode;
                            this._tree.resetSiblingPercent(existParent);
                            metaMonWsNode.appendChild(existNodeWindow);
                        }
                    }
                }
                Logger.debug(`update-ws-mon:${from}: ${metaWindow.get_wm_class()}`);
                Logger.trace(` on workspace: ${metaWindow.get_workspace().index()}`);
                Logger.trace(` on monitor: ${monitor} `);
                this.renderTree(from);
            }
            this.showBorderFocusWindow();
        }

        /**
         * Handle any updates to the current focused window's position.
         * Useful for updating the active window border, etc.
         */
        updateMetaPositionSize(_metaWindow, from) {
            let focusWindow = this.focusMetaWindow;
            if (!focusWindow) return;
            if (focusWindow.get_maximized() === 0) {
                this.renderTree(from);
            }
            this.showBorderFocusWindow();

            let focusNodeWindow = this.findNodeWindow(focusWindow);
            if (!focusNodeWindow) return;

            if (focusNodeWindow.grabMode && focusNodeWindow.grabMode === GRAB_TYPES.RESIZING) {
                let grabOp = global.display.get_grab_op();
                let initGrabOp = focusNodeWindow.initGrabOp;
                let direction = Utils.directionFromGrab(grabOp);
                let orientation = Utils.orientationFromGrab(grabOp);
                let parentNodeForFocus = focusNodeWindow.parentNode;
                let position = Utils.positionFromGrabOp(grabOp);
                // normalize the rect without gaps
                let currentRect = Utils.removeGapOnRect(
                    focusWindow.get_frame_rect(), this.calculateGaps(this.focusMetaWindow)); 
                let firstRect;
                let secondRect;
                let parentRect;
                let resizePairForWindow;

                if (initGrabOp === Meta.GrabOp.RESIZING_UNKNOWN) {
                    // the direction is null so do not process yet below.
                    return;
                } else {
                   resizePairForWindow = this._tree.nextVisible(focusNodeWindow, direction);
                }

                Logger.trace(`update-position-size: ${grabOp}`);
                let sameParent = resizePairForWindow ?
                    resizePairForWindow.parentNode === focusNodeWindow.parentNode : false;

                if (orientation === Tree.ORIENTATION_TYPES.HORIZONTAL) {
                    if (sameParent) {
                        // use the window or con pairs
                        if (this._tree.getTiledChildren(parentNodeForFocus.childNodes).length <= 1) {
                            Logger.warn(`not valid for resize`);
                            return;
                        }

                        firstRect = focusNodeWindow.initRect;
                        if (resizePairForWindow) {
                            if (!this.floatingWindow(resizePairForWindow)
                                && !this.minimizedWindow(resizePairForWindow)) {
                                secondRect = resizePairForWindow.rect;
                            } else {
                                // TODO try to get the next resize pair?
                            }
                        }

                        if (!firstRect || !secondRect) {
                            Logger.warn(`first and second rect pairs not available`);
                            return;
                        }

                        parentRect = parentNodeForFocus.rect;
                        let changePx = currentRect.width - firstRect.width;
                        let firstPercent = (firstRect.width + changePx) / parentRect.width;
                        let secondPercent = (secondRect.width - changePx) / parentRect.width;
                        focusNodeWindow.percent = firstPercent;
                        resizePairForWindow.percent = secondPercent;
                    } else {
                        // use the parent pairs (con to another con or window)
                        if (resizePairForWindow) {
                            if (this._tree.getTiledChildren(resizePairForWindow.parentNode.childNodes).length <= 1) {
                                Logger.warn(`not valid for resize`);
                                return;
                            }
                            let firstWindowRect = focusNodeWindow.initRect;
                            let index = resizePairForWindow.index;
                            if (position === Tree.POSITION.BEFORE) {
                                // Find the opposite node
                                index = index + 1;
                            } else {
                                index = index - 1;
                            }
                            parentNodeForFocus = resizePairForWindow.parentNode.childNodes[index];
                            firstRect = parentNodeForFocus.rect;
                            secondRect = resizePairForWindow.rect;
                            if (!firstRect || !secondRect) {
                                Logger.warn(`first and second rect pairs not available`);
                                return;
                            }

                            parentRect = parentNodeForFocus.parentNode.rect;
                            let changePx = currentRect.width - firstWindowRect.width;
                            let firstPercent = (firstRect.width + changePx) / parentRect.width;
                            let secondPercent = (secondRect.width - changePx) / parentRect.width;
                            parentNodeForFocus.percent = firstPercent;
                            resizePairForWindow.percent = secondPercent;
                        }

                   }
                } else if (orientation === Tree.ORIENTATION_TYPES.VERTICAL) {
                    if (sameParent) {
                        // use the window or con pairs
                        if (this._tree.getTiledChildren(parentNodeForFocus.childNodes).length <= 1) {
                            Logger.warn(`not valid for resize`);
                            return;
                        }
                        firstRect = focusNodeWindow.initRect;
                        if (resizePairForWindow) {
                            if (!this.floatingWindow(resizePairForWindow)
                                && !this.minimizedWindow(resizePairForWindow)) {
                                secondRect = resizePairForWindow.rect;
                            } else {
                                // TODO try to get the next resize pair?
                            }
                        }
                        if (!firstRect || !secondRect) {
                            Logger.warn(`first and second rect pairs not available`);
                            return;
                        }
                        parentRect = parentNodeForFocus.rect;
                        let changePx = currentRect.height - firstRect.height;
                        let firstPercent = (firstRect.height + changePx) / parentRect.height;
                        let secondPercent = (secondRect.height - changePx) / parentRect.height;
                        focusNodeWindow.percent = firstPercent;
                        resizePairForWindow.percent = secondPercent;
                    } else {
                        // use the parent pairs (con to another con or window)
                        if (resizePairForWindow) {
                            if (this._tree.getTiledChildren(resizePairForWindow.parentNode.childNodes).length <= 1) {
                                Logger.warn(`not valid for resize`);
                                return;
                            }
                            let firstWindowRect = focusNodeWindow.initRect;
                            let index = resizePairForWindow.index;
                            if (position === Tree.POSITION.BEFORE) {
                                // Find the opposite node
                                index = index + 1;
                            } else {
                                index = index - 1;
                            }
                            parentNodeForFocus = resizePairForWindow.parentNode.childNodes[index];
                            firstRect = parentNodeForFocus.rect;
                            secondRect = resizePairForWindow.rect;
                            if (!firstRect || !secondRect) {
                                Logger.warn(`first and second rect pairs not available`);
                                return;
                            }

                            parentRect = parentNodeForFocus.parentNode.rect;
                            let changePx = currentRect.height - firstWindowRect.height;
                            let firstPercent = (firstRect.height + changePx) / parentRect.height;
                            let secondPercent = (secondRect.height - changePx) / parentRect.height;
                            parentNodeForFocus.percent = firstPercent;
                            resizePairForWindow.percent = secondPercent;
                        }
                    }
                }
            }

            Logger.trace(`${from} ${focusWindow.get_wm_class()}`);
        }

        freezeRender() {
            this._freezeRender = true;
        }

        unfreezeRender() {
            this._freezeRender = false;
        }

        floatingWindow(node) {
            if (!node) return false;
            return (node._type === Tree.NODE_TYPES.WINDOW &&
                node.mode === WINDOW_MODES.FLOAT);
        }

        /**
         * Moves the pointer along with the nodeWindow's meta
         *
         * This is useful for making sure that Forge calculates the attachNode
         * properly
         */
        movePointerWith(nodeWindow) {
            if (!nodeWindow || !nodeWindow._data) return;
            let rect = nodeWindow._data.get_frame_rect();
            let gdkDisplay = Gdk.DisplayManager.get().get_default_display();

            if (gdkDisplay) {
                let gdkScreen = gdkDisplay.get_default_screen();
                let gdkPointer = gdkDisplay.get_default_seat().get_pointer();
                Logger.warn(`move-pointer with monitor to ${rect.x}, ${rect.y}`);
                gdkPointer.warp(gdkScreen, rect.x, rect.y);
            }
        }

        getPointer() {
            return global.get_pointer();
        }

        minimizedWindow(node) {
            if (!node) return false;
            return (node._type === Tree.NODE_TYPES.WINDOW
                && node._data
                && node._data.minimized);
        }
    }
);

