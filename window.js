/*
 * This file is part of the Forge Window Manager extension for Gnome 3
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
    'TILE'
]);

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init(ext) {
            super._init();
            this.ext = ext;
            this._tree = new Tree.Tree(this);
            Logger.info("forge initialized");
        }

        // TODO move this to a new module to handle floating?
        _applyNodeWindowMode(action, metaWindow) {
            let nodeWindow = this.findNodeWindow(metaWindow);
            if (!nodeWindow || !(action || action.mode)) return;
            if (nodeWindow._type !== Tree.NODE_TYPES.WINDOW) return;
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
                    Logger.debug(`window-left-monitor`);
                }),
                display.connect("grab-op-end", (_, _display, _metaWindow, grabOp) => {
                    // handle window swapping
                    let pointerCoord = global.get_pointer();
                    Logger.trace(`grab-end:pointer x:${pointerCoord[0]}, y:${pointerCoord[1]} `);
                    let nodeWinPrev = this.findNodeWindow(this.focusMetaWindow);
                    let nodeWinAtPointer = this._tree.findNodeWindowAtPointer(
                        this.focusMetaWindow, pointerCoord);
                    Logger.debug(`node at pointer ${nodeWinAtPointer}`);
                    if (nodeWinAtPointer &&
                        // Swap only when grabbed by the mouse
                        grabOp === Meta.GrabOp.WINDOW_BASE) {
                        this._tree.swap(nodeWinPrev, nodeWinAtPointer);
                    }

                    this.unfreezeRender();

                    let focusWindow = this.focusMetaWindow;
                    if (focusWindow) {
                        if (focusWindow.get_maximized() === 0) {
                            this.renderTree("grab-op-end");
                        }
                        let focusNodeWindow = this.findNodeWindow(focusWindow);
                        if (focusNodeWindow) {
                            focusNodeWindow.grabbed = false;
                            focusNodeWindow.initRect = null;
                        }
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
                        let resizeGrab = Utils.allowResizeGrabOp(grabOp);
                        Logger.debug(`grabOp ${grabOp}`);
                        if (resizeGrab) {
                            focusNodeWindow.grabbed = true;
                            focusNodeWindow.initRect = Utils.removeGapOnRect(
                                focusWindow.get_frame_rect(),
                                this.calculateGaps(focusWindow));
                            focusNodeWindow.resizePairForWindow = this._tree.nextVisible(focusNodeWindow, direction);
                        }
                    }
                    Logger.debug(`grab op begin ${grabOp}, orientation ${orientation}`);
                }),
                display.connect("showing-desktop-changed", () => {
                    Logger.debug(`display:showing-desktop-changed`);
                }),
                display.connect("workareas-changed", (_display) => {
                    this.reloadTree("workareas-changed");
                    Logger.debug(`workareas-changed`);
                }),
            ];

            this._windowManagerSignals = [
                shellWm.connect("minimize", () => {
                    this.hideWindowBorders();
                    let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
                    if (focusNodeWindow) {
                        if (this._tree.getTiledChildren(focusNodeWindow._parent._nodes).length === 0) {
                            this._tree.resetSiblingPercent(focusNodeWindow._parent._parent);
                        }
                        this._tree.resetSiblingPercent(focusNodeWindow._parent);
                    }
                    this.renderTree("minimize");
                    Logger.debug(`minimized ${this.focusMetaWindow.title}`);
                }),
                shellWm.connect("unminimize", () => {
                    let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
                    if (focusNodeWindow) {
                        this._tree.resetSiblingPercent(focusNodeWindow._parent);
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
                }),
                globalWsm.connect("workspace-removed", (_, wsIndex) => {
                    let removed = this._tree.removeWorkspace(wsIndex);
                    Logger.debug(`${removed ? "workspace-removed" : "workspace-remove-skipped"} ${wsIndex}`);
                }),
                globalWsm.connect("workspace-switched", (_, _wsIndex) => {
                    this.hideWindowBorders();
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
                        this.showBorderFocusWindow();
                    });
                    Logger.debug(`workspace-switched`);
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
                            this.updateMetaWorkspaceMonitor("window-added", metaWindow.get_monitor(), metaWindow);
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
                    let existParent = focusNodeWindow._parent;
                    if (this._tree.getTiledChildren(existParent._nodes).length <= 1) {
                        existParent.percent = 0.0;
                        this._tree.resetSiblingPercent(existParent._parent);
                    }
                    this._tree.resetSiblingPercent(existParent);
                    this.renderTree("move-resize");
                    break;
                case "Focus":
                    let focusDirection = Utils.resolveDirection(action.direction);
                    let focusNext = (focusNodeWindow) => {
                        let nextFocusNode = this._tree.next(focusNodeWindow, focusDirection);
                        Logger.trace(`focus: next ${nextFocusNode ? nextFocusNode._type : undefined}`);
                        if (!nextFocusNode) {
                            return;
                        }

                        let nodeType = nextFocusNode._type;

                        switch(nodeType) {
                            case Tree.NODE_TYPES.WINDOW:
                                if (this.floatingWindow(nextFocusNode) || nextFocusNode._data.minimized) {
                                    Logger.warn(`focus: window is minimized or floating`);
                                    focusNext(nextFocusNode);
                                } else {
                                    // TODO, maybe put the code block below in a new function
                                    nextFocusNode._data.raise();
                                    nextFocusNode._data.activate(global.get_current_time());
                                    nextFocusNode._data.focus(global.get_current_time());
                                }
                                break;
                            case Tree.NODE_TYPES.CON:
                            case Tree.NODE_TYPES.MONITOR:
                                nextFocusNode = this._tree.findFirstNodeWindowFrom(nextFocusNode, "bottom");
                                if (nextFocusNode) {
                                    // Always try to find the next window
                                    if (this.floatingWindow(nextFocusNode) ||
                                        nextFocusNode._data.minimized) {
                                        Logger.warn(`focus: window is minimized or floating`);
                                        focusNext(nextFocusNode);
                                    } else {
                                        nextFocusNode._data.raise();
                                        nextFocusNode._data.activate(global.get_current_time());
                                        nextFocusNode._data.focus(global.get_current_time());
                                    }
                                }
                                break;
                        }

                        if (nextFocusNode) {
                            // Great found the next node window,
                            // check if same monitor as before, else warp the pointer
                            if (!this.sameParentMonitor(focusNodeWindow, nextFocusNode)) {
                                // TODO warp the pointer here to the new monitor
                                // and make it configurable
                                let movePointerAlongWithMonitor = true;
                                if (movePointerAlongWithMonitor) {
                                    this.movePointerWith(nextFocusNode);
                                }
                            }
                            // FIXME, when the window focuses on hover always
                            // move the pointer
                            this._tree.attachNode = nextFocusNode._parent;
                            Logger.trace(`focus: next attachNode ${this._tree.attachNode._type} ${this._tree.attachNode}`);
                        }
                    }

                    focusNext(focusNodeWindow);

                    break;
                case "Swap":
                    let swapDirection = Utils.resolveDirection(action.direction);
                    let nextSwapNode = this._tree.next(focusNodeWindow, swapDirection);
                    Logger.trace(`swap: next ${nextSwapNode ? nextSwapNode._type : undefined}`);
                    if (!nextSwapNode) {
                        return;
                    }
                    let nodeSwapType = nextSwapNode._type;

                    switch(nodeSwapType) {
                        case Tree.NODE_TYPES.WINDOW:
                            break;
                        case Tree.NODE_TYPES.CON:
                        case Tree.NODE_TYPES.MONITOR:
                            nextSwapNode = this._tree.findFirstNodeWindowFrom(nextSwapNode, "bottom");
                            break;
                    }
                    let isNextNodeWin = nextSwapNode && nextSwapNode._data && nextSwapNode._type ===
                        Tree.NODE_TYPES.WINDOW;
                    if (isNextNodeWin) {
                        // FIXME, this prevents a serious GC bug for now
                        if (!this.sameParentMonitor(focusNodeWindow, nextSwapNode)) {
                            Logger.warn(`swap: not same monitor, do not swap`);
                            return;
                        }
                        Logger.debug(`swap:next ${isNextNodeWin ? nextSwapNode._data.get_wm_class() : "undefined"}`);
                        this._tree.swap(focusNodeWindow, nextSwapNode);
                        this.renderTree("swap");
                    } 
                    break;
                case "Split":
                    let orientation = action.orientation ? action.orientation.
                        toUpperCase() : Tree.ORIENTATION_TYPES.NONE;
                    this._tree.split(this.findNodeWindow(focusWindow), orientation);
                    this.renderTree("split");
                    this.showBorderFocusWindow();
                    break;
                case "LayoutToggle":
                    let currentLayout = focusNodeWindow._parent.layout;
                    if (currentLayout === Tree.LAYOUT_TYPES.HSPLIT) {
                        focusNodeWindow._parent.layout = Tree.LAYOUT_TYPES.VSPLIT;
                    } else {
                        focusNodeWindow._parent.layout = Tree.LAYOUT_TYPES.HSPLIT;
                    }
                    this._tree.attachNode = focusNodeWindow._parent;
                    this.renderTree("layout-toggle");
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

            this._signalsBound = false;
        }

        // TODO move this to tree.js
        renderTree(from) {
            if (this._freezeRender ||
                !this.ext.settings.get_boolean("tiling-mode-enabled")) {
                Logger.trace(`render frozen`);
                return;
            }
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                this._tree.render(from);
            });
        }

        /**
         * Reloads the tree. This is an expensive operation.
         * Useful when using dynamic workspaces in GNOME-shell.
         *
         * TODO: add support to reload the tree from a JSON dump file.
         * TODO: move this to tree.js
         */
        reloadTree(from) {
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                let treeWorkspaces = this._tree.nodeWorkpaces;
                let wsManager = global.workspace_manager;
                let globalWsNum = wsManager.get_n_workspaces();
                Logger.trace(`tree-workspaces: ${treeWorkspaces.length}, global-workspaces: ${globalWsNum}`);
                // empty out the root children nodes
                this._tree._root._nodes.length = 0;
                this._tree.attachNode = undefined;
                // initialize the workspaces and monitors id strings
                this._tree._initWorkspaces();
                this.trackCurrentWindows();

                for (let i = 0; i < this._tree.nodeWorkpaces.length; i++) {
                    let existingWsNode = this._tree.nodeWorkpaces[i];
                    let monitors = existingWsNode._nodes;
                    Logger.trace(`  ${existingWsNode._data}`);
                    for (let m = 0; m < monitors.length; m++) {
                        let windows  = monitors[m]._nodes;
                        for (let w = 0; w < windows.length; w++) {
                            let nodeWindow = windows[w];
                            if (nodeWindow && nodeWindow._data)
                                this.updateMetaWorkspaceMonitor("reload-tree",
                                    nodeWindow._data.get_monitor(),
                                    nodeWindow._data);
                        }
                    }
                }
                Logger.debug(`windowmgr:reload-tree ${from ? "from " + from : ""}`);
                this.renderTree("reload-tree");
                this.showBorderFocusWindow();
            });
        }

        sameParentMonitor(firstNode, secondNode) {
            if (!firstNode || !secondNode) return false;
            if (!firstNode._data || !secondNode._data) return false;
            if (!firstNode._data.get_workspace()) return false;
            if (!secondNode._data.get_workspace()) return false;
            let firstMonWs = `mo${firstNode._data.get_monitor()}ws${firstNode._data.get_workspace().index()}`;
            let secondMonWs = `mo${secondNode._data.get_monitor()}ws${secondNode._data.get_workspace().index()}`;
            return firstMonWs === secondMonWs;
        }

        showBorderFocusWindow() {
            this.hideWindowBorders();
            let metaWindow = this.focusMetaWindow;
            if (!metaWindow) return;
            let windowActor = metaWindow.get_compositor_private();
            if (!windowActor) return;

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

            let nodeWindow = this.findNodeWindow(metaWindow);
            if (windowActor.border && focusBorderEnabled) {
                if (!maximized() || maximized() && monitorCount > 1 || this.floatingWindow(nodeWindow))
                    borders.push(windowActor.border);
            }

            // handle the split border
            if (nodeWindow &&
                splitBorderEnabled &&
                tilingModeEnabled &&
                !this.floatingWindow(nodeWindow) &&
                nodeWindow._parent._nodes.length === 1 &&
                (nodeWindow._parent._type === Tree.NODE_TYPES.CON ||
                    nodeWindow._parent._type === Tree.NODE_TYPES.MONITOR)) {
                if (!windowActor.splitBorder) {
                    let splitBorder = new St.Bin({style_class: "window-split-direction-horizontal"});
                    global.window_group.add_child(splitBorder);
                    windowActor.splitBorder = splitBorder;
                    Logger.debug(`focus-border: create split border`);
                } 

                let splitBorder = windowActor.splitBorder;
                if (nodeWindow._parent.layout === Tree.LAYOUT_TYPES.VSPLIT) {
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
            if (metaWindow) {
                let monitorWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
                let monitorWsNode = this._tree.findNode(monitorWs);
                let tiled = this._tree.getTiledChildren(monitorWsNode._nodes);
                let hideGapWhenSingle = settings.get_boolean("window-gap-hidden-on-single");
                if (tiled.length === 1 && hideGapWhenSingle)
                    gap = 0;
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
                    Logger.info(`track-window: ${metaWindow.get_title()} attaching to ${parentFocusNode._data}`);

                    let childNodes = this._tree.getTiledChildren(parentFocusNode._nodes);
                    childNodes.forEach((n) => {
                        n.percent = 0.0;
                    });

                    let newNodeWindow = this._tree.addNode(parentFocusNode._data, Tree.NODE_TYPES.WINDOW, 
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
                            if ((tilingModeEnabled && !_metaWindowFocus.firstRender) || !tilingModeEnabled)
                                this.showBorderFocusWindow();

                            // handle the attach node
                            let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
                            if (focusNodeWindow) {
                                this._tree.attachNode = focusNodeWindow._parent;
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

        trackCurrentWindows() {
            let windowsAll = this.windowsAllWorkspaces;
            for (let i = 0; i < windowsAll.length; i++) {
                this.trackWindow(global.display, windowsAll[i]);
            }
            Logger.debug(`track-current-windows`);
        }

        _validWindow(metaWindow) {
            return metaWindow.get_window_type() === Meta.WindowType.NORMAL ||
                metaWindow.get_window_type() === Meta.WindowType.DIALOG ||
                metaWindow.get_window_type() === Meta.WindowType.MODAL_DIALOG;
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
                let parentNode = nodeWindow._parent;
                // If parent has only this window, remove the parent instead
                if (parentNode._nodes.length === 1 && parentNode._type !==
                    Tree.NODE_TYPES.MONITOR) {
                    let existParent = parentNode._parent;
                    this._tree.removeNode(parentNode);
                    if (this._tree.getTiledChildren(existParent._nodes).length === 0) {
                        existParent.percent = 0.0;
                        this._tree.resetSiblingPercent(existParent._parent);
                    }
                    this._tree.resetSiblingPercent(existParent);
                } else {
                    let existParent = nodeWindow._parent;
                    this._tree.removeNode(nodeWindow);
                    if (this._tree.getTiledChildren(existParent._nodes).length === 0) {
                        existParent.percent = 0.0;
                        this._tree.resetSiblingPercent(existParent._parent);
                    }
                    this._tree.resetSiblingPercent(existParent);
                }
                Logger.debug(`window destroyed ${nodeWindow._data.get_wm_class()}`);
                this.renderTree("window-destroy");
            }

            // find the next attachNode here
            let focusNodeWindow = this._tree.findNode(this.focusMetaWindow);
            if (focusNodeWindow) {
                this._tree.attachNode = focusNodeWindow._parent;
                Logger.trace(`on-destroy: finding next attach node ${this._tree.attachNode._type}`);
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
                    if (existNodeWindow._parent && metaMonWsNode) {
                        // Uses the existing workspace, monitor that the metaWindow
                        // belongs to.
                        let containsWindow = this._tree.findNodeWindowFrom(existNodeWindow, metaMonWsNode);
                        if (!containsWindow) {
                            Logger.warn("window is not in same monitor-workspace");
                            // handle cleanup of resize percentages
                            let existParent = existNodeWindow._parent;
                            this._tree.removeNode(existNodeWindow);
                            this._tree.resetSiblingPercent(existParent);
                            let movedNodeWindow = this._tree.addNode(metaMonWs,
                                Tree.NODE_TYPES.WINDOW, metaWindow);
                            movedNodeWindow.mode = existNodeWindow.mode;
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
                this.renderTree(`${from}`);
            }

            let focusNodeWindow = this.findNodeWindow(focusWindow);
            if (!focusNodeWindow) return;
            this.showBorderFocusWindow();

            if (focusNodeWindow.grabbed) {
                let grabOp = global.display.get_grab_op();
                let orientation = Utils.orientationFromGrab(grabOp);
                let parentNodeForFocus = focusNodeWindow._parent;
                let position = Utils.positionFromGrabOp(grabOp);
                // normalize the rect without gaps
                let currentRect = Utils.removeGapOnRect(
                    focusWindow.get_frame_rect(), this.calculateGaps()); 
                let firstRect;
                let secondRect;
                let parentRect;

                let resizePairForWindow = focusNodeWindow.resizePairForWindow;
                let sameParent = resizePairForWindow ?
                    resizePairForWindow._parent === focusNodeWindow._parent : false;
                if (orientation === Tree.ORIENTATION_TYPES.HORIZONTAL) {
                    if (sameParent) {
                        // use the window or con pairs
                        if (this._tree.getTiledChildren(parentNodeForFocus._nodes).length <= 1) {
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
                            if (this._tree.getTiledChildren(resizePairForWindow._parent._nodes).length <= 1) {
                                Logger.warn(`not valid for resize`);
                                return;
                            }
                            let firstWindowRect = focusNodeWindow.initRect;
                            let index = this._tree._findNodeIndex(resizePairForWindow._parent._nodes, resizePairForWindow);
                            if (position === Tree.POSITION.BEFORE) {
                                // Find the opposite node
                                index = index + 1;
                            } else {
                                index = index - 1;
                            }
                            parentNodeForFocus = resizePairForWindow._parent._nodes[index];
                            firstRect = parentNodeForFocus.rect;
                            secondRect = resizePairForWindow.rect;
                            if (!firstRect || !secondRect) {
                                Logger.warn(`first and second rect pairs not available`);
                                return;
                            }

                            parentRect = parentNodeForFocus._parent.rect;
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
                        if (this._tree.getTiledChildren(parentNodeForFocus._nodes).length <= 1) {
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
                            if (this._tree.getTiledChildren(resizePairForWindow._parent._nodes).length <= 1) {
                                Logger.warn(`not valid for resize`);
                                return;
                            }
                            let firstWindowRect = focusNodeWindow.initRect;
                            let index = this._tree._findNodeIndex(resizePairForWindow._parent._nodes, resizePairForWindow);
                            if (position === Tree.POSITION.BEFORE) {
                                // Find the opposite node
                                index = index + 1;
                            } else {
                                index = index - 1;
                            }
                            parentNodeForFocus = resizePairForWindow._parent._nodes[index];
                            firstRect = parentNodeForFocus.rect;
                            secondRect = resizePairForWindow.rect;
                            if (!firstRect || !secondRect) {
                                Logger.warn(`first and second rect pairs not available`);
                                return;
                            }

                            parentRect = parentNodeForFocus._parent.rect;
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

        minimizedWindow(node) {
            if (!node) return false;
            return (node._type === Tree.NODE_TYPES.WINDOW
                && node._data
                && node._data.minimized);
        }
    }
);

