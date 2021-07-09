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

const WINDOW_MODES = Utils.createEnum([
    "FLOAT",
    "TILE",
    "LAYOUT",
]);

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init() {
            super._init();
            // TODO, create trees per workspace
            this._trees = [];
            let workspaceManager = global.workspace_manager;
            let numWorkspace = workspaceManager.get_n_workspaces() - 1; 
            for (let i = 0; i < numWorkspace; i++) {
                let workspace = workspaceManager.get_workspace_by_index(i);
                let tree = new Tree.Tree(workspace, this);
                this._trees.push(tree);
            }

            Logger.info("Forge initialized");
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
                display.connect("window-created", this._windowCreate.
                    bind(this)),
                display.connect("grab-op-end", (_, _display, metaWindow, _grabOp) => {
                    Logger.debug(`grab op end`);
                    let nodeWindow = this._findNodeWindow(metaWindow);
                    if (nodeWindow) {
                        let renderGrabEvent = !nodeWindow._dragEdgeTiled;
                        if (renderGrabEvent) {
                            let tree = this._findTreeForMetaWindow(metaWindow);
                            if (tree) tree.render();
                        } else {
                            nodeWindow._dragEdgeTiled = null;
                        }
                    }
                }),
                display.connect("grab-op-begin", (_display, _metaWindow, _grabOp) => {
                    Logger.debug(`grab op begin`);
                }),
                display.connect("showing-desktop-changed", (_display) => {
                    Logger.debug(`showing desktop changed`);
                    this.renderTrees();
                }),
                display.connect("workareas-changed", (_display) => {
                    Logger.debug(`workareas changed`);
                    this.renderTrees();
                }),
            ];

            this._windowManagerSignals = [
                shellWm.connect("minimize", () => {
                    Logger.debug(`minimize`);
                    this.renderTrees();
                }),
                shellWm.connect("unminimize", () => {
                    Logger.debug(`unminimize`);
                    this.renderTrees();
                }),
                shellWm.connect("show-tile-preview", (_, metaWindow, _rect, _num) => {
                    // Triggered when dragging window on edges
                    Logger.debug(`show-tile-preview`);
                    let nodeWindow = this._findNodeWindow(metaWindow);
                    if (nodeWindow) nodeWindow._dragEdgeTiled = true;
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
                    this.renderTrees();
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
            this.renderTrees();
        }

        _findNodeWindow(metaWindow) {
            let nodeWindow;

            for (let i = 0, length = this._trees.length; i < length; i++) {
                let tree = this._trees[i];
                nodeWindow = tree.findNode(metaWindow);
                if (nodeWindow) return nodeWindow;
            }
        }

        _findTreeForMetaWindow(metaWindow) {
            for (let i = 0, length = this._trees.length; i < length; i++) {
                let tree = this._trees[i];
                let nodeWindow = tree.findNode(metaWindow);
                if (nodeWindow) return tree;
            }
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

        renderTrees() {
            this._trees.forEach((tree) => {
                tree.render();
            });
        }

        _windowCreate(_display, metaWindow) {
            Logger.debug(`window-created`);
            let tree;

            for (let i = 0; i < this._trees.length; i++) {
                if (metaWindow.get_workspace() === this._trees[i]._workspace) {
                    tree = this._trees[i];
                    break;
                }
            }

            // Make window types configurable
            if (metaWindow.get_window_type() == Meta.WindowType.NORMAL) {
                Logger.debug(`window tracked: ${metaWindow.get_wm_class()}`);

                // Add to the root split for now
                let nodeWindow = tree.addNode(tree._rootBin, Tree.NODE_TYPES['WINDOW'], 
                    metaWindow);
                // default to tile mode
                nodeWindow.mode = WINDOW_MODES['TILE'];

                let windowActor = metaWindow.get_compositor_private();
                windowActor.connect("destroy", this._windowDestroy.bind(this));
                tree.render();
            }
        }

        _windowDestroy(actor) {
            Logger.debug(`destroy`);
            // Release any resources on the window
            let nodeWindow;
            for (let i = 0; i < this._trees.length; i++) {
                let tree = this._trees[i];
                nodeWindow = tree.findNodeByActor(actor);
                if (nodeWindow) {
                    tree.removeNode(tree._rootBin, nodeWindow);
                    Logger.debug(`window destroyed ${nodeWindow._data.get_wm_class()}`);
                    tree.render();
                    break;
                }                
            }
        }
    }
);

