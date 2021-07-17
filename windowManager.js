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

// Gnome imports
const Clutter = imports.gi.Clutter;
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
    'LAYOUT',
]);

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init() {
            super._init();
            this._tree = new Tree.Tree(this);
            Logger.info("forge initialized");
        }

        _applyNodeWindowMode(action, metaWindow) {
            let nodeWindow = this._findNodeWindow(metaWindow);
            if (!nodeWindow || !(action || action.mode)) return;
            if (nodeWindow._type !== Tree.NODE_TYPES['WINDOW']) return;

            let floatFlag = action.mode === WINDOW_MODES['FLOAT'];

            if (floatFlag) {
                let floating = nodeWindow.mode === WINDOW_MODES['FLOAT'];
                if (!floating) {
                    nodeWindow.mode = WINDOW_MODES['FLOAT'];
                } else {
                    nodeWindow.mode = WINDOW_MODES['TILE'];
                }
            } else {
                nodeWindow.mode = WINDOW_MODES['TILE'];
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
                display.connect("window-created", this._trackWindow.bind(this)),
                display.connect("window-entered-monitor", this._updateMetaWorkspaceMonitor.bind(this)),
                display.connect("grab-op-end", (_, _display, _metaWindow, _grabOp) => {
                    this.unfreezeRender();
                    if (this.focusMetaWindow && this.focusMetaWindow.get_maximized() === 0) {
                        this.renderTree();
                    }
                    Logger.debug(`grab op end`);
                }),
                display.connect("grab-op-begin", (_, _display, metaWindow, grabOp) => {
                    this.freezeRender();
                    let nodeWindow = this._findNodeWindow(metaWindow);
                    if (nodeWindow) nodeWindow._grabOp = grabOp;
                    Logger.debug(`grab op begin ${grabOp}`);
                }),
                display.connect("workareas-changed", (_display) => {
                    Logger.debug(`workareas changed`);
                    this.renderTree();
                }),
            ];

            this._windowManagerSignals = [
                shellWm.connect("minimize", () => {
                    this.renderTree();
                    Logger.debug(`minimize`);
                }),
                shellWm.connect("unminimize", () => {
                    this.renderTree();
                    Logger.debug(`unminimize`);
                }),
                shellWm.connect("show-tile-preview", (_, _metaWindow, _rect, _num) => {
                    Logger.debug(`show-tile-preview`);
                }),
            ];

            const globalWsm = global.workspace_manager;

            this._workspaceManagerSignals = [
                globalWsm.connect("workspace-added", (_, wsIndex) => {
                    this._tree.addWorkspace(wsIndex);
                    Logger.debug(`workspace-added ${wsIndex}`);
                }),
                globalWsm.connect("workspace-removed", (_, wsIndex) => {
                    this._tree.removeWorkspace(wsIndex);
                    Logger.debug(`workspace-removed ${wsIndex}`);
                }),
            ];

            this._signalsBound = true;
        }

        command(action) {
            let focusWindow = this.focusMetaWindow;

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
                    this.renderTree();
                    break;
                default:
                    break;
            }
        }

        disable() {
            Logger.debug(`Disable is called`);
            this._removeSignals();
        }

        enable() {
            this._bindSignals();
            this.renderTree();
        }

        _findNodeWindow(metaWindow) {
            let nodeWindow;
            let tree = this._tree;
            nodeWindow = tree.findNode(metaWindow);
            if (nodeWindow) return nodeWindow;
        }

        _findTreeForMetaWindow(metaWindow) {
            let tree = this._tree;
            let nodeWindow = tree.findNode(metaWindow);
            if (nodeWindow) return tree;
        }

        get focusMetaWindow() {
            return global.display.get_focus_window();
        }

        get focusNodeWindow() {
            return this._findNodeWindow(this.focusMetaWindow);
        }

        get windows() {
            let wsManager = global.workspace_manager;
            // TODO: make it configurable
            return global.display.get_tabs_list(Meta.TabList.NORMAL_ALL,
                wsManager.get_active_workspace());
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
            }

            if (this._windowManagerSignals) {
                for (const windowManagerSignal of this._windowManagerSignals) {
                    global.window_manager.disconnect(windowManagerSignal);
                }
            }

            this._signalsBound = false;
        }

        renderTree() {
            if (this._freezeRender) {
                Logger.debug(`render frozen`);
                return;
            }
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                this._tree.render();
            });
        }

        _trackWindow(_display, metaWindow) {
            // Make window types configurable
            if (this._validWindow(metaWindow)) {
                let existNodeWindow = this._tree.findNode(metaWindow);
                if (existNodeWindow) return;
                
                metaWindow.connect("workspace-changed", (metaWindowWs) => {
                    this._updateMetaWorkspaceMonitor(global.display, metaWindowWs.get_monitor(), metaWindowWs);
                    Logger.debug(`workspace-changed ${metaWindowWs.get_wm_class()}`);
                });
                metaWindow.connect("position-changed", (metaWindowPos) => {
                    if (this.focusMetaWindow && this.focusMetaWindow.get_maximized() === 0) {
                        this.renderTree();
                    }
                    Logger.debug(`position-changed ${metaWindowPos.get_wm_class()}`);
                });

                let metaMonWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
                let monitorNode = this._tree.findNode(metaMonWs);
                if (!monitorNode) return;
                let newNodeWindow = this._tree.addNode(monitorNode._data, Tree.NODE_TYPES['WINDOW'], 
                    metaWindow);
                // default to tile mode
                newNodeWindow.mode = WINDOW_MODES['TILE'];

                let windowActor = metaWindow.get_compositor_private();
                windowActor.connect("destroy", this._windowDestroy.bind(this));

                Logger.debug(`window tracked: ${metaWindow.get_wm_class()}`);
                Logger.debug(` on workspace: ${metaWindow.get_workspace().index()}`);
                Logger.debug(` on monitor: ${metaWindow.get_monitor()}`);
            } 
        }

        _validWindow(metaWindow) {
            return metaWindow.get_window_type() == Meta.WindowType.NORMAL;
        }

        _windowDestroy(actor) {
            // Release any resources on the window
            let nodeWindow;
            nodeWindow = this._tree.findNodeByActor(actor);
            if (nodeWindow) {
                this._tree.removeNode(nodeWindow._parent._data, nodeWindow);
                Logger.debug(`window destroyed ${nodeWindow._data.get_wm_class()}`);
                this.renderTree();
            }                
            Logger.debug(`window-destroy`);
        }

        _updateMetaWorkspaceMonitor(_, monitor, metaWindow) {
            if (this._validWindow(metaWindow)) {
                if (metaWindow.get_workspace() === null) return;
                let existNodeWindow = this._tree.findNode(metaWindow);
                let metaMonWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`; 
                let metaMonWsNode = this._tree.findNode(metaMonWs);
                if (existNodeWindow) {
                    // check if meta in correct ws and monitor
                    if (existNodeWindow._parent && metaMonWsNode) {
                        Logger.debug(`window-monitorWorkspace:${metaMonWs}`);
                        Logger.debug(`parent-monitorWorkspace:${existNodeWindow._parent._data}`);
                        if (existNodeWindow._parent._data !== metaMonWs) {
                            this._tree.removeNode(existNodeWindow._parent._data, existNodeWindow);
                            let movedNodeWindow = this._tree.addNode(metaMonWs, Tree.NODE_TYPES['WINDOW'], metaWindow);
                            movedNodeWindow.mode = existNodeWindow.mode;
                        }
                    }
                }
                Logger.debug(`window-entered-monitor: ${metaWindow.get_wm_class()}`);
                Logger.debug(` on workspace: ${metaWindow.get_workspace().index()}`);
                Logger.debug(` on monitor: ${monitor} `);
            }
            this.renderTree();
        }

        freezeRender() {
            this._freezeRender = true;
        }

        unfreezeRender() {
            this._freezeRender = false;
        }
    }
);

