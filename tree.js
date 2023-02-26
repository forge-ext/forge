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

"use strict";

// Gnome imports
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

// Gnome Shell imports
const DND = imports.ui.dnd;
const Main = imports.ui.main;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Logger = Me.imports.logger;
const Settings = Me.imports.settings;
const Utils = Me.imports.utils;
const Window = Me.imports.window;

var NODE_TYPES = Utils.createEnum([
  "ROOT",
  "MONITOR", //Output in i3
  "CON", //Container in i3
  "WINDOW",
  "WORKSPACE",
]);

var LAYOUT_TYPES = Utils.createEnum(["STACKED", "TABBED", "ROOT", "HSPLIT", "VSPLIT", "PRESET"]);

var ORIENTATION_TYPES = Utils.createEnum(["NONE", "HORIZONTAL", "VERTICAL"]);

var POSITION = Utils.createEnum(["BEFORE", "AFTER", "UNKNOWN"]);

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
      this.mode = Window.WINDOW_MODES.DEFAULT;
      this.percent = 0.0;
      this._rect = null;
      this.tab = null;
      this.decoration = null;
      this.app = null;

      if (this.isWindow()) {
        // When destroy() is called on Meta.Window, it might not be
        // available so we store it immediately
        this._initMetaWindow();
        this._actor = this._data.get_compositor_private();
        this._createWindowTab();
      }

      if (this.isCon()) {
        this._createDecoration();
      }
    }

    get windowActor() {
      return this._actor;
    }

    get actor() {
      switch (this.nodeType) {
        case NODE_TYPES.WINDOW:
          // A Meta.Window was assigned during creation
          // But obtain the Clutter.Actor
          return this._actor;
        case NODE_TYPES.CON:
        case NODE_TYPES.ROOT:
          // A St.Bin was assigned during creation
          return this.nodeValue;
        case NODE_TYPES.MONITOR:
        case NODE_TYPES.WORKSPACE:
          // A separate St.Bin was assigned on another attribute during creation
          return this.actorBin;
      }
    }

    set rect(rect) {
      this._rect = rect;
      switch (this.nodeType) {
        case NODE_TYPES.WINDOW:
          break;
        case NODE_TYPES.CON:
        case NODE_TYPES.MONITOR:
        case NODE_TYPES.ROOT:
        case NODE_TYPES.WORKSPACE:
          if (this.actor) {
            this.actor.set_size(rect.width, rect.height);
            this.actor.set_position(rect.x, rect.y);
          }
          break;
      }
    }

    get rect() {
      return this._rect;
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

    get level() {
      let _level = 0;
      let refNode = this.parentNode;
      while (refNode) {
        _level += 1;
        refNode = refNode.parentNode;
      }

      return _level;
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
      if (node.parentNode) node.parentNode.removeChild(node);
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
      return searchNode ? true : false;
    }

    getNodeByLayout(layout) {
      let results = this._search(layout, "LAYOUT");
      return results;
    }

    getNodeByMode(mode) {
      let results = this._search(mode, "MODE");
      return results;
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
      if (newNode === childNode) return null;
      if (!childNode) {
        this.appendChild(newNode);
        return newNode;
      }
      if (childNode.parentNode !== this) return null;
      if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
      let index = childNode.index;

      if (childNode.index === 0) {
        this.childNodes.unshift(newNode);
      } else if (childNode.index > 0) {
        this.childNodes.splice(index, 0, newNode);
      }
      newNode.parentNode = this;

      return newNode;
    }

    isLayout(name) {
      let layout = this.layout;
      if (!layout) return false;

      return name === layout;
    }

    isHSplit() {
      return this.isLayout(LAYOUT_TYPES.HSPLIT);
    }

    isVSplit() {
      return this.isLayout(LAYOUT_TYPES.VSPLIT);
    }

    isStacked() {
      return this.isLayout(LAYOUT_TYPES.STACKED);
    }

    isTabbed() {
      return this.isLayout(LAYOUT_TYPES.TABBED);
    }

    isType(name) {
      const type = this.nodeType;
      if (!type) return false;

      return name === type;
    }

    isWindow() {
      return this.isType(NODE_TYPES.WINDOW);
    }

    isCon() {
      return this.isType(NODE_TYPES.CON);
    }

    isMonitor() {
      return this.isType(NODE_TYPES.MONITOR);
    }

    isWorkspace() {
      return this.isType(NODE_TYPES.WORKSPACE);
    }

    isRoot() {
      return this.isType(NODE_TYPES.ROOT);
    }

    isMode(name) {
      const mode = this.mode;
      if (!name) return false;

      return name === mode;
    }

    isFloat() {
      return this.isMode(Window.WINDOW_MODES.FLOAT);
    }

    isTile() {
      return this.isMode(Window.WINDOW_MODES.TILE);
    }

    isGrabTile() {
      return this.isMode(Window.WINDOW_MODES.GRAB_TILE);
    }

    removeChild(node) {
      if (node.isTabbed() && node.decoration) {
        node.decoration.hide();
        node.decoration.destroy_all_children();
        node.decoration.destroy();
        node.decoration = null;
      }

      let refNode;
      if (this.contains(node)) {
        // Since contains() tries to find node on all descendants,
        // detach only from the immediate parent
        let parentNode = node.parentNode;
        refNode = parentNode.childNodes.splice(node.index, 1);
        refNode.parentNode = null;
      }
      if (!refNode) {
        throw `NodeNotFound ${node}`;
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
          switch (criteria) {
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
            case "MODE":
              if (candidate.mode === term) {
                results.push(candidate);
              }
            case "LAYOUT":
              if (candidate.layout && candidate.layout === term) {
                results.push(candidate);
              }
          }
        } else {
          if (candidate === term) {
            results.push(candidate);
          }
        }
      };

      this._walk(searchFn, this._traverseBreadthFirst);
      return results;
    }

    // start walking from root and all child nodes
    _traverseBreadthFirst(callback) {
      let queue = new Queue();
      queue.enqueue(this);

      let currentNode = queue.dequeue();

      while (currentNode) {
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

    _initMetaWindow() {
      if (this.isWindow()) {
        let windowTracker = Shell.WindowTracker.get_default();
        let metaWin = this.nodeValue;
        let app = windowTracker.get_window_app(metaWin);
        this.app = app;
      }
    }

    _createWindowTab() {
      if (this.tab || !this.isWindow()) return;

      let tabContents = new St.BoxLayout({
        style_class: "window-tabbed-tab",
        x_expand: true,
      });
      let app = this.app;
      let labelText = this._getTitle();
      let metaWin = this.nodeValue;
      let titleButton = new St.Button({
        x_expand: true,
        label: `${labelText}`,
      });
      let iconBin = new St.Bin({
        style_class: "window-tabbed-tab-icon",
      });
      let icon = app.create_icon_texture(24 * Utils.dpi());
      iconBin.child = icon;
      let closeButton = new St.Button({
        style_class: "window-tabbed-tab-close",
        child: new St.Icon({ icon_name: "window-close-symbolic" }),
      });

      tabContents.add(iconBin);
      tabContents.add(titleButton);
      tabContents.add(closeButton);

      titleButton.connect("clicked", () => {
        this.parentNode.childNodes.forEach((c) => {
          if (c.tab) {
            c.tab.remove_style_class_name("window-tabbed-tab-active");
            c.render();
          }
        });
        tabContents.add_style_class_name("window-tabbed-tab-active");
        metaWin.activate(global.display.get_current_time());
      });

      closeButton.connect("clicked", () => {
        metaWin.delete(global.get_current_time());
      });

      if (metaWin === global.display.get_focus_window()) {
        tabContents.add_style_class_name("window-tabbed-tab-active");
      }
      this.tab = tabContents;
    }

    _createDecoration() {
      if (this.decoration) return;
      let decoration = new St.BoxLayout();
      decoration.type = "forge-deco";
      decoration.parentNode = this;
      let globalWinGrp = global.window_group;
      decoration.style_class = "window-tabbed-bg";

      if (!globalWinGrp.contains(decoration)) {
        globalWinGrp.add_child(decoration);
      }

      decoration.hide();
      this.decoration = decoration;
    }

    _getTitle() {
      if (this.isWindow()) {
        return this.nodeValue.title ? this.nodeValue.title : this.app.get_name();
      }
      return null;
    }

    render() {
      // Always update the title for the tab
      if (this.tab !== null && this.tab !== undefined) {
        let titleLabel = this.tab.get_child_at_index(1);
        if (titleLabel) titleLabel.label = this._getTitle();
      }
    }

    set float(value) {
      if (this.isWindow()) {
        let metaWindow = this.nodeValue;
        let floatAlwaysOnTop = this.settings.get_boolean("float-always-on-top-enabled");
        if (value) {
          this.mode = Window.WINDOW_MODES.FLOAT;
          if (!metaWindow.is_above()) {
            floatAlwaysOnTop && metaWindow.make_above();
          }
        } else {
          this.mode = Window.WINDOW_MODES.TILE;
          if (metaWindow.is_above()) {
            metaWindow.unmake_above();
          }
        }
      }
    }

    set tile(value) {
      this.float = !value;
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

    get length() {
      return this._elements.length;
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
    _init(extWm) {
      let rootBin = new St.Bin();
      super._init(NODE_TYPES.ROOT, rootBin);
      this._extWm = extWm;
      this.defaultStackHeight = 35;
      this.settings = this.extWm.ext.settings;
      this.layout = LAYOUT_TYPES.ROOT;
      if (!global.window_group.contains(rootBin)) global.window_group.add_child(rootBin);

      this._initWorkspaces();
    }

    get extWm() {
      return this._extWm;
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
    }

    // TODO move to monitor.js
    addMonitor(wsIndex) {
      let monitors = global.display.get_n_monitors();
      for (let mi = 0; mi < monitors; mi++) {
        let monitorWsNode = this.createNode(
          `ws${wsIndex}`,
          NODE_TYPES.MONITOR,
          `mo${mi}ws${wsIndex}`
        );
        monitorWsNode.layout = this.extWm.determineSplitLayout();
        monitorWsNode.actorBin = new St.Bin();
        if (!global.window_group.contains(monitorWsNode.actorBin))
          global.window_group.add_child(monitorWsNode.actorBin);
      }
    }

    // TODO move to workspace.js
    addWorkspace(wsIndex) {
      let wsManager = global.display.get_workspace_manager();
      let workspaceNodeValue = `ws${wsIndex}`;

      let existingWsNode = this.findNode(workspaceNodeValue);
      if (existingWsNode) {
        return false;
      }

      let newWsNode = this.createNode(this.nodeValue, NODE_TYPES.WORKSPACE, workspaceNodeValue);

      let workspace = wsManager.get_workspace_by_index(wsIndex);
      newWsNode.layout = LAYOUT_TYPES.HSPLIT;
      newWsNode.actorBin = new St.Bin({ style_class: "workspace-actor-bg" });

      if (!global.window_group.contains(newWsNode.actorBin))
        global.window_group.add_child(newWsNode.actorBin);

      this.extWm.bindWorkspaceSignals(workspace);
      this.addMonitor(wsIndex);

      return true;
    }

    // TODO move to workspace.js
    removeWorkspace(wsIndex) {
      let workspaceNodeData = `ws${wsIndex}`;
      let existingWsNode = this.findNode(workspaceNodeData);
      if (!existingWsNode) {
        return false;
      }

      if (global.window_group.contains(existingWsNode.actorBin))
        global.window_group.remove_child(existingWsNode.actorBin);

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
    createNode(parentObj, type, value, mode = Window.WINDOW_MODES.TILE) {
      let parentNode = this.findNode(parentObj);
      let child;

      if (parentNode) {
        child = new Node(type, value);
        child.settings = this.settings;

        if (child.isWindow()) child.mode = mode;

        // Append after a window
        if (parentNode.isWindow()) {
          const grandParentNode = parentNode.parentNode;
          grandParentNode.insertBefore(child, parentNode.nextSibling);
          Logger.debug(
            `Parent is a window, attaching to this window's parent ${grandParentNode.nodeType}`
          );
        } else {
          // Append as the last item of the container
          parentNode.appendChild(child);
        }
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
        if (node.isWindow() && node.actor === windowActor) {
          searchNode = node;
        }
      };

      this._walk(criteriaMatchFn, this._traverseDepthFirst);

      return searchNode;
    }

    /**
     * Focuses on the next node, if metaWindow and tiled, raise it
     */
    focus(node, direction) {
      if (!node) return null;
      let next = this.next(node, direction);

      if (!next) return null;

      let type = next.nodeType;
      let position = Utils.positionFromDirection(direction);
      const previous = position === POSITION.BEFORE;

      switch (type) {
        case NODE_TYPES.WINDOW:
          break;
        case NODE_TYPES.CON:
          const tiledConWindows = next.getNodeByType(NODE_TYPES.WINDOW).filter((w) => w.isTile());
          if (next.layout === LAYOUT_TYPES.STACKED) {
            next = next.lastChild;
          } else {
            if (tiledConWindows.length > 1) {
              if (previous) {
                next = tiledConWindows[tiledConWindows.length - 1];
              } else {
                next = tiledConWindows[0];
              }
            } else {
              next = tiledConWindows[0];
            }
          }
          break;
        case NODE_TYPES.MONITOR:
          if (next.layout === LAYOUT_TYPES.STACKED) {
            next = next.lastChild;
          } else {
            if (previous) {
              next = next.lastChild;
            } else {
              next = next.firstChild;
            }
          }

          if (next && next.nodeType === NODE_TYPES.CON) {
            const tiledConWindows = next.getNodeByType(NODE_TYPES.WINDOW).filter((w) => w.isTile());
            if (next.layout === LAYOUT_TYPES.STACKED) {
              next = next.lastChild;
            } else {
              if (tiledConWindows.length > 1) {
                if (previous) {
                  next = tiledConWindows[tiledConWindows.length - 1];
                } else {
                  next = tiledConWindows[0];
                }
              } else {
                next = tiledConWindows[0];
              }
            }
          }
          break;
      }

      if (!next) return null;

      let metaWindow = next.nodeValue;
      if (!metaWindow) return null;
      if (metaWindow.minimized) {
        next = this.focus(next, direction);
      } else {
        metaWindow.raise();
        metaWindow.focus(global.display.get_current_time());
        metaWindow.activate(global.display.get_current_time());

        if (this.settings.get_boolean("move-pointer-focus-enabled")) {
          this.extWm.movePointerWith(next);
        } else {
          let monitorArea = metaWindow.get_work_area_current_monitor();
          let ptr = this.extWm.getPointer();
          if (!Utils.rectContainsPoint(monitorArea, [ptr[0], ptr[1]])) {
            this.extWm.movePointerWith(next);
          }
        }
      }
      return next;
    }

    /**
     * Obtains the non-floating, non-minimized list of nodes
     * Useful for calculating the rect areas
     */
    getTiledChildren(items) {
      let filterFn = (node) => {
        if (node.isWindow()) {
          let floating = node.isFloat();
          let grabTiling = node.isGrabTile();
          // A Node[Window]._data is a Meta.Window
          if (!node.nodeValue.minimized && !(floating || grabTiling)) {
            return true;
          }
        }
        // handle split containers
        if (node.isCon()) {
          return this.getTiledChildren(node.childNodes).length > 0;
        }
        return false;
      };

      return items.filter(filterFn);
    }

    /**
     * Move a given node into a direction
     *
     * TODO, handle minimized or floating windows
     *
     */
    move(node, direction) {
      let next = this.next(node, direction);
      let position = Utils.positionFromDirection(direction);

      if (!next || next === -1) {
        if (next === -1) {
          // TODO - update appending or prepending on the same monitor
          const currMonWsNode = this.extWm.currentMonWsNode;
          if (currMonWsNode) {
            if (position === POSITION.AFTER) {
              currMonWsNode.appendChild(node);
            } else {
              currMonWsNode.insertBefore(node, next.firstChild);
            }
            return true;
          }
        }
        return false;
      }

      let parentNode = node.parentNode;
      let parentTarget;

      switch (next.nodeType) {
        case NODE_TYPES.WINDOW:
          // If same parent, swap
          if (next === node.previousSibling || next === node.nextSibling) {
            parentTarget = next.parentNode;
            this.swapPairs(node, next);
            if (this.settings.get_boolean("move-pointer-focus-enabled")) {
              this.extWm.movePointerWith(node);
            }
            // do not reset percent when swapped
            return true;
          } else {
            parentTarget = next.parentNode;
            if (parentTarget) {
              if (position === POSITION.AFTER) {
                parentTarget.insertBefore(node, next);
              } else {
                parentTarget.insertBefore(node, next.nextSibling);
              }
            }
          }
          break;
        case NODE_TYPES.CON:
          parentTarget = next;

          if (next.isStacked()) {
            next.appendChild(node);
          } else {
            if (position === POSITION.AFTER) {
              next.insertBefore(node, next.firstChild);
            } else {
              next.appendChild(node);
            }
          }
          break;
        case NODE_TYPES.MONITOR:
          parentTarget = next;
          const currMonWsNode = this.extWm.currentMonWsNode;

          if (
            !next.contains(node) &&
            (node === currMonWsNode.firstChild || node === currMonWsNode.lastChild)
          ) {
            let targetMonRect = this.extWm.rectForMonitor(node, Utils.monitorIndex(next.nodeValue));
            if (!targetMonRect) return false;
            if (position === POSITION.AFTER) {
              next.insertBefore(node, next.firstChild);
            } else {
              next.appendChild(node);
            }
            let rect = targetMonRect;
            this.extWm.move(node.nodeValue, rect);
            this.extWm.movePointerWith(node);
          } else {
            if (position === POSITION.AFTER) {
              currMonWsNode.appendChild(node);
            } else {
              currMonWsNode.insertBefore(node, currMonWsNode.firstChild);
            }
          }
          break;
        default:
          break;
      }
      this.resetSiblingPercent(parentNode);
      this.resetSiblingPercent(parentTarget);
      return true;
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
      let previous = position === POSITION.BEFORE;

      const type = node.nodeType;

      switch (type) {
        case NODE_TYPES.ROOT:
          // Root is the top of the tree
          if (node.childNodes.length > 1) {
            if (previous) {
              return node.firstChild;
            } else {
              return node.lastChild;
            }
          } else {
            return node.firstChild;
          }
        case NODE_TYPES.WORKSPACE:
          // Let gnome-shell handle this?
          break;
        case NODE_TYPES.MONITOR:
          // Find the next monitor
          const nodeWindow = this.findFirstNodeWindowFrom(node);
          return this.nextMonitor(nodeWindow, position, orientation);
      }

      while (node.nodeType !== NODE_TYPES.WORKSPACE) {
        if (node.nodeType === NODE_TYPES.MONITOR) {
          return this.next(node, direction);
        }
        const parentNode = node.parentNode;
        const parentOrientation = Utils.orientationFromLayout(parentNode.layout);

        if (parentNode.childNodes.length > 1 && orientation === parentOrientation) {
          const next = previous ? node.previousSibling : node.nextSibling;
          if (next) {
            return next;
          }
        }
        node = node.parentNode;
      }
    }

    nextMonitor(nodeWindow, position, orientation) {
      if (!nodeWindow) return null;
      // Use the built in logic to determine adjacent monitors
      let monitorNode = null;
      let monitorDirection = Utils.directionFrom(position, orientation);
      let targetMonitor = -1;
      targetMonitor = global.display.get_monitor_neighbor_index(
        nodeWindow.nodeValue.get_monitor(),
        monitorDirection
      );
      if (targetMonitor < 0) return targetMonitor;
      let monWs = `mo${targetMonitor}ws${nodeWindow.nodeValue.get_workspace().index()}`;
      monitorNode = this.findNode(monWs);
      return monitorNode;
    }

    findAncestorMonitor(node) {
      return this.findAncestor(node, NODE_TYPES.MONITOR);
    }

    findAncestor(node, ancestorType) {
      let ancestorNode;

      while (node && ancestorType && !node.isRoot()) {
        if (node.isType(ancestorType)) {
          ancestorNode = node;
          break;
        } else {
          node = node.parentNode;
        }
      }

      return ancestorNode;
    }

    nextVisible(node, direction) {
      if (!node) return null;
      let next = this.next(node, direction);
      if (
        next &&
        next.nodeType === NODE_TYPES.WINDOW &&
        next.nodeValue &&
        next.nodeValue.minimized
      ) {
        next = this.nextVisible(next, direction);
      }
      return next;
    }

    /**
     * Credits: i3-like split
     */
    split(node, orientation, forceSplit = false) {
      if (!node) return;
      let type = node.nodeType;

      if (type === NODE_TYPES.WINDOW && node.mode === Window.WINDOW_MODES.FLOAT) {
        return;
      }

      if (!(type === NODE_TYPES.MONITOR || type === NODE_TYPES.CON || type === NODE_TYPES.WINDOW)) {
        return;
      }

      let parentNode = node.parentNode;
      let numChildren = parentNode.childNodes.length;

      // toggle the split
      if (
        !forceSplit &&
        numChildren === 1 &&
        (parentNode.layout === LAYOUT_TYPES.HSPLIT || parentNode.layout === LAYOUT_TYPES.VSPLIT)
      ) {
        parentNode.layout =
          orientation === ORIENTATION_TYPES.HORIZONTAL ? LAYOUT_TYPES.HSPLIT : LAYOUT_TYPES.VSPLIT;
        this.attachNode = parentNode;
        return;
      }

      // Push down the Meta.Window into a new Container
      let currentIndex = node.index;
      let container = new St.Bin();
      let newConNode = new Node(NODE_TYPES.CON, container);
      newConNode.settings = this.settings;

      // Take the direction of the parent
      newConNode.layout =
        orientation === ORIENTATION_TYPES.HORIZONTAL ? LAYOUT_TYPES.HSPLIT : LAYOUT_TYPES.VSPLIT;
      newConNode.rect = node.rect;
      newConNode.percent = node.percent;
      newConNode.parentNode = parentNode;
      parentNode.childNodes[currentIndex] = newConNode;
      this.createNode(container, node.nodeType, node.nodeValue);
      node.parentNode = newConNode;
      this.attachNode = newConNode;
    }

    swap(node, direction) {
      let nextSwapNode = this.next(node, direction);
      if (!nextSwapNode) {
        return;
      }
      let nodeSwapType = nextSwapNode.nodeType;

      switch (nodeSwapType) {
        case NODE_TYPES.WINDOW:
          break;
        case NODE_TYPES.CON:
        case NODE_TYPES.MONITOR:
          let childWindowNodes = nextSwapNode
            .getNodeByMode(Window.WINDOW_MODES.TILE)
            .filter((t) => t.nodeType === NODE_TYPES.WINDOW);
          if (nextSwapNode.layout === LAYOUT_TYPES.STACKED) {
            nextSwapNode = childWindowNodes[childWindowNodes.length - 1];
          } else {
            nextSwapNode = childWindowNodes[0];
          }
          break;
      }

      let isNextNodeWin =
        nextSwapNode && nextSwapNode.nodeValue && nextSwapNode.nodeType === NODE_TYPES.WINDOW;
      if (isNextNodeWin) {
        if (!this.extWm.sameParentMonitor(node, nextSwapNode)) {
          // TODO, there is a freeze bug if there are not in same monitor.
          return;
        }
        this.swapPairs(node, nextSwapNode);
      }
      return nextSwapNode;
    }

    swapPairs(fromNode, toNode, focus = true) {
      if (!(this._swappable(fromNode) && this._swappable(toNode))) return;
      // Swap the items in the array
      let parentForFrom = fromNode ? fromNode.parentNode : undefined;
      let parentForTo = toNode.parentNode;
      if (parentForTo && parentForFrom) {
        let nextIndex = toNode.index;
        let focusIndex = fromNode.index;

        let transferMode = fromNode.mode;
        fromNode.mode = toNode.mode;
        toNode.mode = transferMode;

        let transferRect = fromNode.nodeValue.get_frame_rect();
        let transferToRect = toNode.nodeValue.get_frame_rect();
        let transferPercent = fromNode.percent;

        fromNode.percent = toNode.percent;
        toNode.percent = transferPercent;

        parentForTo.childNodes[nextIndex] = fromNode;
        fromNode.parentNode = parentForTo;
        parentForFrom.childNodes[focusIndex] = toNode;
        toNode.parentNode = parentForFrom;

        this.extWm.move(fromNode.nodeValue, transferToRect);
        this.extWm.move(toNode.nodeValue, transferRect);

        if (focus) {
          // The fromNode is now on the parent-target
          fromNode.nodeValue.raise();
          fromNode.nodeValue.focus(global.get_current_time());
        }
      }
    }

    _swappable(node) {
      if (!node) return false;
      if (node.nodeType === NODE_TYPES.WINDOW && !node.nodeValue.minimized) {
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
      if (parentNode.childNodes.length === 1 && parentNode.nodeType !== NODE_TYPES.MONITOR) {
        let existParent = parentNode.parentNode;
        oldChild = existParent.removeChild(parentNode);
        cleanUpParent(existParent);
      } else {
        let existParent = node.parentNode;
        oldChild = existParent.removeChild(node);
        if (!this.extWm.floatingWindow(node)) cleanUpParent(existParent);
      }

      if (node === this.attachNode) {
        this.attachNode = null;
      } else {
        // Find the next focus node as attachNode
        this.attachNode = this.findNode(this.extWm.focusMetaWindow);
      }

      return oldChild ? true : false;
    }

    render(from) {
      Logger.debug(`render tree ${from ? "from " + from : ""}`);
      this.processNode(this);
      this.apply(this);
      this.cleanTree();
      let debugMode = true;
      if (debugMode) {
        this.debugTree();
      }
      Logger.debug(`*********************************************`);
    }

    apply(node) {
      if (!node) return;
      let tiledChildren = node
        .getNodeByMode(Window.WINDOW_MODES.TILE)
        .filter((t) => t.nodeType === NODE_TYPES.WINDOW);
      tiledChildren.forEach((w) => {
        if (w.renderRect) {
          if (w.renderRect.width > 0 && w.renderRect.height > 0) {
            let metaWin = w.nodeValue;
            this.extWm.move(metaWin, w.renderRect);
          } else {
            Logger.debug(`ignoring apply for ${w.renderRect.width}x${w.renderRect.height}`);
          }
        }

        if (w.nodeValue.firstRender) w.nodeValue.firstRender = false;
      });
    }

    cleanTree() {
      // Phase 1: remove any cons with empty children
      const orphanCons = this.getNodeByType(NODE_TYPES.CON).filter(
        (c) => c.childNodes.length === 0
      );
      const hasOrphanCons = orphanCons.length > 0;

      orphanCons.forEach((o) => {
        this.removeNode(o);
      });

      // Phase 2: remove any empty parent cons up to the single intermediate parent-window level
      // Basically, flatten them?
      // [con[con[con[con[window]]]]] --> [con[window]]
      // TODO: help :)
      const grandParentCons = this.getNodeByType(NODE_TYPES.CON).filter(
        (c) => c.childNodes.length === 1 && c.childNodes[0].nodeType === NODE_TYPES.CON
      );

      grandParentCons.forEach((c) => {
        c.layout = LAYOUT_TYPES.HSPLIT;
      });

      if (hasOrphanCons) {
        this.processNode(this);
        this.apply(this);
      }
    }

    /**
     *
     * Credits: Do the i3-like calculations
     *
     */
    processNode(node) {
      if (!node) return;

      // Render the Root, Workspace and Monitor
      // For now, we let them render their children recursively
      if (node.nodeType === NODE_TYPES.ROOT) {
        node.childNodes.forEach((child) => {
          this.processNode(child);
        });
      }

      if (node.nodeType === NODE_TYPES.WORKSPACE) {
        node.childNodes.forEach((child) => {
          this.processNode(child);
        });
      }

      let params = {};

      if (node.nodeType === NODE_TYPES.MONITOR || node.nodeType === NODE_TYPES.CON) {
        // The workarea from Meta.Window's assigned monitor
        // is important so it computes to `remove` the panel size
        // really well. However, this type of workarea would only
        // appear if there is window present on the monitor.
        if (node.childNodes.length === 0) {
          return;
        }

        // If monitor, get the workarea
        if (node.nodeType === NODE_TYPES.MONITOR) {
          let monitorIndex = Utils.monitorIndex(node.nodeValue);
          let monitorArea = global.display
            .get_workspace_manager()
            .get_active_workspace()
            .get_work_area_for_monitor(monitorIndex);
          if (!monitorArea) return; // there is no visible child window
          node.rect = monitorArea;
          node.rect = this.processGap(node);
        }

        let tiledChildren = this.getTiledChildren(node.childNodes);
        let sizes = this.computeSizes(node, tiledChildren);

        params.sizes = sizes;
        let showTabs = this.settings.get_boolean("showtab-decoration-enabled");
        params.stackedHeight = showTabs ? this.defaultStackHeight * Utils.dpi() : 0;
        params.tiledChildren = tiledChildren;

        let decoration = node.decoration;

        if (decoration) {
          let decoChildren = decoration.get_children();
          decoChildren.forEach((decoChild) => {
            decoration.remove_child(decoChild);
          });
        }

        tiledChildren.forEach((child, index) => {
          // A monitor can contain a window or container child
          if (node.layout === LAYOUT_TYPES.HSPLIT || node.layout === LAYOUT_TYPES.VSPLIT) {
            this.processSplit(node, child, params, index);
          } else if (node.layout === LAYOUT_TYPES.STACKED) {
            this.processStacked(node, child, params, index);
          } else if (node.layout === LAYOUT_TYPES.TABBED) {
            this.processTabbed(node, child, params, index);
          }
          this.processNode(child);
        });
      }

      if (node.isWindow()) {
        if (!node.rect) node.rect = node.nodeValue.get_work_area_current_monitor();
        node.renderRect = this.processGap(node);
      }
    }

    processGap(node) {
      let nodeWidth = node.rect.width;
      let nodeHeight = node.rect.height;
      let nodeX = node.rect.x;
      let nodeY = node.rect.y;
      let gap = this.extWm.calculateGaps();

      if (nodeWidth > gap * 2 && nodeHeight > gap * 2) {
        nodeX += gap;
        nodeY += gap;

        // TODO - detect inbetween windows and adjust accordingly
        // Also adjust depending on display scaling
        nodeWidth -= gap * 2;
        nodeHeight -= gap * 2;
      }
      return { x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight };
    }

    processSplit(node, child, params, index) {
      let layout = node.layout;
      let nodeRect = node.rect;
      let nodeWidth;
      let nodeHeight;
      let nodeX;
      let nodeY;

      if (layout === LAYOUT_TYPES.HSPLIT) {
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
      } else if (layout === LAYOUT_TYPES.VSPLIT) {
        // split vertically
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

      child.rect = {
        x: nodeX,
        y: nodeY,
        width: nodeWidth,
        height: nodeHeight,
      };
    }

    /**
     * Process the child node here for the dimensions of the child stack/window,
     * It will be moved to the Node class in the future as Node.render()
     *
     */
    processStacked(node, child, params, index) {
      let layout = node.layout;
      let nodeWidth = node.rect.width;
      let nodeHeight = node.rect.height;
      let nodeX = node.rect.x;
      let nodeY = node.rect.y;
      let stackHeight = this.defaultStackHeight;

      if (layout === LAYOUT_TYPES.STACKED) {
        if (node.childNodes.length > 1) {
          nodeY += stackHeight * index;
          nodeHeight -= stackHeight * index;
        }

        child.rect = {
          x: nodeX,
          y: nodeY,
          width: nodeWidth,
          height: nodeHeight,
        };
      }
    }

    /**
     * Process the child node here for the dimensions of the child tab/window,
     * It will be moved to the Node class in the future as Node.render()
     *
     */
    processTabbed(node, child, params, _index) {
      let layout = node.layout;
      let nodeRect = node.rect;
      let nodeWidth;
      let nodeHeight;
      let nodeX;
      let nodeY;

      if (layout === LAYOUT_TYPES.TABBED) {
        nodeWidth = nodeRect.width;
        nodeX = nodeRect.x;
        nodeY = nodeRect.y;
        nodeHeight = nodeRect.height;

        let alwaysShowDecorationTab = true;

        if (node.childNodes.length > 1 || alwaysShowDecorationTab) {
          nodeY = nodeRect.y + params.stackedHeight;
          nodeHeight = nodeRect.height - params.stackedHeight;
          if (node.decoration && child.isWindow()) {
            let gap = this.extWm.calculateGaps();
            let renderRect = this.processGap(node);
            let borderWidth = child.actor.border.get_theme_node().get_border_width(St.Side.TOP);

            // Make adjustments to the gaps
            let adjust = 4 * Utils.dpi();
            let adjustWidth = renderRect.width + (borderWidth * 2 + gap) / adjust;
            let adjustX = renderRect.x - (gap + borderWidth * 2) / (adjust * 2);
            let adjustY = renderRect.y - adjust;

            if (gap === 0) {
              adjustY = renderRect.y;
              nodeY = renderRect.y + params.stackedHeight + adjust / 4;
            }

            let decoration = node.decoration;

            if (decoration !== null && decoration !== undefined) {
              decoration.set_size(adjustWidth, params.stackedHeight);
              decoration.set_position(adjustX, adjustY);
              if (params.tiledChildren.length > 0 && params.stackedHeight !== 0) {
                decoration.show();
              } else {
                decoration.hide();
              }
              if (!decoration.contains(child.tab)) decoration.add(child.tab);
            }

            child.render();
          }
        }

        child.rect = {
          x: nodeX,
          y: nodeY,
          width: nodeWidth,
          height: nodeHeight,
        };
      }
    }

    computeSizes(node, childItems) {
      let sizes = [];
      let orientation = Utils.orientationFromLayout(node.layout);
      let totalSize =
        orientation === ORIENTATION_TYPES.HORIZONTAL ? node.rect.width : node.rect.height;
      let grabTiled = node.getNodeByMode(Window.WINDOW_MODES.GRAB_TILE).length > 0;
      childItems.forEach((childNode, index) => {
        let percent =
          childNode.percent && childNode.percent > 0.0 && !grabTiled
            ? childNode.percent
            : 1.0 / childItems.length;
        sizes[index] = Math.floor(percent * totalSize);
      });
      // TODO - make sure the totalSize = the sizes total
      return sizes;
    }

    findFirstNodeWindowFrom(node) {
      let results = node.getNodeByType(NODE_TYPES.WINDOW);
      if (results.length > 0) {
        return results[0];
      }
      return null;
    }

    resetSiblingPercent(parentNode) {
      if (!parentNode) return;
      let children = parentNode.childNodes;
      children.forEach((n) => {
        n.percent = 0.0;
      });
    }

    debugTree() {
      this.debugNode(this);
    }

    debugNode(node) {
      let spacing = "";
      let dashes = "-->";
      let level = node.level;
      for (let i = 0; i < level; i++) {
        let parentSpacing = i === 0 ? " " : "|";
        spacing += `${parentSpacing}   `;
      }
      let rootSpacing = level === 0 ? "#" : "*";

      let attributes = "";

      if (node.isWindow()) {
        let metaWindow = node.nodeValue;
        attributes += `class:'${metaWindow.get_wm_class()}',title:'${
          metaWindow.title
        }',string:'${metaWindow}'${metaWindow === this.extWm.focusMetaWindow ? " FOCUS" : ""}`;
      } else if (node.isCon() || node.isMonitor() || node.isWorkspace()) {
        attributes += `${node.nodeValue}`;
        if (node.isCon() || node.isMonitor()) {
          attributes += `,layout:${node.layout}`;
        }
      }

      if (node.rect) {
        attributes += `,rect:${node.rect.width}x${node.rect.height}+${node.rect.x}+${node.rect.y}`;
      }

      if (level !== 0) Logger.debug(`${spacing}|`);
      Logger.debug(
        `${spacing}${rootSpacing}${dashes} ${node.nodeType}#${
          node.index !== null ? node.index : "-"
        } @${attributes}`
      );

      node.childNodes.forEach((child) => {
        this.debugNode(child);
      });
    }
  }
);
