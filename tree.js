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
const Window = Me.imports.window;

var NODE_TYPES = Utils.createEnum([
    'ROOT',
    'MONITOR', //Output in i3
    'CON', //Container in i3
    'WINDOW',
    'WORKSPACE',
]);

var LAYOUT_TYPES = Utils.createEnum([
    'STACK',
    'TABS',
    'ROOT',
    'HSPLIT',
    'VSPLIT',
    'PRESET',
]);

/**
 * The Node data representation of the following elements in the user's display:
 *
 * Monitor,
 * Window,
 * Container (generic),
 * Workspace
 *
 */
var Node = GObject.registerClass(
    class Node extends GObject.Object {
        _init(type, data) {
            super._init();
            // TODO - move to GObject property definitions?
            this._type = type; // see NODE_TYPES
            // _data: Meta.Window, unique id strings (Monitor,
            // Workspace or St.Bin - a representation of Container)
            this._data = data; 
            this._parent = null;
            this._nodes = []; // Child elements of this node
            this._floats = []; // handle the floating window children of this node

            if (this._type === NODE_TYPES['WINDOW']) {
                this._actor = this._data.get_compositor_private();
            }
        }
    }
);

/**
 * An implementation of Queue using arrays
 */
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
        _init(forgeWm) {
            super._init();
            this._forgeWm = forgeWm;

            // Attach the root node
            let rootBin = new St.Bin();
            rootBin.show();
            this._root = new Node(NODE_TYPES['ROOT'], rootBin);
            this._root.layout = LAYOUT_TYPES['ROOT'];
            global.window_group.add_child(rootBin);

            this._initWorkspaces();
        }

        /**
         * Handles new and existing workspaces in the tree
         */
        _initWorkspaces() {
            let wsManager = global.display.get_workspace_manager();
            let workspaces = wsManager.get_n_workspaces();
            for (let i = 0; i < workspaces; i++) {
                this.addWorkspace(i);
            }
            Logger.debug(`initialized workspaces: ${workspaces}`);
        }

        // TODO move to monitor.js
        addMonitor(workspaceNodeData) {
            let monitors = global.display.get_n_monitors();
            for (let mi = 0; mi < monitors; mi++) {
                let monitorWsNode = this.addNode(workspaceNodeData, NODE_TYPES['MONITOR'], `mo${mi}${workspaceNodeData}`);
                monitorWsNode.layout = LAYOUT_TYPES['HSPLIT'];
            }
            Logger.debug(`initialized monitors: ${monitors}`);
        }

        // TODO move to workspace.js
        addWorkspace(wsIndex) {
            let wsManager = global.display.get_workspace_manager();
            let workspaceNodeData = `ws${wsIndex}`;

            let existingWsNode = this.findNode(workspaceNodeData);
            if (existingWsNode) {
                Logger.debug(`workspace-node ${workspaceNodeData} already exists`);
                return false;
            }

            Logger.debug(`adding workspace: ${workspaceNodeData}`);

            let newWsNode = this.addNode(this._root._data, NODE_TYPES['WORKSPACE'], workspaceNodeData);
            let workspace = wsManager.get_workspace_by_index(wsIndex);
            newWsNode.layout = LAYOUT_TYPES['HSPLIT'];

            this._forgeWm.bindWorkspaceSignals(workspace);
            this.addMonitor(workspaceNodeData);

            return true;
        }

        // TODO move to workspace.js
        removeWorkspace(wsIndex) {
            let workspaceNodeData = `ws${wsIndex}`;
            let existingWsNode = this.findNode(workspaceNodeData);
            Logger.debug(`removing workspace: ${workspaceNodeData}`);
            if (!existingWsNode) {
                Logger.debug(`workspace-node ${workspaceNodeData} does not exist`);
                return false;
            }
            this.removeNode(this._root._data, existingWsNode);
            return true;
        }

        get nodeWorkpaces() {
            let nodeWorkspaces = [];
            let criteriaMatchFn = (node) => {
                if (node._type === NODE_TYPES['WORKSPACE']) {
                    nodeWorkspaces.push(node);
                }
            }

            this._walkFrom(this._root, criteriaMatchFn, this._traverseBreadthFirst);
            return nodeWorkspaces;
        }

        get nodeWindows() {
            let nodeWindows = [];
            let criteriaMatchFn = (node) => {
                if (node._type === NODE_TYPES['WINDOW']) {
                    nodeWindows.push(node);
                }
            }

            this._walkFrom(this._root, criteriaMatchFn, this._traverseBreadthFirst);
            return nodeWindows;
        }

        addNode(toData, type, data) {
            let parentNode = this.findNode(toData);
            let child;

            if (parentNode) {
                child = new Node(type, data);
                parentNode._nodes.push(child);
                child._parent = parentNode;
            }
            return child;
        }

        /**
         * Finds any Node in the tree using data
         * Data types can be in the form of Meta.Window or unique id strings
         * for Workspace, Monitor and Container
         *
         * Workspace id strings takes the form `ws{n}`.
         * Monitor id strings takes the form `mo{m}ws{n}`
         * Container id strings takes the form `mo{m}ws{n}c{x}`
         *
         */
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

        /**
         * Find the NodeWindow using the Meta.WindowActor
         */
        findNodeByActor(windowActor) {
            let searchNode;
            let criteriaMatchFn = (node) => {
                if (node._type === NODE_TYPES['WINDOW'] && 
                    node._actor === windowActor) {
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

        /**
         * Obtains the non-floating, non-minimized list of nodes
         */
        getTiledChildren(items) {
            let filterFn = (nodeWindow) => {
                if (nodeWindow._type === NODE_TYPES['WINDOW']) {
                    let floating = nodeWindow.mode === Window.WINDOW_MODES['FLOAT'];
                    // A Node[Window]._data is a Meta.Window
                    if (!nodeWindow._data.minimized && !floating) {
                        return true;
                    }
                }
                return false;
            };

            return items.filter(filterFn);
        }

        removeNode(fromData, node) {
            let parentNode = this.findNode(fromData);
            let nodeToRemove = null;
            let nodeIndex;

            if (parentNode) {
                nodeIndex = this._findNodeIndex(parentNode._nodes, node);
                if (nodeIndex === undefined) {
                    // do nothing
                } else {
                    nodeToRemove = parentNode._nodes.splice(nodeIndex, 1);
                }
            }

            return nodeToRemove;
        }

        render(from) {
            Logger.debug(`render tree ${from ? "from " + from : ""}`);
            let fwm = this._forgeWm;
            let criteriaFn = (node) => {
                // TODO move the WINDOW rendering to a new function
                if (node._type === NODE_TYPES['WINDOW']) {
                    Logger.debug(` window: ${node._data.get_wm_class()}`);

                    let parentNode = node._parent;
                    let windowRect;

                    if (parentNode) {
                        let monitor = node._data.get_monitor();
                        if (monitor < 0) return;
                        // TODO, Node Window's parent can be a Monitor or
                        // a Container
                        windowRect = node._data.get_work_area_for_monitor(monitor);

                        let shownChildren = this.getTiledChildren(parentNode._nodes);
                        let numChild = shownChildren.length;
                        let floating = node.mode === Window.WINDOW_MODES['FLOAT'];
                        Logger.debug(`  mode: ${node.mode.toLowerCase()}, grabop ${node._grabOp}`);
                        Logger.debug(`  meta-workspace: ${node._data.get_workspace()? node._data.get_workspace().index() : null}`);
                        Logger.debug(`  meta-monitor: ${monitor}`);
                        Logger.debug(`  parent-monitor-workspace: ${parentNode._data}`);
                        if (numChild === 0 || floating) return;
                        
                        let childIndex = this._findNodeIndex(
                            shownChildren, node);
                        
                        let layout = parentNode.layout;
                        let splitHorizontally = layout === LAYOUT_TYPES['HSPLIT'];
                        let nodeWidth;
                        let nodeHeight;
                        let nodeX;
                        let nodeY;

                        if (splitHorizontally) {
                            // Divide the parent container's width 
                            // depending on number of children. And use this
                            // to setup each child window's width.
                            nodeWidth = Math.floor(windowRect.width / numChild);
                            nodeHeight = windowRect.height;
                            nodeX = windowRect.x + (childIndex * nodeWidth);
                            nodeY = windowRect.y;
                            Logger.debug(`  direction: h-split`);
                        } else { // split vertically
                            nodeWidth = windowRect.width;
                            // Conversely, divide the parent container's height 
                            // depending on number of children. And use this
                            // to setup each child window's height.
                            nodeHeight = Math.floor(windowRect.height / numChild);
                            nodeX = windowRect.x;
                            nodeY = windowRect.y + (childIndex * nodeHeight);
                            Logger.debug(` direction: v-split`);
                        }

                        // TODO make the gap configurable
                        let gap = 8;

                        nodeX += gap;
                        nodeY += gap;
                        nodeWidth -= gap * 2;
                        nodeHeight -= gap * 2;

                        Logger.debug(`  x: ${nodeX}, y: ${nodeY}, h: ${nodeHeight}, w: ${nodeWidth}`);

                        fwm.move(node._data, {x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight});
                    }

                } else if (node._type === NODE_TYPES['ROOT']) {
                    Logger.debug(` root`);
                } else if (node._type === NODE_TYPES['CON']) {
                    Logger.debug(` container`);
                }
            };

            this._walk(criteriaFn, this._traverseBreadthFirst);
            Logger.debug(`workspaces: ${this.nodeWorkpaces.length}`);
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
                for (let i = 0, length = currentNode._nodes.length; i < length; i++) {
                    queue.enqueue(currentNode._nodes[i]);
                }

                callback(currentNode);
                currentNode = queue.dequeue();
            }
        }

        // start walking from bottom to root
        _traverseDepthFirst(callback, startNode) {
            let recurse = (currentNode) => {
                for (let i = 0, length = currentNode._nodes.length; i < length; i++) {
                    recurse(currentNode._nodes[i]);
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

