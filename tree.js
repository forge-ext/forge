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
const Settings = Me.imports.settings;
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

var ORIENTATION_TYPES = Utils.createEnum([
    'NONE',
    'HORIZONTAL',
    'VERTICAL',
]);

var POSITION = Utils.createEnum([
    'BEFORE',
    'AFTER',
    'UNKNOWN',
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
            this.mode = Window.WINDOW_MODES['TILE'];
            this.percent = 0.0;

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
            this.removeNode(existingWsNode);
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
                Logger.trace(`adding node ${type}: ${data} to ${toData}`);
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

        /**
         * Finds the NodeWindow under the Meta.Window and the
         * current pointer coordinates;
         */
        findNodeWindowAtPointer(metaWindow, pointer) {
            let nodeAtPointer;
            if (!metaWindow) return undefined;
            let monWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
            // The searched window should be on the same monitor workspace
            let monWsNode = this.findNode(monWs);

            let criteriaFn = (node) => {
                if (nodeAtPointer) return;
                if (node._data !== metaWindow &&
                    node._type === NODE_TYPES['WINDOW'] &&
                    !node._data.minimized) {
                    let metaRect = node.rect;
                    if (!metaRect) return;
                    let atPointer = Utils.rectContainsPoint(
                        metaRect, pointer);
                    if (atPointer)
                        nodeAtPointer = node;
                }
            }

            this._walkFrom(monWsNode, criteriaFn, this._traverseDepthFirst);
            return nodeAtPointer;
        }

        /**
         * Obtains the non-floating, non-minimized list of nodes
         */
        getTiledChildren(items) {
            let filterFn = (node) => {
                if (node._type === NODE_TYPES['WINDOW']) {
                    let floating = node.mode === Window.WINDOW_MODES['FLOAT'];
                    // A Node[Window]._data is a Meta.Window
                    if (!node._data.minimized && !floating) {
                        return true;
                    }
                }
                // handle split containers
                if (node._type === NODE_TYPES['CON']) {
                    return this.getTiledChildren(node._nodes).length > 0;
                }
                return false;
            };

            return items.filter(filterFn);
        }

        /**
         * Give the next sibling/parent/descendant on the tree based
         * on a given Meta.MotionDirection
         *
         * @param {Tree.Node} node
         * @param {Meta.MotionDirection} direction
         *
         * Credits: borrowed logic from tree.c of i3
         */
        next(node, direction) {
            if (!node) return null;
            let orientation = Utils.orientationFromDirection(direction);
            let position = Utils.positionFromDirection(direction);
            let horizontal = orientation === ORIENTATION_TYPES['HORIZONTAL'];
            let previous = position === POSITION['BEFORE'];
            let next;

            Logger.debug(`next:orientation ${orientation}`);
            Logger.debug(`next:position ${position}`);

            // 1. If any of these top level nodes,
            if (node._type === NODE_TYPES['ROOT'] ||
                node._type === NODE_TYPES['WORKSPACE'] ||
                node._type === NODE_TYPES['MONITOR']) {
                // TODO focus on the next node window
                Logger.trace(`next:${node._type}`);
                return null;
            }

            // Remember the current focus node window
            let prevNode = node;

            // 2. Walk through the siblings of this node
            while (node && node._type != NODE_TYPES['WORKSPACE']) {
                let nodeParent = node._parent;
                Logger.trace(`node-parent-data ${nodeParent._data}`);
                Logger.trace(`node-data ${node._data}`);

                // 2.a Handle the top level monitor siblings
                // This is to support moving focus to the next monitor available
                // based on the direction
                if (node && node._type === NODE_TYPES['MONITOR']) {
                    if (prevNode._type === NODE_TYPES['WINDOW']) {
                        let targetMonitor = global.display.
                            get_monitor_neighbor_index(prevNode._data.get_monitor(),
                                (previous ? Meta.DisplayDirection.LEFT :
                                    Meta.DisplayDirection.RIGHT));
                        Logger.trace(`next: targetMonitor ${targetMonitor}`);
                        if (targetMonitor === -1) return null;

                        let targetMoData = `mo${targetMonitor}ws${prevNode._data.get_workspace().index()}`;
                        next = this.findNode(targetMoData);
                        Logger.trace(`next:${node._type}`);
                        if (next) return next;
                    } else {
                        Logger.trace(`next:${node._type}`);
                        return null;
                    }
                }

                // 2.b Else check for the next sibling or parent
                // if the direction is opposite the parent layout,
                // go to the parent's siblings
                if (horizontal && nodeParent.layout === LAYOUT_TYPES['HSPLIT'] ||
                    !horizontal && nodeParent.layout === LAYOUT_TYPES['VSPLIT']) {
                    if (nodeParent && nodeParent._nodes && nodeParent._nodes.length > 1) {
                        let currentIndex = this._findNodeIndex(nodeParent._nodes, node);
                        let nextIndex = previous ? currentIndex - 1 : currentIndex + 1;
                        if (nextIndex !== -1 && !(nextIndex > nodeParent._nodes.length - 1)) {
                            next = nodeParent._nodes[nextIndex];
                            Logger.trace(`next:${node._type}`);
                            if (next) return next;
                        }
                    }
                }
                node = nodeParent;
            }
            Logger.trace(`next:type ${next ? next._type : "undefined"}`);
            return next;
        }

        nextVisible(node, direction) {
            if (!node) return null;
            let next = this.next(node, direction);
            if (next && next._type === NODE_TYPES['WINDOW']
                && next._data
                && next._data.minimized) {
                next = this.nextVisible(next, direction);
            }
            return next;
        }

        /**
         * Credits: i3-like split
         */
        split(node, orientation) {
            if (!node) return;
            let type = node._type;

            if (type === NODE_TYPES['WINDOW'] &&
                node.mode === Window.WINDOW_MODES['FLOAT']) {
                Logger.debug(`tree-split: cannot split ${type} that floats`);
                return;
            }

            if (!(type === NODE_TYPES['MONITOR'] ||
                type === NODE_TYPES['CON'] ||
                type === NODE_TYPES['WINDOW'])) {
                Logger.debug(`tree-split: cannot split ${type}`);
                return;
            }

            let parentNode = node._parent;
            let numChildren = parentNode._nodes.length;

            // toggle the split
            if (numChildren === 1 &&
                (parentNode.layout === LAYOUT_TYPES['HSPLIT'] ||
                parentNode.layout === LAYOUT_TYPES['VSPLIT'])) {
                parentNode.layout = orientation ===
                    ORIENTATION_TYPES['HORIZONTAL'] ?
                    LAYOUT_TYPES['HSPLIT'] : LAYOUT_TYPES['VSPLIT'];
                Logger.debug(`tree-split: toggle parent ${parentNode._type} to layout: ${parentNode.layout}`);
                this.attachNode = parentNode;
                return;
            }

            // Push down the Meta.Window into a new Container
            Logger.trace(`tree-split: parent node ${parentNode._type} ${parentNode._data}, children ${numChildren}`);
            Logger.trace(`tree-split: node ${node._data} has children? ${node._nodes.length}`);
            Logger.debug(`tree-split: pushing down ${type} ${node._data.get_wm_class()} to CON`);
            let currentIndex = this._findNodeIndex(parentNode._nodes, node);
            let container = new St.Bin();
            let newConNode = new Node(NODE_TYPES['CON'], container);
            // Take the direction of the parent
            newConNode.layout = orientation ===
                    ORIENTATION_TYPES['HORIZONTAL'] ?
                    LAYOUT_TYPES['HSPLIT'] : LAYOUT_TYPES['VSPLIT'];
            newConNode.rect = node.rect;
            newConNode.percent = node.percent;
            newConNode._parent = parentNode;
            parentNode._nodes[currentIndex] = newConNode;
            this.addNode(container, node._type, node._data);
            this.attachNode = newConNode;
            Logger.trace(`tree-split: container parent ${newConNode._parent._data} has children? ${newConNode._parent._nodes.length}`);
        }

        swap(fromNode, toNode, focus = true) {
            if (!(this._swappable(fromNode) &&
                this._swappable(toNode)))
                return;
            // Swap the items in the array
            let parentForFrom = fromNode ?
                fromNode._parent : undefined;
            let parentForTo = toNode._parent;
            if (parentForTo && parentForFrom) {
                let nextIndex = this._findNodeIndex(parentForTo._nodes, toNode);
                let focusIndex = this._findNodeIndex(parentForFrom._nodes, fromNode);
                parentForTo._nodes[nextIndex] = fromNode;
                fromNode._parent = parentForTo;
                parentForFrom._nodes[focusIndex] = toNode;
                toNode._parent = parentForFrom;
                let percent = fromNode.percent;
                fromNode.percent = toNode.percent;
                toNode.percent = percent;
                if (focus) {
                    fromNode._data.raise();
                    fromNode._data.focus(global.get_current_time());
                }
            }
        }

        _swappable(node) {
            if (!node) return false;
            if (node._type === NODE_TYPES['WINDOW'] &&
                node.mode !== Window.WINDOW_MODES['FLOAT']) {
                return true;
            }
            return false;
        }

        removeNode(node) {
            let parentNode = node._parent;
            let nodeIndex;
            let success = false;

            if (parentNode) {
                Logger.trace(`removing ${node._type} from ${parentNode._data}`);
                nodeIndex = this._findNodeIndex(parentNode._nodes, node);
                if (nodeIndex === undefined) {
                    // do nothing
                } else {
                    if (parentNode._nodes.splice(nodeIndex, 1)) {
                        success = true;
                    }
                }
            }

            if (node === this.attachNode) {
                this.attachNode = null;
            }

            return success;
        }

        render(from) {
            Logger.debug(`render tree ${from ? "from " + from : ""}`);
            // TODO - render from the current active workspace for performance
            this.renderNode(this._root);
            Logger.debug(`workspaces: ${this.nodeWorkpaces.length}`);
            Logger.debug(`render end`);
            Logger.debug(`--------------------------`);
            this.cleanTree();
        }

        cleanTree() {
            let orphanCons = [];
            let criteriaFn = (node) => {
                if (node._nodes.length === 0 && node._type === NODE_TYPES['CON']) {
                    orphanCons.push(node);
                }
            }

            this._walk(criteriaFn, this._traverseDepthFirst);

            let orphans = orphanCons.length;
            Logger.debug(`tree-clean: nodes to scrub ${orphans}`);

            orphanCons.forEach((orphan) => {
                this.removeNode(orphan);
            });
            orphanCons.length = 0;
            if (orphans > 0) {
                this.renderNode(this._root);
            }
        }

        /**
         *
         * Credits: Do the i3-like rendering
         *
         */
        renderNode(node) {
            if (!node) return;
            
            // Render the Root, Workspace and Monitor
            // For now, we let them render their children recursively
            if (node._type === NODE_TYPES['ROOT']) {
                Logger.debug(`render root ${node._data}`);
                node._nodes.forEach((child) => {
                    this.renderNode(child);
                });
            }

            if (node._type === NODE_TYPES['WORKSPACE']) {
                Logger.debug(`render workspace ${node._data}`);
                node._nodes.forEach((child) => {
                    this.renderNode(child);
                });
            }

            let params = {};

            if (node._type === NODE_TYPES['MONITOR'] ||
                node._type === NODE_TYPES['CON']) {
                // The workarea from Meta.Window's assigned monitor 
                // is important so it computes to `remove` the panel size
                // really well. However, this type of workarea would only
                // appear if there is window present on the monitor.

                // If monitor, get the workarea
                if (node._type === NODE_TYPES['MONITOR']) {
                    let nodeWinOnContainer = this.findFirstNodeWindowFrom(node);
                    let monitorArea = nodeWinOnContainer && nodeWinOnContainer._data ?
                        nodeWinOnContainer._data.get_work_area_current_monitor() : null;
                    if (!monitorArea) return; // there is no visible child window
                    node.rect = monitorArea;
                }

                let tiledChildren = this.getTiledChildren(node._nodes);
                let sizes = this.computeSizes(node, tiledChildren);

                params.sizes = sizes;

                tiledChildren.forEach((child, index) => {
                    // A monitor can contain a window or container child
                    if (node.layout === LAYOUT_TYPES['HSPLIT'] ||
                        node.layout === LAYOUT_TYPES['VSPLIT']) {
                        this.renderSplit(node, child, params, index);
                    }
                    this.renderNode(child);
                });
            }

            // TODO - move the border rendering here from window.js?
            if (node._type === NODE_TYPES['WINDOW']) {
                if (!node.rect) node.rect = node.get_work_area_current_monitor();
                let nodeWidth = node.rect.width;
                let nodeHeight = node.rect.height;
                let nodeX = node.rect.x;
                let nodeY = node.rect.y;

                // TODO make the gap configurable
                let gap = 8;
                nodeX += gap;
                nodeY += gap;
                nodeWidth -= gap * 2;
                nodeHeight -= gap * 2;

                Logger.debug(`render-window: ${node._data.get_wm_class()}:${node._data.get_title()}`);
                Logger.debug(` layout: ${node._parent.layout}`);
                Logger.debug(` x: ${nodeX}, y: ${nodeY}, h: ${nodeHeight}, w: ${nodeWidth}`);

                this._forgeWm.move(node._data, {x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight});
                if (node._data.firstRender)
                    node._data.firstRender = false;
            }
        }

        renderSplit(node, child, params, index) {
            Logger.debug(`render container ${node._data}`);
            let splitHorizontally = node.layout === LAYOUT_TYPES['HSPLIT'];
            let nodeRect = node.rect;
            let nodeWidth;
            let nodeHeight;
            let nodeX;
            let nodeY;

            if (splitHorizontally) {
                // Divide the parent container's width 
                // depending on number of children. And use this
                // to setup each child window's width.
                nodeWidth = params.sizes[index];
                nodeHeight = nodeRect.height;
                nodeX = nodeRect.x;
                if (index != 0) {
                    let i = 1;
                    while (i <= index) {
                        nodeX += params.sizes[i - 1];
                        i++;
                    }
                }
                nodeY = nodeRect.y;
            } else { // split vertically
                // Conversely for vertical split, divide the parent container's height 
                // depending on number of children. And use this
                // to setup each child window's height.
                nodeWidth = nodeRect.width;
                nodeHeight = params.sizes[index];
                nodeX = nodeRect.x;
                nodeY = nodeRect.y;
                if (index != 0) {
                    let i = 1;
                    while (i <= index) {
                        nodeY += params.sizes[i - 1];
                        i++;
                    }
                }
            }
            Logger.debug(` layout: ${node.layout}`);
            child.rect = {
                x: nodeX,
                y: nodeY,
                width: nodeWidth,
                height: nodeHeight
            };
        }

        computeSizes(node, childItems) {
            let sizes = [];
            let orientation = Utils.orientationFromLayout(node.layout);
            let totalSize = orientation ===
                ORIENTATION_TYPES['HORIZONTAL'] ?
                node.rect.width : node.rect.height;
            childItems.forEach((childNode, index) => {
                let percent = childNode.percent && childNode.percent > 0.0 ?
                    childNode.percent : 1.0 / childItems.length;
                Logger.trace(`percent ${percent}, c${childNode._type}`);
                sizes[index] = Math.floor(percent * totalSize);
            });
            // TODO - make sure the totalSize = the sizes total
            return sizes;
        }

        findFirstNodeWindowFrom(topNode, direction) {
            if (!topNode) return undefined;

            let nodeWindow;
            let criteriaFn = (node) => {
                if (nodeWindow) return; // if already found return
                if (node._type === NODE_TYPES['WINDOW'] &&
                    !node._data.minimized) {
                    nodeWindow = node;
                }
            };

            let traversal = this._traverseBreadthFirst;
            // TODO, improve this logic in the future
            if (direction && direction.toLowerCase() === "bottom") {
                traversal = this._traverseDepthFirst;
            }

            this._walkFrom(topNode, criteriaFn, traversal);

            return nodeWindow;
        }

        findNodeWindowFrom(nodeWindow, topNode) {
            if (!topNode) return undefined;
            let found = false;
            let criteriaFn = (node) => {
                if (found) return;
                if (nodeWindow._data === node._data) {
                    found = true;
                }
            };

            this._walkFrom(topNode, criteriaFn, this._traverseBreadthFirst);
            return found;
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

        resetSiblingPercent(parentNode) {
            if (!parentNode) return;
            let children = parentNode._nodes;
            children.forEach((n) => {
                n.percent = 0.0;
            });
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

