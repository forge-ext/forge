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
const createEnum = Me.imports.utils.createEnum;

const NODE_TYPES = createEnum([
    'MONITOR',
    'NONE',
    'ROOT',
    'SPLIT',
    'WINDOW',
    'WORKSPACE',
]);

const SPLIT_ORIENTATION = createEnum([
    'HSPLIT',
    'VSPLIT',
]);

var Node = GObject.registerClass(
    class Node extends GObject.Object {
        /**
         * data: GObject.Object
         */
        _init(type, data) {
            super._init();
            this._type = type;
            this._data = data;
            this._parent = null;
            this._children = [];

            if (this._type === NODE_TYPES['WINDOW']) {
                this._actor = this._data.get_compositor_private();
            }
        }
    }
);

var Queue = GObject.registerClass(
    class Queue extends GObject.Object {
        _init() {
            super._init();
            this._elements = [];
        }

        enqueue(item) {
            this._elements.push(item);
        }

        dequeue() {
            return this._elements.shift();
        }
    }
);

var Tree = GObject.registerClass(
    class Tree extends GObject.Object {
        _init() {
            super._init();
            let workspaceManager = global.workspace_manager; 
            let activeWorkspace = workspaceManager.get_active_workspace();
            let currentMonitor = global.display.get_current_monitor();
            // Note, this is the workarea disregarding any visible panels
            // Use Meta.Window.get_work_area_current_monitor() to calculate panel adjustments
            let workspaceArea = activeWorkspace.get_work_area_for_monitor(currentMonitor);

            // TODO, this will be useful later on as an overlay
            this._rootBin = new St.Bin();
            this._rootBin.set_position(workspaceArea.x, workspaceArea.y);
            this._rootBin.set_size(workspaceArea.width, workspaceArea.height);
            this._rootBin.show();

            global.window_group.add_child(this._rootBin);

            this._root = new Node(NODE_TYPES['ROOT'], this._rootBin);
        }

        addNode(toNode, type, data) {
            let parentNode = this.findNode(toNode);
            let child;

            if (parentNode) {
                child = new Node(type, data);
                parentNode._children.push(child);
                child._parent = parentNode;
            }
            return child;
        }


        findNode(data) {
            let searchNode;
            let criteriaMatchFn = (node) => {
                if (node._data === data) {
                    searchNode = node;
                }
            };

            this._walk(criteriaMatchFn, this._traverseBreadthFirst);

            return searchNode;
        }

        findNodeByActor(dataActor) {
            let searchNode;
            let criteriaMatchFn = (node) => {
                if (node._type === NODE_TYPES['WINDOW'] && 
                    node._actor === dataActor) {
                    searchNode = node;
                }
            };

            this._walk(criteriaMatchFn, this._traverseDepthFirst);

            return searchNode;
        }

        _findNodeIndex(items, node) {
            let index;

            for (let i = 0; i < items.length; i++) {
                let nodeItem = items[i];
                if (nodeItem._data === node._data) {
                    index = i;
                    break;
                }
            }

            return index;
        }

        removeNode(fromNode, node) {
            let parentNode = this.findNode(fromNode);
            let nodeToRemove = null;
            let nodeIndex;

            if (parentNode) {
                nodeIndex = this._findNodeIndex(parentNode._children, node);

                if (nodeIndex === undefined) {
                    // do nothing
                } else {
                    // TODO re-adjust the children to the next sibling
                    nodeToRemove = parentNode._children.splice(nodeIndex, 1);
                }
            }

            return nodeToRemove;
        }

        render() {
            Logger.debug(`render tree`);
            let fwm = this._forgeWm;
            let criteriaFn = (node) => {
                if (node._type === NODE_TYPES['WINDOW']) {
                    Logger.debug(` window: ${node._data.get_wm_class()}`);

                    let parentNode = node._parent;
                    let parentRect;

                    // It is possible that the node might be detached from the tree
                    // TODO: if there is no parent, use the current window's workspace?
                    // Or the window can be considered as floating?
                    if (parentNode) {
                        if (parentNode._type === NODE_TYPES['ROOT']) {
                            // Meta.Window.get_work_area_current_monitor() 
                            // works well with panels
                            parentRect = node._data.
                                get_work_area_current_monitor();
                        }

                        let numChild = parentNode._children.length;
                        if (numChild === 0) return; // prevent noop

                        let childIndex = this._findNodeIndex(
                            parentNode._children, node);
                        // TODO: obtain the split direction from the parent
                        let splitDirection = SPLIT_ORIENTATION['HSPLIT'];
                        let splitHorizontally = splitDirection === 
                             SPLIT_ORIENTATION['HSPLIT'];
                        let nodeWidth;
                        let nodeHeight;
                        let nodeX;
                        let nodeY;

                        if (splitHorizontally) {
                            // Divide the parent container's width 
                            // depending on number of children. And use this
                            // to setup each child window's width.
                            nodeWidth = Math.floor(parentRect.width / numChild);
                            nodeHeight = parentRect.height;
                            nodeX = parentRect.x + (childIndex * nodeWidth);
                            nodeY = parentRect.y;
                            Logger.debug(`  direction: h-split`);
                        } else { // split vertically
                            nodeWidth = parentRect.width;
                            // Conversely, divide the parent container's height 
                            // depending on number of children. And use this
                            // to setup each child window's height.
                            nodeHeight = Math.floor(parentRect.height / numChild);
                            nodeX = parentRect.x;
                            nodeY = parentRect.y + (childIndex * nodeHeight);
                            Logger.debug(` direction: v-split`);
                        }

                        Logger.debug(`  x: ${nodeX}, y: ${nodeY}, h: ${nodeHeight}, w: ${nodeWidth}`);

                        // TODO: GLib.idle_add() can be used too. Make this
                        // configurable.
                        GLib.timeout_add(GLib.PRIORITY_LOW, 60, () => {
                            fwm.move(node._data, {x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight});
                            return false;
                        });

                    }

                } else if (node._type === NODE_TYPES['ROOT']) {
                    Logger.debug(` root`);
                } else if (node._type === NODE_TYPES['SPLIT']) {
                    Logger.debug(` split`);
                }
            };

            this._walk(criteriaFn, this._traverseBreadthFirst);
            Logger.debug(`render end`);
            Logger.debug(`--------------------------`);
        }

        // start walking from root and all child nodes
        _traverseBreadthFirst(callback) {
            let queue = new Queue();
            queue.enqueue(this._root);

            let currentNode = queue.dequeue();

            while(currentNode) {
                for (let i = 0, length = currentNode._children.length; i < length; i++) {
                    queue.enqueue(currentNode._children[i]);
                }

                callback(currentNode);
                currentNode = queue.dequeue();
            }
        }

        // start walking from bottom to root
        _traverseDepthFirst(callback) {
            let recurse = (currentNode) => {
                for (let i = 0, length = currentNode._children.length; i < length; i++) {
                    recurse(currentNode._children[i]);
                }

                callback(currentNode);
            };
            recurse(this._root);
        }

        _walk(callback, traversal) {
            traversal.call(this, callback);
        }
    }
);

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init() {
            super._init();
            // TODO, create trees per workspace
            this._tree = new Tree();
            this._tree._forgeWm = this;
            Logger.info("Forge initialized");
        }

        command(action) {

        }

        enable() {
            this._bindSignals();
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
                display.connect("grab-op-end", (_display, _metaWindow, _grabOp) => {
                    this._tree.render();
                }),
            ];

            this._signalsBound = true;
        }

        disable() {
            Logger.debug(`Disable is called`);
            this._removeSignals();
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
            this._signalsBound = false;
        }

        _windowCreate(_display, metaWindow) {
            // Make window types configurable
            if (metaWindow.get_window_type() == Meta.WindowType.NORMAL) {
                Logger.debug(`window tracked: ${metaWindow.get_wm_class()}`);

                // Add to the root split for now
                this._tree.addNode(this._tree._rootBin, NODE_TYPES['WINDOW'], 
                    metaWindow);

                let windowActor = metaWindow.get_compositor_private();
                windowActor.connect("destroy", this._windowDestroy.bind(this));
                this._tree.render();
            }
        }

        _windowDestroy(actor) {
            // Release any resources on the window
            let nodeWindow = this._tree.findNodeByActor(actor);
            if (nodeWindow) {
                Logger.debug(`window destroyed ${nodeWindow._data.get_wm_class()}`);
                this._tree.removeNode(this._tree._rootBin, nodeWindow);
                this._tree.render();
            }                
        }
    }
);

