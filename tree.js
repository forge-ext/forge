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
            this.mode = Window.WINDOW_MODES.TILE;
            this.percent = 0.0;

            if (this._type === NODE_TYPES.WINDOW) {
                this._actor = this._data.get_compositor_private();
            }
        }

        get childNodes() {
            return this._nodes;
        }

        set childNodes(nodes) {
            this._nodes = nodes;
        }

        get firstChild() {
            if (this._nodes && this._nodes.length >= 1) {
                return this._nodes[0];
            }
            return null;
        }

        /**
         * Find the index of this relative to the siblings
         */
        get index() {
            if (this.parentNode) {
                let childNodes = this.parentNode.childNodes;
                for (let i = 0; i < childNodes.length; i++) {
                    if (childNodes[i] === this) {
                        return i;
                    }
                }
            }
            return null;
        }

        get lastChild() {
            if (this._nodes && this._nodes.length >= 1) {
                return this._nodes[this._nodes.length - 1];
            }
            return null;
        }

        get nextSibling() {
            if (this.parentNode) {
                if (this.parentNode.lastChild !== this) {
                    return this.parentNode.childNodes[this.index + 1];
                }
            }
            return null;
        }

        get nodeType() {
            return this._type;
        }

        get nodeValue() {
            return this._data;
        }

        get parentNode() {
            return this._parent;
        }

        set parentNode(node) {
            this._parent = node;
        }

        get previousSibling() {
            if (this.parentNode) {
                if (this.parentNode.firstChild !== this) {
                    return this.parentNode.childNodes[this.index - 1];
                }
            }
            return null;
        }

        appendChild(node) {
            if (!node) return null;
            if (node.parentNode)
                node.parentNode.removeChild(node);
            this.childNodes.push(node);
            node.parentNode = this;
            return node;
        }


        /**
         * Checks if node is a descendant of this,
         * or a descendant of its childNodes, etc
         */
        contains(node) {
            if (!node) return false;
            let searchNode = this.getNodeByValue(node.nodeValue);
            Logger.trace(`contains: ${searchNode.nodeValue}`);
            return searchNode ? true : false;
        }

        getNodeByValue(value) {
            let results = this._search(value, "VALUE");
            return results && results.length >= 1 ? results[0] : null;
        }

        getNodeByType(type) {
            let results = this._search(type, "TYPE");
            return results;
        }

        /**
         * @param childNode - is a child of this
         */
        insertBefore(newNode, childNode) {
            if (!newNode) return null;
            if (!childNode) {
                this.appendChild(newNode);
                return newNode;
            }
            if (childNode.parentNode !== this) return null;
            newNode.parentNode.removeChild(newNode);
            let index = childNode.index;
            Logger.trace(`insert-before: child ${index}, items ${this.childNodes.length}`);

            if (childNode.index === 0) {
                Logger.trace(`insert-append to start`);
                this.childNodes.unshift(newNode);
            } else if (childNode.index > 0) {
                Logger.trace(`insert-splice`);
                this.childNodes.splice(index, 0, newNode);
            }
            newNode.parentNode = this;

            return newNode;
        }

        removeChild(node) {
            let refNode;
            if (this.contains(node)) {
                // Since contains() tries to find node on all descendants,
                // detach only from the immediate parent
                let parentNode = node.parentNode;
                Logger.trace(`Removing ${node.nodeType} with index ${node.index} from parent ${parentNode.nodeType}`);
                refNode = parentNode.childNodes.splice(node.index, 1);
                refNode.parentNode = null;
            }
            if (!refNode) {
                throw `NodeNotFound ${node}`
            }
            return refNode;
        }

        /**
         * Backend for getNodeBy[attribute]. It is similar to DOM.getElementBy functions
         */
        _search(term, criteria) {
            let results = [];
            let searchFn = (candidate) => {
                if (criteria) {
                    switch(criteria) {
                        case "VALUE":
                            if (candidate.nodeValue === term) {
                                results.push(candidate);
                            }
                            break;
                        case "TYPE":
                            if (candidate.nodeType === term) {
                                results.push(candidate);
                            }
                            break;
                    }
                } else {
                    if (candidate === term) {
                        results.push(candidate);
                    }
                }
            }

            this._walk(searchFn, this._traverseBreadthFirst);
            return results;
        }

        // start walking from root and all child nodes
        _traverseBreadthFirst(callback) {
            let queue = new Queue();
            queue.enqueue(this);

            let currentNode = queue.dequeue();

            while(currentNode) {
                for (let i = 0, length = currentNode.childNodes.length; i < length; i++) {
                    queue.enqueue(currentNode.childNodes[i]);
                }

                callback(currentNode);
                currentNode = queue.dequeue();
            }
        }

        // start walking from bottom to root
        _traverseDepthFirst(callback) {
            let recurse = (currentNode) => {
                for (let i = 0, length = currentNode.childNodes.length; i < length; i++) {
                    recurse(currentNode.childNodes[i]);
                }

                callback(currentNode);
            };
            recurse(this);
        }

        _walk(callback, traversal) {
            traversal.call(this, callback);
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
    class Tree extends Node {
        _init(forgeWm) {
            let rootBin = new St.Bin();
            super._init(NODE_TYPES.ROOT, rootBin);
            this._forgeWm = forgeWm;
            this.layout = LAYOUT_TYPES.ROOT;
            rootBin.show();
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
        addMonitor(workspaceNodeValue) {
            let monitors = global.display.get_n_monitors();
            for (let mi = 0; mi < monitors; mi++) {
                let monitorWsNode = this.createNode(workspaceNodeValue, NODE_TYPES.MONITOR, `mo${mi}${workspaceNodeValue}`);
                monitorWsNode.layout = LAYOUT_TYPES.HSPLIT;
            }
            Logger.debug(`initialized monitors: ${monitors}`);
        }

        // TODO move to workspace.js
        addWorkspace(wsIndex) {
            let wsManager = global.display.get_workspace_manager();
            let workspaceNodeValue = `ws${wsIndex}`;

            let existingWsNode = this.findNode(workspaceNodeValue);
            if (existingWsNode) {
                Logger.debug(`workspace-node ${workspaceNodeValue} already exists`);
                return false;
            }

            Logger.debug(`adding workspace: ${workspaceNodeValue}`);

            let newWsNode = this.createNode(this.nodeValue, NODE_TYPES.WORKSPACE, workspaceNodeValue);
            let workspace = wsManager.get_workspace_by_index(wsIndex);
            newWsNode.layout = LAYOUT_TYPES.HSPLIT;

            this._forgeWm.bindWorkspaceSignals(workspace);
            this.addMonitor(workspaceNodeValue);

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
            this.removeChild(existingWsNode);
            return true;
        }

        get nodeWorkpaces() {
            let nodeWorkspaces = this.getNodeByType(NODE_TYPES.WORKSPACE);
            return nodeWorkspaces;
        }

        get nodeWindows() {
            let nodeWindows = this.getNodeByType(NODE_TYPES.WINDOW);
            return nodeWindows;
        }

        /**
         * Creates a new Node and attaches it to a parent toData.
         * Parent can be MONITOR or CON types only.
         */
        createNode(toData, type, data) {
            let parentNode = this.findNode(toData);
            let child;

            if (parentNode) {
                child = new Node(type, data);
                parentNode.appendChild(child);
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
            let searchNode = this.getNodeByValue(data);
            return searchNode;
        }

        /**
         * Find the NodeWindow using the Meta.WindowActor
         */
        findNodeByActor(windowActor) {
            let searchNode;
            let criteriaMatchFn = (node) => {
                if (node.nodeType === NODE_TYPES.WINDOW && 
                    node._actor === windowActor) {
                    searchNode = node;
                }
            };

            this._walk(criteriaMatchFn, this._traverseDepthFirst);

            return searchNode;
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
                if (node.nodeValue !== metaWindow &&
                    node.nodeType === NODE_TYPES.WINDOW &&
                    !node.nodeValue.minimized) {
                    let metaRect = node.rect;
                    if (!metaRect) return;
                    let atPointer = Utils.rectContainsPoint(
                        metaRect, pointer);
                    if (atPointer)
                        nodeAtPointer = node;
                }
            }

            monWsNode._walk(criteriaFn, monWsNode._traverseDepthFirst);
            return nodeAtPointer;
        }

        focus(node, direction) {
            let nextFocusNode = this.next(node, direction);
            Logger.trace(`focus: next ${nextFocusNode ? nextFocusNode.nodeType : undefined}`);
            if (!nextFocusNode) {
                return;
            }

            let nodeType = nextFocusNode.nodeType;

            switch(nodeType) {
                case NODE_TYPES.WINDOW:
                    if (this._forgeWm.floatingWindow(nextFocusNode) || nextFocusNode.nodeValue.minimized) {
                        Logger.warn(`focus: window is minimized or floating`);
                        this.focus(nextFocusNode, direction);
                    } else {
                        // TODO, maybe put the code block below in a new function
                        nextFocusNode.nodeValue.raise();
                        nextFocusNode.nodeValue.activate(global.get_current_time());
                        nextFocusNode.nodeValue.focus(global.get_current_time());
                    }
                    break;
                case NODE_TYPES.CON:
                case NODE_TYPES.MONITOR:
                    nextFocusNode = this.findFirstNodeWindowFrom(nextFocusNode);
                    if (nextFocusNode) {
                        // Always try to find the next window
                        if (this._forgeWm.floatingWindow(nextFocusNode) ||
                            nextFocusNode.nodeValue.minimized) {
                            Logger.warn(`focus: window is minimized or floating`);
                            this.focus(nextFocusNode);
                        } else {
                            nextFocusNode.nodeValue.raise();
                            nextFocusNode.nodeValue.activate(global.get_current_time());
                            nextFocusNode.nodeValue.focus(global.get_current_time());
                        }
                    }
                    break;
            }

            if (nextFocusNode) {
                // Great found the next node window,
                // check if same monitor as before, else warp the pointer
                if (!this._forgeWm.sameParentMonitor(node, nextFocusNode)) {
                    // TODO warp the pointer here to the new monitor
                    // and make it configurable
                    let movePointerAlongWithMonitor = true;
                    if (movePointerAlongWithMonitor) {
                        this._forgeWm.movePointerWith(nextFocusNode);
                    }
                }
                // FIXME, when the window focuses on hover always
                // move the pointer
                this.attachNode = nextFocusNode.parentNode;
                Logger.trace(`focus: next attachNode ${this.attachNode.nodeType} ${this.attachNode}`);
            }
        }

        /**
         * Obtains the non-floating, non-minimized list of nodes
         */
        getTiledChildren(items) {
            let filterFn = (node) => {
                if (node.nodeType === NODE_TYPES.WINDOW) {
                    let floating = node.mode === Window.WINDOW_MODES.FLOAT;
                    // A Node[Window]._data is a Meta.Window
                    if (!node.nodeValue.minimized && !floating) {
                        return true;
                    }
                }
                // handle split containers
                if (node.nodeType === NODE_TYPES.CON) {
                    return this.getTiledChildren(node.childNodes).length > 0;
                }
                return false;
            };

            return items.filter(filterFn);
        }

        move(node, direction) {
            let next = this.next(node, direction);
            let position = Utils.positionFromDirection(direction);
            if (!next) {
                return;
            }
            Logger.trace(`move-window: next ${next ? next.nodeType : undefined} ${position}`);

            switch(next.nodeType) {
                case NODE_TYPES.WINDOW:
                    // If same parent, swap
                    if (next === node.previousSibling || next === node.nextSibling) {
                        Logger.trace(`move-window: swap pairs`);
                        this.swapPairs(node, next);
                    } else {
                        if (next.parentNode) {
                            Logger.trace(`move-window: next parent ${next.parentNode.nodeValue}`);
                            if (position === POSITION.AFTER) {
                                next.parentNode.insertBefore(node, next);
                            } else {
                                next.parentNode.insertBefore(node, next.nextSibling);
                            }
                            // TODO reset the previous container
                        }
                    }
                    break;
                case NODE_TYPES.CON:
                    Logger.trace(`move-to-con`);
                    next.insertBefore(node, next.firstChild);
                    // TODO reset the previous container
                    break;
                default:
                    break;
            }
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
            let horizontal = orientation === ORIENTATION_TYPES.HORIZONTAL;
            let previous = position === POSITION.BEFORE;
            let next;

            Logger.debug(`next:orientation ${orientation}`);
            Logger.debug(`next:position ${position}`);

            // 1. If any of these top level nodes,
            if (node.nodeType === NODE_TYPES.ROOT ||
                node.nodeType === NODE_TYPES.WORKSPACE ||
                node.nodeType === NODE_TYPES.MONITOR) {
                // TODO focus on the next node window
                Logger.trace(`next:${node._type}`);
                return null;
            }

            // Remember the current focus node window
            let prevNode = node;

            // 2. Walk through the siblings of this node
            while (node && node.nodeType != NODE_TYPES.WORKSPACE) {
                let nodeParent = node.parentNode;
                Logger.trace(`node-parent-data ${nodeParent._data}`);
                Logger.trace(`node-data ${node._data}`);

                // 2.a Handle the top level monitor siblings
                // This is to support moving focus to the next monitor available
                // based on the direction
                if (node && node.nodeType === NODE_TYPES.MONITOR) {
                    if (prevNode.nodeType === NODE_TYPES.WINDOW) {
                        let targetMonitor = global.display.
                            get_monitor_neighbor_index(prevNode.nodeValue.get_monitor(),
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
                if (horizontal && nodeParent.layout === LAYOUT_TYPES.HSPLIT ||
                    !horizontal && nodeParent.layout === LAYOUT_TYPES.VSPLIT) {
                    if (nodeParent && nodeParent.childNodes && nodeParent.childNodes.length > 1) {
                        let currentIndex = node.index;
                        let nextIndex = previous ? currentIndex - 1 : currentIndex + 1;
                        if (nextIndex !== -1 && !(nextIndex > nodeParent.childNodes.length - 1)) {
                            next = nodeParent.childNodes[nextIndex];
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
            if (next && next.nodeType === NODE_TYPES.WINDOW
                && next.nodeValue
                && next.nodeValue.minimized) {
                next = this.nextVisible(next, direction);
            }
            return next;
        }

        /**
         * Credits: i3-like split
         */
        split(node, orientation) {
            if (!node) return;
            let type = node.nodeType;

            if (type === NODE_TYPES.WINDOW &&
                node.mode === Window.WINDOW_MODES.FLOAT) {
                Logger.debug(`tree-split: cannot split ${type} that floats`);
                return;
            }

            if (!(type === NODE_TYPES.MONITOR ||
                type === NODE_TYPES.CON ||
                type === NODE_TYPES.WINDOW)) {
                Logger.debug(`tree-split: cannot split ${type}`);
                return;
            }

            let parentNode = node.parentNode;
            let numChildren = parentNode.childNodes.length;

            // toggle the split
            if (numChildren === 1 &&
                (parentNode.layout === LAYOUT_TYPES.HSPLIT ||
                parentNode.layout === LAYOUT_TYPES.VSPLIT)) {
                parentNode.layout = orientation ===
                    ORIENTATION_TYPES.HORIZONTAL ?
                    LAYOUT_TYPES.HSPLIT : LAYOUT_TYPES.VSPLIT;
                Logger.debug(`tree-split: toggle parent ${parentNode._type} to layout: ${parentNode.layout}`);
                this.attachNode = parentNode;
                return;
            }

            // Push down the Meta.Window into a new Container
            Logger.trace(`tree-split: parent node ${parentNode._type} ${parentNode._data}, children ${numChildren}`);
            Logger.trace(`tree-split: node ${node._data} has children? ${node._nodes.length}`);
            Logger.debug(`tree-split: pushing down ${type} ${node._data.get_wm_class()} to CON`);
            let currentIndex = node.index;
            let container = new St.Bin();
            let newConNode = new Node(NODE_TYPES.CON, container);
            // Take the direction of the parent
            newConNode.layout = orientation ===
                    ORIENTATION_TYPES.HORIZONTAL ?
                    LAYOUT_TYPES.HSPLIT : LAYOUT_TYPES.VSPLIT;
            newConNode.rect = node.rect;
            newConNode.percent = node.percent;
            newConNode.parentNode = parentNode;
            parentNode.childNodes[currentIndex] = newConNode;
            this.createNode(container, node._type, node._data);
            this.attachNode = newConNode;
            Logger.trace(`tree-split: container parent ${newConNode._parent._data} has children? ${newConNode._parent._nodes.length}`);
        }

        swap(node, direction) {
            let nextSwapNode = this.next(node, direction);
            Logger.trace(`swap: next ${nextSwapNode ? nextSwapNode.nodeType : undefined}`);
            if (!nextSwapNode) {
                return;
            }
            let nodeSwapType = nextSwapNode.nodeType;

            switch(nodeSwapType) {
                case NODE_TYPES.WINDOW:
                    break;
                case NODE_TYPES.CON:
                case NODE_TYPES.MONITOR:
                    nextSwapNode = this.findFirstNodeWindowFrom(nextSwapNode, "bottom");
                    break;
            }
            let isNextNodeWin = nextSwapNode &&
                nextSwapNode.nodeValue &&
                nextSwapNode.nodeType === NODE_TYPES.WINDOW;
            if (isNextNodeWin) {
                if (!this._forgeWm.sameParentMonitor(node, nextSwapNode)) {
                    Logger.warn(`swap: not same monitor, do not swap`);
                    return;
                }
                Logger.debug(`swap:next ${isNextNodeWin ? nextSwapNode.nodeValue.get_wm_class() : "undefined"}`);
                this.swapPairs(node, nextSwapNode);
            } 
        }

        swapPairs(fromNode, toNode, focus = true) {
            if (!(this._swappable(fromNode) &&
                this._swappable(toNode)))
                return;
            // Swap the items in the array
            let parentForFrom = fromNode ?
                fromNode.parentNode : undefined;
            let parentForTo = toNode.parentNode;
            if (parentForTo && parentForFrom) {
                let nextIndex = toNode.index;
                let focusIndex = fromNode.index;
                parentForTo.childNodes[nextIndex] = fromNode;
                fromNode.parentNode = parentForTo;
                parentForFrom.childNodes[focusIndex] = toNode;
                toNode.parentNode = parentForFrom;
                let percent = fromNode.percent;
                fromNode.percent = toNode.percent;
                toNode.percent = percent;
                if (focus) {
                    fromNode.nodeValue.raise();
                    fromNode.nodeValue.focus(global.get_current_time());
                }
            }
        }

        _swappable(node) {
            if (!node) return false;
            if (node.nodeType === NODE_TYPES.WINDOW &&
                node.mode !== Window.WINDOW_MODES.FLOAT) {
                return true;
            }
            return false;
        }

        /**
         * Performs cleanup of dangling parents in addition to removing the
         * node from the parent.
         */
        removeNode(node) {
            let oldChild;

            let cleanUpParent = (existParent) => {
                if (this.getTiledChildren(existParent.childNodes).length === 0) {
                    existParent.percent = 0.0;
                    this.resetSiblingPercent(existParent.parentNode);
                }
                this.resetSiblingPercent(existParent);
            };

            let parentNode = node.parentNode;
            // If parent has only this window, remove the parent instead
            if (parentNode.childNodes.length === 1 &&
                parentNode.nodeType !== NODE_TYPES.MONITOR) {
                let existParent = parentNode.parentNode;
                oldChild = existParent.removeChild(parentNode);
                cleanUpParent(existParent);
            } else {
                let existParent = node.parentNode;
                oldChild = existParent.removeChild(node);
                cleanUpParent(existParent);
            }

            if (node === this.attachNode) {
                this.attachNode = null;
            }

            return oldChild ? true : false;
        }

        render(from) {
            Logger.debug(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
            Logger.debug(`render tree ${from ? "from " + from : ""}`);
            // TODO - render from the current active workspace for performance
            this.renderNode(this);
            Logger.debug(`workspaces: ${this.nodeWorkpaces.length}`);
            Logger.debug(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`);
            this.cleanTree();
        }

        cleanTree() {
            let orphanCons = [];
            let criteriaFn = (node) => {
                if (node.childNodes.length === 0 &&
                    node.nodeType === NODE_TYPES.CON) {
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
                this.renderNode(this);
            }
        }

        /**
         *
         * Credits: Do the i3-like rendering
         *
         */
        renderNode(node) {
            if (!node) return;
            Logger.trace(`begin render node ${node.nodeValue}`);
            
            // Render the Root, Workspace and Monitor
            // For now, we let them render their children recursively
            if (node.nodeType === NODE_TYPES.ROOT) {
                Logger.debug(`render root ${node.nodeValue}`);
                node.childNodes.forEach((child) => {
                    Logger.trace(`rendering ${child.nodeValue}`);
                    this.renderNode(child);
                });
            }

            if (node.nodeType === NODE_TYPES.WORKSPACE) {
                Logger.debug(`*---- render workspace ${node.nodeValue} ----*`);
                node.childNodes.forEach((child) => {
                    Logger.trace(`rendering ${child.nodeValue}`);
                    this.renderNode(child);
                });
            }

            let params = {};

            if (node.nodeType === NODE_TYPES.MONITOR ||
                node.nodeType === NODE_TYPES.CON) {
                // The workarea from Meta.Window's assigned monitor 
                // is important so it computes to `remove` the panel size
                // really well. However, this type of workarea would only
                // appear if there is window present on the monitor.
                Logger.trace(`inside a con or monitor, rendering ${node.nodeType}`);
                if (node.childNodes.length === 0) {
                    Logger.trace(`Do not render empty containers`);
                    return;
                }

                // If monitor, get the workarea
                if (node.nodeType === NODE_TYPES.MONITOR) {
                    let nodeWinOnContainer = this.findFirstNodeWindowFrom(node);
                    let monitorArea = nodeWinOnContainer && nodeWinOnContainer.nodeValue ?
                        nodeWinOnContainer.nodeValue.get_work_area_current_monitor() : null;
                    if (!monitorArea) return; // there is no visible child window
                    Logger.trace(`getting workarea`);
                    node.rect = monitorArea;
                }

                let tiledChildren = this.getTiledChildren(node.childNodes);
                let sizes = this.computeSizes(node, tiledChildren);

                params.sizes = sizes;

                tiledChildren.forEach((child, index) => {
                    // A monitor can contain a window or container child
                    if (node.layout === LAYOUT_TYPES.HSPLIT ||
                        node.layout === LAYOUT_TYPES.VSPLIT) {
                        this.renderSplit(node, child, params, index);
                    }
                    Logger.trace(`rendering ${child.nodeValue}`);
                    this.renderNode(child);
                });
            }

            // TODO - move the border rendering here from window.js?
            if (node.nodeType === NODE_TYPES.WINDOW) {
                if (!node.rect) node.rect = node.get_work_area_current_monitor();
                let nodeWidth = node.rect.width;
                let nodeHeight = node.rect.height;
                let nodeX = node.rect.x;
                let nodeY = node.rect.y;

                let gap = this._forgeWm.calculateGaps(node.nodeValue);
                nodeX += gap;
                nodeY += gap;
                // TODO - detect inbetween windows and adjust accordingly 
                // Also adjust depending on display scaling
                nodeWidth -= gap * 2;
                nodeHeight -= gap * 2;

                Logger.debug(`render-window: ${node.nodeValue.get_wm_class()}:${node.nodeValue.get_title()}`);
                Logger.debug(` layout: ${node.parentNode.layout}, index: ${node.index}`);
                Logger.debug(` x: ${nodeX}, y: ${nodeY}, h: ${nodeHeight}, w: ${nodeWidth}`);

                GLib.idle_add(GLib.PRIORITY_LOW, () => {
                    this._forgeWm.move(node.nodeValue, {x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight});
                    if (node.nodeValue.firstRender)
                        node.nodeValue.firstRender = false;

                    return false;
                });
            }
        }

        renderSplit(node, child, params, index) {
            Logger.debug(`render container ${node._data}`);
            let splitHorizontally = node.layout === LAYOUT_TYPES.HSPLIT;
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
                ORIENTATION_TYPES.HORIZONTAL ?
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

        findFirstNodeWindowFrom(node) {
            Logger.trace(`finding at least one node window`);
            let results = node.getNodeByType(NODE_TYPES.WINDOW);
            if (results.length > 0) {
                Logger.trace(`found results`);
                return results[0];
            }
            return null;
        }

        resetSiblingPercent(parentNode) {
            if (!parentNode) return;
            let children = parentNode._nodes;
            children.forEach((n) => {
                n.percent = 0.0;
            });
        }
    }
);

