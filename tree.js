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
const Utils = Me.imports.utils;
const WindowManager = Me.imports.windowManager;

var NODE_TYPES = Utils.createEnum([
    'MONITOR',
    'NONE',
    'ROOT',
    'SPLIT',
    'WINDOW',
    'WORKSPACE',
]);

var SPLIT_ORIENTATION = Utils.createEnum([
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
        _init(workspace, forgeWm) {
            super._init();
            this._workspace = workspace;
            this._forgeWm = forgeWm;
            this._currentMonitor = workspace.get_display().get_current_monitor();
            let workspaceArea = this._workspace.
                get_work_area_for_monitor(this._currentMonitor);

            // TODO, this will be useful later on as an overlay
            this._rootBin = new St.Bin();
            this._rootBin.set_position(workspaceArea.x, workspaceArea.y);
            this._rootBin.set_size(workspaceArea.width, workspaceArea.height);
            this._rootBin.show();

            global.window_group.add_child(this._rootBin);

            this._root = new Node(NODE_TYPES['ROOT'], this._rootBin);
            this._root._splitOrientation = SPLIT_ORIENTATION['HSPLIT'];
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

        // The depth of a node is the number of edges
        // from the root to the node.
        getDepthOf(node) {
            // TODO get the depth of a node
        }

        // The height of a node is the number of edges
        // from the node to the deepest leaf.
        getHeightOf(node) {
            // TODO get the height of a node
        }

        _getShownChildren(items) {
            let filterFn = (nodeWindow) => {
                if (nodeWindow._type === NODE_TYPES['WINDOW']) {
                    let floating = nodeWindow.mode === WindowManager.WINDOW_MODES['FLOAT'];
                    if (!nodeWindow._data.minimized && !floating) {
                        return true;
                    }
                }
                return false;
            };

            return items.filter(filterFn);
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
            Logger.debug(`render tree # ${this._workspace.index()}`);
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

                        let shownChildren = this._getShownChildren(parentNode._children);
                        let numChild = shownChildren.length;
                        let floating = node.mode === WindowManager.WINDOW_MODES['FLOAT'];
                        Logger.debug(`  mode: ${node.mode.toLowerCase()}, grabop ${node._grabOp}`);
                        if (numChild === 0 || floating) return;
                        
                        let childIndex = this._findNodeIndex(
                            shownChildren, node);
                        
                        let splitDirection = parentNode._splitOrientation;
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

                        let gap = 8;

                        nodeX += gap;
                        nodeY += gap;
                        nodeWidth -= gap * 2;
                        nodeHeight -= gap * 2;

                        Logger.debug(`  x: ${nodeX}, y: ${nodeY}, h: ${nodeHeight}, w: ${nodeWidth}`);

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
        _traverseBreadthFirst(callback, startNode) {
            let queue = new Queue();
            let beginNode = startNode ? startNode : this._root;
            queue.enqueue(beginNode);

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
        _traverseDepthFirst(callback, startNode) {
            let recurse = (currentNode) => {
                for (let i = 0, length = currentNode._children.length; i < length; i++) {
                    recurse(currentNode._children[i]);
                }

                callback(currentNode);
            };
            let beginNode = startNode ? startNode : this._root;
            recurse(beginNode);
        }

        _walk(callback, traversal) {
            traversal.call(this, callback);
        }

        _walkFrom(node, callback, traversal) {
            traversal.call(this, callback, node);
        }
    }
);

