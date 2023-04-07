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
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

// Gnome Shell imports
const DND = imports.ui.dnd;
const Overview = imports.ui.main.overview;
const SessionMode = imports.ui.main.sessionMode;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Keybindings = Me.imports.keybindings;
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;
const Theme = Me.imports.theme;
const Tree = Me.imports.tree;
const Utils = Me.imports.utils;

var WINDOW_MODES = Utils.createEnum(["FLOAT", "TILE", "GRAB_TILE", "DEFAULT"]);

// Simplify the grab modes
var GRAB_TYPES = Utils.createEnum(["RESIZING", "MOVING", "UNKNOWN"]);

var WindowManager = GObject.registerClass(
  class WindowManager extends GObject.Object {
    _init(ext) {
      super._init();
      this.ext = ext;
      this.windowProps = this.ext.configMgr.windowProps;
      this._kbd = this.ext.keybindings;
      this._tree = new Tree.Tree(this);
      this.eventQueue = new Tree.Queue();
      this.theme = this.ext.theme;
      Logger.info("forge initialized");
    }

    addFloatOverride(metaWindow, byClass = true) {
      let overrides = this.windowProps.overrides;
      let wmTitle = metaWindow.get_title();
      let wmClass = metaWindow.get_wm_class();

      for (let override in overrides) {
        if (!byClass) {
          if (override.wmClass === wmClass && override.wmTitle === wmTitle) return;
        } else {
          if (override.wmClass === wmClass && !override.wmTitle) return;
        }
      }
      overrides.push({
        wmClass: wmClass,
        wmTitle: !byClass ? wmTitle : undefined,
        mode: "float",
      });
      this.windowProps.overrides = overrides;
      this.ext.configMgr.windowProps = this.windowProps;
    }

    removeFloatOverride(metaWindow, byClass = true) {
      let overrides = this.windowProps.overrides;
      let wmTitle = metaWindow.get_title();
      let wmClass = metaWindow.get_wm_class();

      if (byClass) {
        // remove purely wmClass - by checking also if override title exists
        overrides = overrides.filter(
          (override) => !(override.wmClass === wmClass) && !override.wmTitle
        );
      } else {
        overrides = overrides.filter(
          (override) => !(override.wmClass === wmClass && override.wmTitle === wmTitle)
        );
      }

      this.windowProps.overrides = overrides;
      this.ext.configMgr.windowProps = this.windowProps;
    }

    toggleFloatingMode(action, metaWindow) {
      let nodeWindow = this.findNodeWindow(metaWindow);
      if (!nodeWindow || !(action || action.mode)) return;
      if (nodeWindow.nodeType !== Tree.NODE_TYPES.WINDOW) return;

      let floatToggle = action.name === "FloatToggle";
      let floatClassToggle = action.name === "FloatClassToggle";
      let floatingExempt = this.isFloatingExempt(metaWindow);

      if (floatingExempt) {
        if (floatClassToggle) {
          this.removeFloatOverride(metaWindow);
        } else if (floatToggle) {
          this.removeFloatOverride(metaWindow, false);
        }
        nodeWindow.mode = WINDOW_MODES.TILE;
        if (!this.isActiveWindowWorkspaceTiled(metaWindow)) {
          nodeWindow.mode = WINDOW_MODES.FLOAT;
        }
      } else {
        if (floatClassToggle) {
          this.addFloatOverride(metaWindow);
        } else if (floatToggle) {
          this.addFloatOverride(metaWindow, false);
        }
        nodeWindow.mode = WINDOW_MODES.FLOAT;
      }
    }

    queueEvent(eventObj, interval = 220) {
      this.eventQueue.enqueue(eventObj);

      if (!this._queueSourceId) {
        this._queueSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
          const currEventObj = this.eventQueue.dequeue();
          if (currEventObj) {
            currEventObj.callback();
          }
          const result = this.eventQueue.length !== 0;
          if (!result) {
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
      if (this._signalsBound) return;

      const display = global.display;
      const shellWm = global.window_manager;

      this._displaySignals = [
        display.connect("window-created", this.trackWindow.bind(this)),
        display.connect("grab-op-begin", this._handleGrabOpBegin.bind(this)),
        display.connect("window-entered-monitor", (_, monitor, metaWindow) => {
          this.updateMetaWorkspaceMonitor("window-entered-monitor", monitor, metaWindow);
          this.trackCurrentMonWs();
        }),
        display.connect("grab-op-end", this._handleGrabOpEnd.bind(this)),
        display.connect("showing-desktop-changed", () => {
          this.hideWindowBorders();
          this.updateDecorationLayout();
        }),
        display.connect("in-fullscreen-changed", () => {
          this.renderTree("full-screen-changed");
        }),
        display.connect("workareas-changed", (_display) => {
          if (global.display.get_n_monitors() == 0) {
            Logger.debug(`workareas-changed: no monitors, ignoring signal`);
            return;
          }
          if (this.tree.getNodeByType("WINDOW").length > 0) {
            let workspaceReload = this.workspaceAdded || this.workspaceRemoved;
            if (workspaceReload) {
              this.trackCurrentWindows();
              this.workspaceRemoved = false;
              this.workspaceAdded = false;
            } else {
              this.renderTree("workareas-changed");
            }
          }
        }),
      ];

      this._windowManagerSignals = [
        shellWm.connect("minimize", () => {
          this.hideWindowBorders();
          let focusNodeWindow = this.tree.findNode(this.focusMetaWindow);
          if (focusNodeWindow) {
            if (this.tree.getTiledChildren(focusNodeWindow.parentNode.childNodes).length === 0) {
              this.tree.resetSiblingPercent(focusNodeWindow.parentNode.parentNode);
            }
            this.tree.resetSiblingPercent(focusNodeWindow.parentNode);
          }

          let prevFrozen = this._freezeRender;
          if (prevFrozen) this.unfreezeRender();
          this.renderTree("minimize");
          if (prevFrozen) this.freezeRender();
        }),
        shellWm.connect("unminimize", () => {
          let focusNodeWindow = this.tree.findNode(this.focusMetaWindow);
          if (focusNodeWindow) {
            this.tree.resetSiblingPercent(focusNodeWindow.parentNode);
          }

          let prevFrozen = this._freezeRender;
          if (prevFrozen) this.unfreezeRender();
          this.renderTree("unminimize");
          if (prevFrozen) this.freezeRender();
        }),
        shellWm.connect("show-tile-preview", (_, _metaWindow, _rect, _num) => {
          // Empty
        }),
      ];

      const globalWsm = global.workspace_manager;

      this._workspaceManagerSignals = [
        globalWsm.connect("showing-desktop-changed", () => {
          this.hideWindowBorders();
          this.updateDecorationLayout();
        }),
        globalWsm.connect("workspace-added", (_, wsIndex) => {
          this.tree.addWorkspace(wsIndex);
          this.trackCurrentMonWs();
          this.workspaceAdded = true;
          this.renderTree("workspace-added");
        }),
        globalWsm.connect("workspace-removed", (_, wsIndex) => {
          this.tree.removeWorkspace(wsIndex);
          this.trackCurrentMonWs();
          this.workspaceRemoved = true;
          this.updateDecorationLayout();
          this.renderTree("workspace-removed");
        }),
        globalWsm.connect("active-workspace-changed", () => {
          this.hideWindowBorders();
          this.ext.indicator.updateTileIcon();
          this.trackCurrentMonWs();
          this.updateDecorationLayout();
          this.renderTree("active-workspace-changed");
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
            this.renderTree(settingName);
            break;
          case "tiling-mode-enabled":
            this.renderTree(settingName);
            break;
          case "window-gap-size-increment":
          case "window-gap-size":
          case "window-gap-hidden-on-single":
          case "workspace-skip-tile":
            this.renderTree(settingName, true);
            break;
          case "stacked-tiling-mode-enabled":
            if (!settings.get_boolean(settingName)) {
              let stackedNodes = this.tree.getNodeByLayout(Tree.LAYOUT_TYPES.STACKED);
              stackedNodes.forEach((node) => {
                node.prevLayout = node.layout;
                node.layout = this.determineSplitLayout();
              });
            } else {
              let hSplitNodes = this.tree.getNodeByLayout(Tree.LAYOUT_TYPES.HSPLIT);
              let vSplitNodes = this.tree.getNodeByLayout(Tree.LAYOUT_TYPES.VSPLIT);
              Array.prototype.push.apply(hSplitNodes, vSplitNodes);
              hSplitNodes.forEach((node) => {
                if (node.prevLayout && node.prevLayout === Tree.LAYOUT_TYPES.STACKED) {
                  node.layout = Tree.LAYOUT_TYPES.STACKED;
                }
              });
            }
            this.renderTree(settingName);
            break;
          case "tabbed-tiling-mode-enabled":
            if (!settings.get_boolean(settingName)) {
              let tabbedNodes = this.tree.getNodeByLayout(Tree.LAYOUT_TYPES.TABBED);
              tabbedNodes.forEach((node) => {
                node.prevLayout = node.layout;
                node.layout = this.determineSplitLayout();
              });
            } else {
              let hSplitNodes = this.tree.getNodeByLayout(Tree.LAYOUT_TYPES.HSPLIT);
              let vSplitNodes = this.tree.getNodeByLayout(Tree.LAYOUT_TYPES.VSPLIT);
              Array.prototype.push.apply(hSplitNodes, vSplitNodes);
              hSplitNodes.forEach((node) => {
                if (node.prevLayout && node.prevLayout === Tree.LAYOUT_TYPES.TABBED) {
                  node.layout = Tree.LAYOUT_TYPES.TABBED;
                }
              });
            }
            this.renderTree(settingName);
            break;
          case "css-updated":
            this.theme.reloadStylesheet();
            break;
          case "float-always-on-top-enabled":
            if (!settings.get_boolean(settingName)) {
              this.cleanupAlwaysFloat();
            } else {
              this.restoreAlwaysFloat();
            }
            break;
          default:
            break;
        }
      });

      this._overviewSignals = [
        Overview.connect("hiding", () => {
          this.fromOverview = true;
          const eventObj = {
            name: "focus-after-overview",
            callback: () => {
              const focusNodeWindow = this.tree.findNode(this.focusMetaWindow);
              this.updateStackedFocus(focusNodeWindow);
              this.updateTabbedFocus(focusNodeWindow);
            },
          };
          this.queueEvent(eventObj);
        }),
        Overview.connect("showing", () => {
          this.toOverview = true;
        }),
      ];

      this._signalsBound = true;
    }

    cleanupAlwaysFloat() {
      // remove the setting for each node window
      this.allNodeWindows.forEach((w) => {
        if (w.mode === WINDOW_MODES.FLOAT) {
          w.nodeValue.is_above() && w.nodeValue.unmake_above();
        }
      });
    }

    restoreAlwaysFloat() {
      this.allNodeWindows.forEach((w) => {
        if (w.mode === WINDOW_MODES.FLOAT) {
          !w.nodeValue.is_above() && w.nodeValue.make_above();
        }
      });
    }

    trackCurrentMonWs() {
      let metaWindow = this.focusMetaWindow;
      if (!metaWindow) return;
      const currentMonitor = global.display.get_current_monitor();
      const currentWorkspace = global.display.get_workspace_manager().get_active_workspace_index();

      let currentMonWs = `mo${currentMonitor}ws${currentWorkspace}`;
      let activeMetaMonWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
      let currentWsNode = this.tree.findNode(`ws${currentWorkspace}`);

      if (!currentWsNode) {
        return;
      }

      // Search for all the valid windows on the workspace
      const monWindows = currentWsNode.getNodeByType(Tree.NODE_TYPES.WORKSPACE).flatMap((ws) => {
        return ws
          .getNodeByType(Tree.NODE_TYPES.WINDOW)
          .filter(
            (w) =>
              !w.nodeValue.minimized &&
              w.isTile() &&
              w.nodeValue !== metaWindow &&
              // The searched window should be on the same monitor workspace
              // This ensures that Forge already updated the workspace node tree:
              currentMonWs === activeMetaMonWs
          )
          .map((w) => w.nodeValue);
      });

      this.sortedWindows = global.display.sort_windows_by_stacking(monWindows).reverse();
    }

    // TODO move this to workspace.js
    bindWorkspaceSignals(metaWorkspace) {
      if (metaWorkspace) {
        if (!metaWorkspace.workspaceSignals) {
          let workspaceSignals = [
            metaWorkspace.connect("window-added", (_, metaWindow) => {
              if (!this._wsWindowAddSrcId) {
                this._wsWindowAddSrcId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                  this.updateMetaWorkspaceMonitor(
                    "window-added",
                    metaWindow.get_monitor(),
                    metaWindow
                  );
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
      // Do not check if the node window is null, some of the commands do not need the focus window
      let focusNodeWindow = this.findNodeWindow(focusWindow);
      let currentLayout;

      switch (action.name) {
        case "FloatToggle":
        case "FloatClassToggle":
          this.toggleFloatingMode(action, focusWindow);

          const rectRequest = {
            x: action.x,
            y: action.y,
            width: action.width,
            height: action.height,
          };

          let moveRect = {
            x: Utils.resolveX(rectRequest, focusWindow),
            y: Utils.resolveY(rectRequest, focusWindow),
            width: Utils.resolveWidth(rectRequest, focusWindow),
            height: Utils.resolveHeight(rectRequest, focusWindow),
          };

          this.move(focusWindow, moveRect);

          let existParent = focusNodeWindow.parentNode;

          if (this.tree.getTiledChildren(existParent.childNodes).length <= 1) {
            existParent.percent = 0.0;
            this.tree.resetSiblingPercent(existParent.parentNode);
          }

          this.tree.resetSiblingPercent(existParent);
          this.renderTree("float-toggle", true);
          break;
        case "Move":
          this.unfreezeRender();
          let moveDirection = Utils.resolveDirection(action.direction);
          let prev = focusNodeWindow;
          let moved = this.tree.move(focusNodeWindow, moveDirection);
          if (!focusNodeWindow) {
            focusNodeWindow = this.findNodeWindow(this.focusMetaWindow);
          }
          this.queueEvent({
            name: "move",
            callback: () => {
              if (this.eventQueue.length <= 0) {
                this.unfreezeRender();
                if (focusNodeWindow.parentNode.layout === Tree.LAYOUT_TYPES.STACKED) {
                  focusNodeWindow.parentNode.appendChild(focusNodeWindow);
                  focusNodeWindow.nodeValue.raise();
                  focusNodeWindow.nodeValue.activate(global.display.get_current_time());
                  this.renderTree("move-stacked-queue");
                }
                if (focusNodeWindow.parentNode.layout === Tree.LAYOUT_TYPES.TABBED) {
                  focusNodeWindow.nodeValue.raise();
                  focusNodeWindow.nodeValue.activate(global.display.get_current_time());
                  if (prev) prev.parentNode.lastTabFocus = prev.nodeValue;
                  this.renderTree("move-tabbed-queue");
                }
              }
            },
          });
          if (moved) {
            if (prev) prev.parentNode.lastTabFocus = prev.nodeValue;
            this.renderTree("move-window");
          }

          break;
        case "Focus":
          let focusDirection = Utils.resolveDirection(action.direction);
          focusNodeWindow = this.tree.focus(focusNodeWindow, focusDirection);
          if (!focusNodeWindow) {
            focusNodeWindow = this.findNodeWindow(this.focusMetaWindow);
          }
          break;
        case "Swap":
          if (!focusNodeWindow) return;
          this.unfreezeRender();
          let swapDirection = Utils.resolveDirection(action.direction);
          this.tree.swap(focusNodeWindow, swapDirection);
          focusNodeWindow.nodeValue.raise();
          this.updateTabbedFocus(focusNodeWindow);
          this.updateStackedFocus(focusNodeWindow);
          this.renderTree("swap", true);
          break;
        case "Split":
          if (!focusNodeWindow) return;
          currentLayout = focusNodeWindow.parentNode.layout;
          if (
            currentLayout === Tree.LAYOUT_TYPES.STACKED ||
            currentLayout === Tree.LAYOUT_TYPES.TABBED
          ) {
            return;
          }
          let orientation = action.orientation
            ? action.orientation.toUpperCase()
            : Tree.ORIENTATION_TYPES.NONE;
          this.tree.split(focusNodeWindow, orientation);
          this.renderTree("split");
          break;
        case "LayoutToggle":
          if (!focusNodeWindow) return;
          currentLayout = focusNodeWindow.parentNode.layout;
          if (currentLayout === Tree.LAYOUT_TYPES.HSPLIT) {
            focusNodeWindow.parentNode.layout = Tree.LAYOUT_TYPES.VSPLIT;
          } else if (currentLayout === Tree.LAYOUT_TYPES.VSPLIT) {
            focusNodeWindow.parentNode.layout = Tree.LAYOUT_TYPES.HSPLIT;
          }
          this.tree.attachNode = focusNodeWindow.parentNode;
          this.renderTree("layout-split-toggle");
          break;
        case "FocusBorderToggle":
          let focusBorderEnabled = this.ext.settings.get_boolean("focus-border-toggle");
          this.ext.settings.set_boolean("focus-border-toggle", !focusBorderEnabled);
          break;
        case "TilingModeToggle":
          // FIXME, not sure if this toggle is still needed from a use case
          // perspective, since Extension.disable also should do the same thing.
          let tilingModeEnabled = this.ext.settings.get_boolean("tiling-mode-enabled");
          this.ext.settings.set_boolean("tiling-mode-enabled", !tilingModeEnabled);
          if (tilingModeEnabled) {
            this.floatAllWindows();
          } else {
            this.unfloatAllWindows();
          }
          this.renderTree(`tiling-mode-toggle ${!tilingModeEnabled}`);
          break;
        case "GapSize":
          let gapIncrement = this.ext.settings.get_uint("window-gap-size-increment");
          let amount = action.amount;
          gapIncrement = gapIncrement + amount;
          if (gapIncrement < 0) gapIncrement = 0;
          if (gapIncrement > 8) gapIncrement = 8;
          this.ext.settings.set_uint("window-gap-size-increment", gapIncrement);
          break;
        case "WorkspaceActiveTileToggle":
          let activeWorkspace = global.workspace_manager.get_active_workspace_index();
          let skippedWorkspaces = this.ext.settings.get_string("workspace-skip-tile");
          let workspaceSkipped = false;
          let skippedArr = [];
          if (skippedWorkspaces.length === 0) {
            skippedArr.push(`${activeWorkspace}`);
            this.floatWorkspace(activeWorkspace);
          } else {
            skippedArr = skippedWorkspaces.split(",");

            for (let i = 0; i < skippedArr.length; i++) {
              if (`${skippedArr[i]}` === `${activeWorkspace}`) {
                workspaceSkipped = true;
                break;
              }
            }

            if (workspaceSkipped) {
              // tile this workspace
              let indexWs = skippedArr.indexOf(`${activeWorkspace}`);
              skippedArr.splice(indexWs, 1);
              this.unfloatWorkspace(activeWorkspace);
            } else {
              // skip tiling workspace
              skippedArr.push(`${activeWorkspace}`);
              this.floatWorkspace(activeWorkspace);
            }
          }
          this.ext.settings.set_string("workspace-skip-tile", skippedArr.toString());
          this.renderTree("workspace-toggle");
          break;
        case "LayoutStackedToggle":
          if (!focusNodeWindow) return;
          if (!this.ext.settings.get_boolean("stacked-tiling-mode-enabled")) return;

          if (focusNodeWindow.parentNode.isMonitor()) {
            this.tree.split(focusNodeWindow, Tree.ORIENTATION_TYPES.HORIZONTAL, true);
          }

          currentLayout = focusNodeWindow.parentNode.layout;

          if (currentLayout === Tree.LAYOUT_TYPES.STACKED) {
            focusNodeWindow.parentNode.layout = this.determineSplitLayout();
            this.tree.resetSiblingPercent(focusNodeWindow.parentNode);
          } else {
            if (currentLayout === Tree.LAYOUT_TYPES.TABBED) {
              focusNodeWindow.parentNode.lastTabFocus = null;
            }
            focusNodeWindow.parentNode.layout = Tree.LAYOUT_TYPES.STACKED;
            let lastChild = focusNodeWindow.parentNode.lastChild;
            if (lastChild.nodeType === Tree.NODE_TYPES.WINDOW) {
              lastChild.nodeValue.activate(global.display.get_current_time());
            }
          }
          this.unfreezeRender();
          this.tree.attachNode = focusNodeWindow.parentNode;
          this.renderTree("layout-stacked-toggle");
          break;
        case "LayoutTabbedToggle":
          if (!focusNodeWindow) return;
          if (!this.ext.settings.get_boolean("tabbed-tiling-mode-enabled")) return;

          if (focusNodeWindow.parentNode.isMonitor()) {
            this.tree.split(focusNodeWindow, Tree.ORIENTATION_TYPES.HORIZONTAL, true);
          }

          currentLayout = focusNodeWindow.parentNode.layout;

          if (currentLayout === Tree.LAYOUT_TYPES.TABBED) {
            focusNodeWindow.parentNode.layout = this.determineSplitLayout();
            this.tree.resetSiblingPercent(focusNodeWindow.parentNode);
            focusNodeWindow.parentNode.lastTabFocus = null;
          } else {
            focusNodeWindow.parentNode.layout = Tree.LAYOUT_TYPES.TABBED;
            focusNodeWindow.parentNode.lastTabFocus = focusNodeWindow.nodeValue;
          }
          this.unfreezeRender();
          this.tree.attachNode = focusNodeWindow.parentNode;
          this.renderTree("layout-tabbed-toggle");
          break;
        case "CancelOperation":
          if (focusNodeWindow.mode === WINDOW_MODES.GRAB_TILE) {
            this.cancelGrab = true;
          }
          break;
        case "PrefsOpen":
          let existWindow = Utils.findWindowWith(Msgs.prefs_title);
          if (existWindow && existWindow.get_workspace()) {
            existWindow
              .get_workspace()
              .activate_with_focus(existWindow, global.display.get_current_time());
            this.moveCenter(existWindow);
          } else {
            ExtensionUtils.openPrefs();
          }
          break;
        case "WindowSwapLastActive":
          if (focusNodeWindow) {
            let lastActiveWindow = global.display.get_tab_next(
              Meta.TabList.NORMAL,
              global.display.get_workspace_manager().get_active_workspace(),
              focusNodeWindow.nodeValue,
              false
            );
            let lastActiveNodeWindow = this.tree.findNode(lastActiveWindow);
            this.tree.swapPairs(lastActiveNodeWindow, focusNodeWindow);
            this.renderTree("swap-last-active");
          }
          break;
        case "SnapLayoutMove":
          if (focusNodeWindow) {
            let workareaRect = focusNodeWindow.nodeValue.get_work_area_current_monitor();
            let layoutAmount = action.amount;
            let layoutDirection = action.direction.toUpperCase();
            let layout = {};
            let processGap = false;

            switch (layoutDirection) {
              case "LEFT":
                layout.width = layoutAmount * workareaRect.width;
                layout.height = workareaRect.height;
                layout.x = workareaRect.x;
                layout.y = workareaRect.y;
                processGap = true;
                break;
              case "RIGHT":
                layout.width = layoutAmount * workareaRect.width;
                layout.height = workareaRect.height;
                layout.x = workareaRect.x + (workareaRect.width - layout.width);
                layout.y = workareaRect.y;
                processGap = true;
                break;
              case "CENTER":
                let metaRect = this.focusMetaWindow.get_frame_rect();
                layout.x = "center";
                layout.y = "center";
                layout = {
                  x: Utils.resolveX(layout, this.focusMetaWindow),
                  y: Utils.resolveY(layout, this.focusMetaWindow),
                  width: metaRect.width,
                  height: metaRect.height,
                };
                break;
              default:
                break;
            }
            focusNodeWindow.rect = layout;
            if (processGap) {
              focusNodeWindow.rect = this.tree.processGap(focusNodeWindow);
            }
            if (!focusNodeWindow.isFloat()) {
              this.addFloatOverride(focusNodeWindow.nodeValue, false);
            }
            this.move(focusNodeWindow.nodeValue, focusNodeWindow.rect);
            this.queueEvent({
              name: "snap-layout-move",
              callback: () => {
                this.renderTree("snap-layout-move");
              },
            });
          }

        case "ShowTabDecorationToggle":
          if (!focusNodeWindow) return;
          if (!this.ext.settings.get_boolean("tabbed-tiling-mode-enabled")) return;

          let showTabs = this.ext.settings.get_boolean("showtab-decoration-enabled");
          this.ext.settings.set_boolean("showtab-decoration-enabled", !showTabs);

          this.unfreezeRender();
          this.tree.attachNode = focusNodeWindow.parentNode;
          this.renderTree("showtab-decoration-enabled");
          break;

        default:
          break;
      }
    }

    disable() {
      Utils._disableDecorations();
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
      return this.tree.findNode(metaWindow);
    }

    get focusMetaWindow() {
      return global.display.get_focus_window();
    }

    get tree() {
      if (!this._tree) {
        this._tree = new Tree.Tree(this);
      }
      return this._tree;
    }

    get kbd() {
      if (!this._kbd) {
        this._kbd = new Keybindings.Keybindings(this.ext);
        this.ext.keybindings = this._kbd;
      }

      return this._kbd;
    }

    get windowsActiveWorkspace() {
      let wsManager = global.workspace_manager;
      return global.display.get_tab_list(Meta.TabList.NORMAL_ALL, wsManager.get_active_workspace());
    }

    get windowsAllWorkspaces() {
      let wsManager = global.workspace_manager;
      let windowsAll = [];

      for (let i = 0; i < wsManager.get_n_workspaces(); i++) {
        Array.prototype.push.apply(
          windowsAll,
          global.display.get_tab_list(Meta.TabList.NORMAL_ALL, wsManager.get_workspace_by_index(i))
        );
      }
      windowsAll.sort((w1, w2) => {
        return w1.get_stable_sequence() - w2.get_stable_sequence();
      });
      return windowsAll;
    }

    getWindowsOnWorkspace(workspaceIndex) {
      const workspaceNode = this.tree.findNode(`ws${workspaceIndex}`);
      const workspaceWindows = workspaceNode.getNodeByType(Tree.NODE_TYPES.WINDOW);
      return workspaceWindows;
    }

    determineSplitLayout() {
      // if the monitor width is less than height, the monitor could be vertical orientation;
      let monitorRect = global.display.get_monitor_geometry(global.display.get_current_monitor());
      if (monitorRect.width < monitorRect.height) {
        return Tree.LAYOUT_TYPES.VSPLIT;
      }
      return Tree.LAYOUT_TYPES.HSPLIT;
    }

    floatWorkspace(workspaceIndex) {
      const workspaceWindows = this.getWindowsOnWorkspace(workspaceIndex);
      if (!workspaceWindows) return;
      workspaceWindows.forEach((w) => {
        w.float = true;
      });
    }

    unfloatWorkspace(workspaceIndex) {
      const workspaceWindows = this.getWindowsOnWorkspace(workspaceIndex);
      if (!workspaceWindows) return;
      workspaceWindows.forEach((w) => {
        w.tile = true;
      });
    }

    hideWindowBorders() {
      this.tree.nodeWindows.forEach((nodeWindow) => {
        let actor = nodeWindow.windowActor;
        if (actor) {
          if (actor.border) {
            actor.border.hide();
          }
          if (actor.splitBorder) {
            actor.splitBorder.hide();
          }
        }
        if (nodeWindow.parentNode.isTabbed()) {
          if (nodeWindow.tab) {
            // TODO: review the cleanup of the tab:St.Widget variable
            try {
              nodeWindow.tab.remove_style_class_name("window-tabbed-tab-active");
            } catch (e) {
              Logger.warn(e);
            }
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
      metaWindow.move_resize_frame(true, rect.x, rect.y, rect.width, rect.height);
    }

    moveCenter(metaWindow) {
      if (!metaWindow) return;
      let frameRect = metaWindow.get_frame_rect();
      const rectRequest = {
        x: "center",
        y: "center",
        width: frameRect.width,
        height: frameRect.height,
      };

      let moveRect = {
        x: Utils.resolveX(rectRequest, metaWindow),
        y: Utils.resolveY(rectRequest, metaWindow),
        width: Utils.resolveWidth(rectRequest, metaWindow),
        height: Utils.resolveHeight(rectRequest, metaWindow),
      };
      this.move(metaWindow, moveRect);
    }

    rectForMonitor(node, targetMonitor) {
      if (!node || (node && node.nodeType !== Tree.NODE_TYPES.WINDOW)) return null;
      if (targetMonitor < 0) return null;
      let currentWorkArea = node.nodeValue.get_work_area_current_monitor();
      let nextWorkArea = node.nodeValue.get_work_area_for_monitor(targetMonitor);

      if (currentWorkArea && nextWorkArea) {
        let rect = node.rect;
        if (!rect && node.mode === WINDOW_MODES.FLOAT) {
          rect = node.nodeValue.get_frame_rect();
        }
        let hRatio = 1;
        let wRatio = 1;

        hRatio = nextWorkArea.height / currentWorkArea.height;
        wRatio = nextWorkArea.width / currentWorkArea.width;
        rect.height *= hRatio;
        rect.width *= wRatio;

        if (nextWorkArea.y < currentWorkArea.y) {
          rect.y =
            ((nextWorkArea.y + rect.y - currentWorkArea.y) / currentWorkArea.height) *
            nextWorkArea.height;
        } else if (nextWorkArea.y > currentWorkArea.y) {
          rect.y = (rect.y / currentWorkArea.height) * nextWorkArea.height + nextWorkArea.y;
        }

        if (nextWorkArea.x < currentWorkArea.x) {
          rect.x =
            ((nextWorkArea.x + rect.x - currentWorkArea.x) / currentWorkArea.width) *
            nextWorkArea.width;
        } else if (nextWorkArea.x > currentWorkArea.x) {
          rect.x = (rect.x / currentWorkArea.width) * nextWorkArea.width + nextWorkArea.x;
        }
        return rect;
      }
      return null;
    }

    _removeSignals() {
      if (!this._signalsBound) return;

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

      if (this._queueSourceId) {
        GLib.Source.remove(this._queueSourceId);
        this._queueSourceId = 0;
      }

      if (this._prefsOpenSrcId) {
        GLib.Source.remove(this._prefsOpenSrcId);
        this._prefsOpenSrcId = 0;
      }

      if (this._overviewSignals) {
        for (const overviewSignal of this._overviewSignals) {
          Overview.disconnect(overviewSignal);
        }
        this._overviewSignals.length = 0;
        this._overviewSignals = null;
      }

      this._signalsBound = false;
    }

    renderTree(from, force = false) {
      let wasFrozen = this._freezeRender;
      if (force && wasFrozen) this.unfreezeRender();
      if (this._freezeRender || !this.ext.settings.get_boolean("tiling-mode-enabled")) {
        this.updateDecorationLayout();
        this.updateBorderLayout();
      } else {
        if (!this._renderTreeSrcId) {
          this._renderTreeSrcId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.processFloats();
            this.tree.render(from);
            this._renderTreeSrcId = 0;
            this.updateDecorationLayout();
            this.updateBorderLayout();
            if (wasFrozen) this.freezeRender();
            return false;
          });
        }
      }
    }

    processFloats() {
      this.allNodeWindows.forEach((nodeWindow) => {
        let metaWindow = nodeWindow.nodeValue;
        if (this.isFloatingExempt(metaWindow) || !this.isActiveWindowWorkspaceTiled(metaWindow)) {
          nodeWindow.float = true;
        } else {
          nodeWindow.float = false;
        }
      });
    }

    get allNodeWindows() {
      return this.tree.getNodeByType(Tree.NODE_TYPES.WINDOW);
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
          Utils._disableDecorations();
          let treeWorkspaces = this.tree.nodeWorkpaces;
          let wsManager = global.workspace_manager;
          let globalWsNum = wsManager.get_n_workspaces();
          // empty out the root children nodes
          this.tree.childNodes.length = 0;
          this.tree.attachNode = undefined;
          // initialize the workspaces and monitors id strings
          this.tree._initWorkspaces();
          this.trackCurrentWindows();
          this.renderTree(from);
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
      let firstMonWs = `mo${firstNode.nodeValue.get_monitor()}ws${firstNode.nodeValue
        .get_workspace()
        .index()}`;
      let secondMonWs = `mo${secondNode.nodeValue.get_monitor()}ws${secondNode.nodeValue
        .get_workspace()
        .index()}`;
      return firstMonWs === secondMonWs;
    }

    showWindowBorders() {
      let metaWindow = this.focusMetaWindow;
      if (!metaWindow) return;
      let windowActor = metaWindow.get_compositor_private();
      if (!windowActor) return;
      let nodeWindow = this.findNodeWindow(metaWindow);
      if (!nodeWindow) return;
      if (metaWindow.get_wm_class() === null) return;

      let borders = [];
      let focusBorderEnabled = this.ext.settings.get_boolean("focus-border-toggle");
      let splitBorderEnabled = this.ext.settings.get_boolean("split-border-toggle");
      let tilingModeEnabled = this.ext.settings.get_boolean("tiling-mode-enabled");
      let gap = this.calculateGaps();
      let maximized = () => {
        return metaWindow.get_maximized() === 3 || metaWindow.is_fullscreen() || gap === 0;
      };
      let monitorCount = global.display.get_n_monitors();
      let tiledChildren = this.tree.getTiledChildren(nodeWindow.parentNode.childNodes);
      let inset = 3;
      let parentNode = nodeWindow.parentNode;

      const floatingWindow = nodeWindow.isFloat();
      const tiledBorder = windowActor.border;

      if (parentNode.isTabbed()) {
        if (nodeWindow.tab) {
          nodeWindow.tab.add_style_class_name("window-tabbed-tab-active");
        }
      }

      if (tiledBorder && focusBorderEnabled) {
        if (
          !maximized() ||
          (gap === 0 && tiledChildren.length === 1 && monitorCount > 1) ||
          (gap === 0 && tiledChildren.length > 1)
        ) {
          if (tilingModeEnabled) {
            if (parentNode.isStacked()) {
              if (!floatingWindow) {
                tiledBorder.set_style_class_name("window-stacked-border");
              } else {
                tiledBorder.set_style_class_name("window-floated-border");
              }
            } else if (parentNode.isTabbed()) {
              if (!floatingWindow) {
                tiledBorder.set_style_class_name("window-tabbed-border");
                if (nodeWindow.backgroundTab) {
                  tiledBorder.add_style_class_name("window-tabbed-bg");
                }
              } else {
                tiledBorder.set_style_class_name("window-floated-border");
              }
            } else {
              if (!floatingWindow) {
                tiledBorder.set_style_class_name("window-tiled-border");
              } else {
                tiledBorder.set_style_class_name("window-floated-border");
              }
            }
          } else {
            tiledBorder.set_style_class_name("window-floated-border");
          }
          borders.push(tiledBorder);
        }
      }

      if (gap === 0 || metaWindow.get_maximized() === 1 || metaWindow.get_maximized() === 2) {
        inset = 0;
      }

      // handle the split border
      // It should only show when V or H-Split and with single child CONs
      if (
        splitBorderEnabled &&
        focusBorderEnabled &&
        tilingModeEnabled &&
        !nodeWindow.isFloat() &&
        parentNode.childNodes.length === 1 &&
        (parentNode.isCon() || parentNode.isMonitor()) &&
        !(parentNode.isTabbed() || parentNode.isStacked())
      ) {
        if (!windowActor.splitBorder) {
          let splitBorder = new St.Bin({ style_class: "window-split-border" });
          global.window_group.add_child(splitBorder);
          windowActor.splitBorder = splitBorder;
        }

        let splitBorder = windowActor.splitBorder;
        splitBorder.remove_style_class_name("window-split-vertical");
        splitBorder.remove_style_class_name("window-split-horizontal");

        if (parentNode.isVSplit()) {
          splitBorder.add_style_class_name("window-split-vertical");
        } else if (parentNode.isHSplit()) {
          splitBorder.add_style_class_name("window-split-horizontal");
        }
        borders.push(splitBorder);
      }

      let rect = metaWindow.get_frame_rect();

      borders.forEach((border) => {
        border.set_size(rect.width + inset * 2, rect.height + inset * 2);
        border.set_position(rect.x - inset, rect.y - inset);
        if (metaWindow.appears_focused && !metaWindow.minimized) {
          border.show();
        }
        if (global.window_group && global.window_group.contains(border)) {
          // TODO - sort the borders with split border being on top
          global.window_group.remove_child(border);
          // Add the border just above the focused window
          global.window_group.insert_child_above(border, metaWindow.get_compositor_private());
        }
      });
    }

    updateBorderLayout() {
      this.hideWindowBorders();
      this.showWindowBorders();
    }

    calculateGaps() {
      let settings = this.ext.settings;
      let gapSize = settings.get_uint("window-gap-size");
      let gapIncrement = settings.get_uint("window-gap-size-increment");
      let gap = gapSize * gapIncrement;
      let metaWindow = this.focusMetaWindow;
      if (metaWindow && metaWindow.get_workspace()) {
        let monitorWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
        let monitorWsNode = this.tree.findNode(monitorWs);
        if (monitorWsNode) {
          let tiled = monitorWsNode
            .getNodeByMode(WINDOW_MODES.TILE)
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
      let autoSplit = this.ext.settings.get_boolean("auto-split-enabled");
      if (autoSplit && this.focusMetaWindow) {
        let currentFocusNode = this.tree.findNode(this.focusMetaWindow);
        if (currentFocusNode) {
          let currentParentFocusNode = currentFocusNode.parentNode;
          let layout = currentParentFocusNode.layout;
          if (layout === Tree.LAYOUT_TYPES.HSPLIT || layout === Tree.LAYOUT_TYPES.VSPLIT) {
            let frameRect = this.focusMetaWindow.get_frame_rect();
            let splitHorizontal = frameRect.width > frameRect.height;
            let orientation = splitHorizontal ? "horizontal" : "vertical";
            this.command({ name: "Split", orientation: orientation });
          }
        }
      }
      // Make window types configurable
      if (this._validWindow(metaWindow)) {
        let existNodeWindow = this.tree.findNode(metaWindow);
        Logger.debug(`Meta Window ${metaWindow.get_title()} ${metaWindow.get_window_type()}`);
        if (!existNodeWindow) {
          let attachTarget;

          const activeMonitor = global.display.get_current_monitor();
          const activeWorkspace = global.display
            .get_workspace_manager()
            .get_active_workspace_index();
          let metaMonWs = `mo${activeMonitor}ws${activeWorkspace}`;

          // Check if the active monitor / workspace has windows
          let metaMonWsNode = this.tree.findNode(metaMonWs);
          if (!metaMonWsNode) {
            // Reload the tree as a last resort
            this.reloadTree("no-meta-monws");
            return;
          }

          let windowNodes = metaMonWsNode.getNodeByType(Tree.NODE_TYPES.WINDOW);
          let hasWindows = windowNodes.length > 0;

          attachTarget = this.tree.attachNode;
          attachTarget = attachTarget ? this.tree.findNode(attachTarget.nodeValue) : null;

          if (!attachTarget) {
            attachTarget = metaMonWsNode;
          } else {
            if (hasWindows) {
              if (attachTarget && metaMonWsNode.contains(attachTarget)) {
                // Use the attach target
              } else {
                // Find the first window
                attachTarget = windowNodes[0];
              }
            } else {
              attachTarget = metaMonWsNode;
            }
          }

          let nodeWindow = this.tree.createNode(
            attachTarget.nodeValue,
            Tree.NODE_TYPES.WINDOW,
            metaWindow,
            WINDOW_MODES.FLOAT
          );

          metaWindow.firstRender = true;

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
                this.queueEvent({
                  name: "focus-update",
                  callback: () => {
                    this.unfreezeRender();
                    this.updateBorderLayout();
                    this.updateDecorationLayout();
                    this.updateStackedFocus();
                    this.updateTabbedFocus();
                  },
                });
                let focusNodeWindow = this.tree.findNode(this.focusMetaWindow);
                if (focusNodeWindow) {
                  // handle the attach node
                  this.tree.attachNode = focusNodeWindow._parent;
                  if (this.floatingWindow(focusNodeWindow)) {
                    this.queueEvent({
                      name: "raise-float",
                      callback: () => {
                        this.renderTree("raise-float-queue");
                      },
                    });
                  }
                  this.tree.attachNode = focusNodeWindow;
                }
                this.renderTree("focus", true);
              }),
              metaWindow.connect("workspace-changed", (_metaWindow) => {
                this.updateMetaWorkspaceMonitor("metawindow-workspace-changed", null, _metaWindow);
                this.trackCurrentMonWs();
              }),
            ];
            metaWindow.windowSignals = windowSignals;
          }

          if (!windowActor.actorSignals) {
            let actorSignals = [windowActor.connect("destroy", this.windowDestroy.bind(this))];
            windowActor.actorSignals = actorSignals;
          }

          if (!windowActor.border) {
            let border = new St.Bin({ style_class: "window-tiled-border" });

            if (global.window_group) global.window_group.add_child(border);

            windowActor.border = border;
            border.show();
          }

          this.postProcessWindow(nodeWindow);
          this.queueEvent(
            {
              name: "window-create-queue",
              callback: () => {
                metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
                metaWindow.unmaximize(Meta.MaximizeFlags.VERTICAL);
                metaWindow.unmaximize(Meta.MaximizeFlags.BOTH);
                this.renderTree("window-create", true);
              },
            },
            200
          );

          let childNodes = this.tree.getTiledChildren(nodeWindow.parentNode.childNodes);
          childNodes.forEach((n) => {
            n.percent = 0.0;
          });
        }
      }
    }

    postProcessWindow(nodeWindow) {
      let metaWindow = nodeWindow.nodeValue;
      if (metaWindow) {
        if (metaWindow.get_title() === Msgs.prefs_title) {
          metaWindow
            .get_workspace()
            .activate_with_focus(metaWindow, global.display.get_current_time());
          this.moveCenter(metaWindow);
        }
      }
    }

    updateStackedFocus(focusNodeWindow) {
      if (!focusNodeWindow) return;
      const parentNode = focusNodeWindow.parentNode;
      if (parentNode.layout === Tree.LAYOUT_TYPES.STACKED && !this._freezeRender) {
        parentNode.appendChild(focusNodeWindow);
        parentNode.childNodes
          .filter((child) => child.isWindow())
          .forEach((child) => child.nodeValue.raise());
        this.queueEvent({
          name: "render-focus-stack",
          callback: () => {
            this.renderTree("focus-stacked");
          },
        });
      }
    }

    updateTabbedFocus(focusNodeWindow) {
      if (!focusNodeWindow) return;
      if (focusNodeWindow.parentNode.layout === Tree.LAYOUT_TYPES.TABBED && !this._freezeRender) {
        const metaWindow = focusNodeWindow.nodeValue;
        metaWindow.raise();
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
          skipThisWs = true;
          break;
        }
      }
      return !skipThisWs;
    }

    trackCurrentWindows() {
      this.tree.attachNode = null;
      let windowsAll = this.windowsAllWorkspaces;
      for (let i = 0; i < windowsAll.length; i++) {
        let metaWindow = windowsAll[i];
        this.trackWindow(global.display, metaWindow);
        // This updates and handles dynamic workspaces
        this.updateMetaWorkspaceMonitor(
          "track-current-windows",
          metaWindow.get_monitor(),
          metaWindow
        );
      }
      this.updateDecorationLayout();
    }

    _validWindow(metaWindow) {
      let windowType = metaWindow.get_window_type();
      return (
        windowType === Meta.WindowType.NORMAL ||
        windowType === Meta.WindowType.MODAL_DIALOG ||
        windowType === Meta.WindowType.DIALOG
      );
    }

    windowDestroy(actor) {
      // Release any resources on the window
      let border = actor.border;
      if (border) {
        if (global.window_group) {
          global.window_group.remove_child(border);
          border.hide();
          border = null;
        }
      }

      let splitBorder = actor.splitBorder;
      if (splitBorder) {
        if (global.window_group) {
          global.window_group.remove_child(splitBorder);
          splitBorder.hide();
          splitBorder = null;
        }
      }

      let nodeWindow;
      nodeWindow = this.tree.findNodeByActor(actor);

      if (nodeWindow) {
        this.tree.removeNode(nodeWindow);
        this.renderTree("window-destroy-quick", true);
      }

      // find the next attachNode here
      let focusNodeWindow = this.tree.findNode(this.focusMetaWindow);
      if (focusNodeWindow) {
        this.tree.attachNode = focusNodeWindow.parentNode;
      }

      this.queueEvent({
        name: "window-destroy",
        callback: () => {
          this.renderTree("window-destroy", true);
        },
      });
    }

    /**
     * Handles any workspace/monitor update for the Meta.Window.
     */
    updateMetaWorkspaceMonitor(from, _monitor, metaWindow) {
      if (this._validWindow(metaWindow)) {
        if (metaWindow.get_workspace() === null) return;
        let existNodeWindow = this.tree.findNode(metaWindow);
        let metaMonWs = `mo${metaWindow.get_monitor()}ws${metaWindow.get_workspace().index()}`;
        let metaMonWsNode = this.tree.findNode(metaMonWs);
        if (existNodeWindow) {
          if (existNodeWindow.parentNode && metaMonWsNode) {
            // Uses the existing workspace, monitor that the metaWindow
            // belongs to.
            let containsWindow = metaMonWsNode.contains(existNodeWindow);
            if (!containsWindow) {
              // handle cleanup of resize percentages
              let existParent = existNodeWindow.parentNode;
              this.tree.resetSiblingPercent(existParent);
              metaMonWsNode.appendChild(existNodeWindow);

              // Ensure that the workspace tiling is honored
              if (this.isActiveWindowWorkspaceTiled(metaWindow)) {
                if (!this.grabOp === Meta.GrabOp.WINDOW_BASE)
                  this.updateTabbedFocus(existNodeWindow);
                this.updateStackedFocus(existNodeWindow);
              } else {
                if (this.floatingWindow(existNodeWindow)) {
                  existNodeWindow.nodeValue.raise();
                }
              }
            }
          }
        }
        this.renderTree(from);
      }
    }

    /**
     * Handle any updates to the current focused window's position.
     * Useful for updating the active window border, etc.
     */
    updateMetaPositionSize(_metaWindow, from) {
      let focusMetaWindow = this.focusMetaWindow;
      if (!focusMetaWindow) return;

      let focusNodeWindow = this.findNodeWindow(focusMetaWindow);
      if (!focusNodeWindow) return;

      let tilingModeEnabled = this.ext.settings.get_boolean("tiling-mode-enabled");

      if (focusNodeWindow.grabMode && tilingModeEnabled) {
        if (focusNodeWindow.grabMode === GRAB_TYPES.RESIZING) {
          this._handleResizing(focusNodeWindow);
        } else if (focusNodeWindow.grabMode === GRAB_TYPES.MOVING) {
          this._handleMoving(focusNodeWindow);
        }
      } else {
        if (focusMetaWindow.get_maximized() === 0) {
          this.renderTree(from);
        }
      }
      this.updateBorderLayout();
      this.updateDecorationLayout();
    }

    updateDecorationLayout() {
      if (this._freezeRender) return;
      let activeWsNode = this.currentWsNode;
      let allCons = this.tree.getNodeByType(Tree.NODE_TYPES.CON);

      // First, hide all decorations:
      allCons.forEach((con) => {
        if (con.decoration) {
          con.decoration.hide();
        }
      });

      // Next, handle showing-desktop usually by Super + D
      if (!activeWsNode) return;
      let allWindows = activeWsNode.getNodeByType(Tree.NODE_TYPES.WINDOW);
      let allHiddenWindows = allWindows.filter((w) => {
        let metaWindow = w.nodeValue;
        return !metaWindow.showing_on_its_workspace() || metaWindow.minimized;
      });

      // Then if all hidden, do not proceed showing the decorations at all;
      if (allWindows.length === allHiddenWindows.length) return;

      // Show the decoration where on all monitors of active workspace
      // But not on the monitor where there is a maximized or fullscreen window
      // Note, that when multi-display, user can have multi maximized windows,
      // So it needs to be fully filtered:
      let monWsNoMaxWindows = activeWsNode
        .getNodeByType(Tree.NODE_TYPES.MONITOR)
        .filter((monitor) => {
          return (
            monitor.getNodeByType(Tree.NODE_TYPES.WINDOW).filter((w) => {
              return (
                w.nodeValue.get_maximized() === Meta.MaximizeFlags.BOTH ||
                w.nodeValue.is_fullscreen()
              );
            }).length === 0
          );
        });

      monWsNoMaxWindows.forEach((monitorWs) => {
        let activeMonWsCons = monitorWs.getNodeByType(Tree.NODE_TYPES.CON);
        activeMonWsCons.forEach((con) => {
          let tiled = this.tree.getTiledChildren(con.childNodes);
          let showTabs = this.ext.settings.get_boolean("showtab-decoration-enabled");
          if (con.decoration && tiled.length > 0 && showTabs) {
            con.decoration.show();
            if (global.window_group.contains(con.decoration) && this.focusMetaWindow) {
              global.window_group.remove_child(con.decoration);
              // Show it below the focused window
              global.window_group.insert_child_below(
                con.decoration,
                this.focusMetaWindow.get_compositor_private()
              );
            }
            con.childNodes.forEach((cn) => {
              cn.render();
            });
          }
        });
      });
    }

    freezeRender() {
      this._freezeRender = true;
    }

    unfreezeRender() {
      this._freezeRender = false;
    }

    floatingWindow(node) {
      if (!node) return false;
      return node.nodeType === Tree.NODE_TYPES.WINDOW && node.mode === WINDOW_MODES.FLOAT;
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
        gdkPointer.warp(gdkScreen, rect.x, rect.y);
      }
    }

    getPointer() {
      return global.get_pointer();
    }

    minimizedWindow(node) {
      if (!node) return false;
      return node._type === Tree.NODE_TYPES.WINDOW && node._data && node._data.minimized;
    }

    swapWindowsUnderPointer(focusNodeWindow) {
      if (this.cancelGrab) {
        return;
      }
      let nodeWinAtPointer = this.findNodeWindowAtPointer(focusNodeWindow);
      if (nodeWinAtPointer) this.tree.swapPairs(focusNodeWindow, nodeWinAtPointer);
    }

    /**
     *
     * Handle previewing and applying where a drag-drop window is going to be tiled
     *
     */
    moveWindowToPointer(focusNodeWindow, preview = false) {
      if (this.cancelGrab) {
        return;
      }
      if (!focusNodeWindow || focusNodeWindow.mode !== WINDOW_MODES.GRAB_TILE) return;

      let nodeWinAtPointer = this.nodeWinAtPointer;

      if (nodeWinAtPointer) {
        const targetRect = this.tree.processGap(nodeWinAtPointer);
        const parentNodeTarget = nodeWinAtPointer.parentNode;
        const currPointer = this.getPointer();
        const horizontal = parentNodeTarget.isHSplit() || parentNodeTarget.isTabbed();
        const isMonParent = parentNodeTarget.nodeType === Tree.NODE_TYPES.MONITOR;
        const isConParent = parentNodeTarget.nodeType === Tree.NODE_TYPES.CON;
        const stacked = parentNodeTarget.isStacked();
        const tabbed = parentNodeTarget.isTabbed();
        const stackedOrTabbed = stacked || tabbed;
        const updatePreview = (focusNodeWindow, previewParams) => {
          let previewHint = focusNodeWindow.previewHint;
          let previewHintEnabled = this.ext.settings.get_boolean("preview-hint-enabled");
          const previewRect = previewParams.targetRect;
          if (previewHint && previewHintEnabled) {
            if (!previewRect) {
              previewHint.hide();
              return;
            }
            previewHint.set_style_class_name(previewParams.className);
            previewHint.set_position(previewRect.x, previewRect.y);
            previewHint.set_size(previewRect.width, previewRect.height);
            previewHint.show();
          }
        };
        const regions = (targetRect, regionWidth) => {
          leftRegion = {
            x: targetRect.x,
            y: targetRect.y,
            width: targetRect.width * regionWidth,
            height: targetRect.height,
          };

          rightRegion = {
            x: targetRect.x + targetRect.width * (1 - regionWidth),
            y: targetRect.y,
            width: targetRect.width * regionWidth,
            height: targetRect.height,
          };

          topRegion = {
            x: targetRect.x,
            y: targetRect.y,
            width: targetRect.width,
            height: targetRect.height * regionWidth,
          };

          bottomRegion = {
            x: targetRect.x,
            y: targetRect.y + targetRect.height * (1 - regionWidth),
            width: targetRect.width,
            height: targetRect.height * regionWidth,
          };

          centerRegion = {
            x: targetRect.x + targetRect.width * regionWidth,
            y: targetRect.y + targetRect.height * regionWidth,
            width: targetRect.width - targetRect.width * regionWidth * 2,
            height: targetRect.height - targetRect.height * regionWidth * 2,
          };

          return {
            left: leftRegion,
            right: rightRegion,
            top: topRegion,
            bottom: bottomRegion,
            center: centerRegion,
          };
        };
        let referenceNode = null;
        let containerNode;
        let childNode = focusNodeWindow;
        let previewParams = {
          className: "",
          targetRect: null,
        };
        let leftRegion;
        let rightRegion;
        let topRegion;
        let bottomRegion;
        let centerRegion;
        let previewWidth = 0.5;
        let hoverWidth = 0.3;

        // Hover region detects where the pointer is on the target drop window
        const hoverRegions = regions(targetRect, hoverWidth);

        // Preview region interprets the hover intersect where the focus window
        // would go when dropped
        const previewRegions = regions(targetRect, previewWidth);

        leftRegion = hoverRegions.left;
        rightRegion = hoverRegions.right;
        topRegion = hoverRegions.top;
        bottomRegion = hoverRegions.bottom;
        centerRegion = hoverRegions.center;

        const isLeft = Utils.rectContainsPoint(leftRegion, currPointer);
        const isRight = Utils.rectContainsPoint(rightRegion, currPointer);
        const isTop = Utils.rectContainsPoint(topRegion, currPointer);
        const isBottom = Utils.rectContainsPoint(bottomRegion, currPointer);
        const isCenter = Utils.rectContainsPoint(centerRegion, currPointer);

        if (isCenter) {
          if (stackedOrTabbed) {
            containerNode = parentNodeTarget;
            referenceNode = null;
            previewParams = {
              className: stacked ? "window-tilepreview-stacked" : "window-tilepreview-tabbed",
              targetRect: targetRect,
            };
          } else {
            if (isMonParent) {
              childNode.createCon = true;
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer;
              previewParams = {
                targetRect: targetRect,
              };
            } else {
              containerNode = parentNodeTarget;
              referenceNode = null;
              const parentTargetRect = this.tree.processGap(parentNodeTarget);
              previewParams = {
                targetRect: parentTargetRect,
              };
            }
          }
        } else if (isLeft) {
          previewParams = {
            targetRect: previewRegions.left,
          };

          if (stackedOrTabbed) {
            // treat any windows on stacked or tabbed layouts to be
            // a single node unit: the con itself and then
            // split left, top, right or bottom accordingly (subsequent if conditions):
            childNode.detachWindow = true;
            if (!isMonParent) {
              referenceNode = parentNodeTarget;
              containerNode = parentNodeTarget.parentNode;
            } else {
              // It is a monitor that's a stack/tab
              // TODO: update the stacked/tabbed toggles to not
              // change layout if the parent is a monitor?
            }
          } else {
            if (horizontal) {
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer;
            } else {
              // vertical orientation
              childNode.createCon = true;
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer;
            }
          }
        } else if (isRight) {
          previewParams = {
            targetRect: previewRegions.right,
          };
          if (stackedOrTabbed) {
            // treat any windows on stacked or tabbed layouts to be
            // a single node unit: the con itself and then
            // split left, top, right or bottom accordingly (subsequent if conditions):
            childNode.detachWindow = true;
            if (!isMonParent) {
              referenceNode = parentNodeTarget.nextSibling;
              containerNode = parentNodeTarget.parentNode;
            } else {
              // It is a monitor that's a stack/tab
              // TODO: update the stacked/tabbed toggles to not
              // change layout if the parent is a monitor?
            }
          } else {
            if (horizontal) {
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer.nextSibling;
            } else {
              childNode.createCon = true;
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer.nextSibling;
            }
          }
        } else if (isTop) {
          previewParams = {
            targetRect: previewRegions.top,
          };
          if (stackedOrTabbed) {
            // treat any windows on stacked or tabbed layouts to be
            // a single node unit: the con itself and then
            // split left, top, right or bottom accordingly (subsequent if conditions):
            if (!isMonParent) {
              containerNode = parentNodeTarget;
              referenceNode = null;
              previewParams = {
                className: stacked ? "window-tilepreview-stacked" : "window-tilepreview-tabbed",
                targetRect: targetRect,
              };
            } else {
              // It is a monitor that's a stack/tab
              // TODO: update the stacked/tabbed toggles to not
              // change layout if the parent is a monitor?
            }
          } else {
            if (horizontal) {
              childNode.createCon = true;
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer;
            } else {
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer;
            }
          }
        } else if (isBottom) {
          previewParams = {
            targetRect: previewRegions.bottom,
          };
          if (stackedOrTabbed) {
            // treat any windows on stacked or tabbed layouts to be
            // a single node unit: the con itself and then
            // split left, top, right or bottom accordingly (subsequent if conditions):
            if (!isMonParent) {
              containerNode = parentNodeTarget;
              referenceNode = null;
              previewParams = {
                className: stacked ? "window-tilepreview-stacked" : "window-tilepreview-tabbed",
                targetRect: targetRect,
              };
            } else {
              // It is a monitor that's a stack/tab
              // TODO: update the stacked/tabbed toggles to not
              // change layout if the parent is a monitor?
            }
          } else {
            if (horizontal) {
              childNode = focusNodeWindow;
              childNode.createCon = true;
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer.nextSibling;
            } else {
              childNode = focusNodeWindow;
              containerNode = parentNodeTarget;
              referenceNode = nodeWinAtPointer.nextSibling;
            }
          }
        }

        if (!isCenter) {
          if (stackedOrTabbed) {
            if (isLeft || isRight) {
              previewParams.className = "window-tilepreview-tiled";
            } else if (isTop || isBottom) {
              previewParams.className = stacked
                ? "window-tilepreview-stacked"
                : "window-tilepreview-tabbed";
            }
          } else {
            previewParams.className = "window-tilepreview-tiled";
          }
        } else if (isCenter) {
          if (!stackedOrTabbed) previewParams.className = this._getDragDropCenterPreviewStyle();
        }

        if (!preview) {
          const previousParent = focusNodeWindow.parentNode;
          this.tree.resetSiblingPercent(containerNode);
          this.tree.resetSiblingPercent(previousParent);

          if (focusNodeWindow.tab) {
            let decoParent = focusNodeWindow.tab.get_parent();
            if (decoParent) decoParent.remove_child(focusNodeWindow.tab);
          }

          if (childNode.createCon) {
            const numWin = parentNodeTarget.childNodes.filter(
              (c) => c.nodeType === Tree.NODE_TYPES.WINDOW
            ).length;
            const numChild = parentNodeTarget.childNodes.length;
            const sameNumChild = numWin === numChild;
            // Child Node will still be created
            if (
              !isCenter &&
              ((isConParent && numWin === 1 && sameNumChild) ||
                (isMonParent && numWin == 2 && sameNumChild))
            ) {
              childNode = parentNodeTarget;
            } else {
              childNode = new Tree.Node(Tree.NODE_TYPES.CON, new St.Bin());
              containerNode.insertBefore(childNode, referenceNode);
              childNode.appendChild(nodeWinAtPointer);
            }

            if (isLeft || isTop) {
              childNode.insertBefore(focusNodeWindow, nodeWinAtPointer);
            } else if (isRight || isBottom || isCenter) {
              childNode.insertBefore(focusNodeWindow, null);
            }

            if (isLeft || isRight) {
              childNode.layout = Tree.LAYOUT_TYPES.HSPLIT;
            } else if (isTop || isBottom) {
              childNode.layout = Tree.LAYOUT_TYPES.VSPLIT;
            } else if (isCenter) {
              const centerLayout = this.ext.settings.get_string("dnd-center-layout").toUpperCase();
              childNode.layout = Tree.LAYOUT_TYPES[centerLayout];
            }
          } else if (childNode.detachWindow) {
            const orientation =
              isLeft || isRight
                ? Tree.ORIENTATION_TYPES.HORIZONTAL
                : Tree.ORIENTATION_TYPES.VERTICAL;
            this.tree.split(childNode, orientation);
            containerNode.insertBefore(childNode.parentNode, referenceNode);
          } else {
            // Child Node is a WINDOW
            containerNode.insertBefore(childNode, referenceNode);
            if (isLeft || isRight) {
              containerNode.layout = Tree.LAYOUT_TYPES.HSPLIT;
            } else if (isTop || isBottom) {
              if (!stackedOrTabbed) containerNode.layout = Tree.LAYOUT_TYPES.VSPLIT;
            } else if (isCenter) {
              if (containerNode.isHSplit() || containerNode.isVSplit()) {
                const centerLayout = this.ext.settings
                  .get_string("dnd-center-layout")
                  .toUpperCase();
                containerNode.layout = Tree.LAYOUT_TYPES[centerLayout];
              }
            }
          }
        } else {
          updatePreview(focusNodeWindow, previewParams);
        }
        childNode.createCon = false;
        childNode.detachWindow = false;
      }
    }

    findNodeWindowAtPointer(focusNodeWindow) {
      let pointerCoord = global.get_pointer();

      let nodeWinAtPointer = this._findNodeWindowAtPointer(focusNodeWindow.nodeValue, pointerCoord);
      return nodeWinAtPointer;
    }

    /**
     * Finds the NodeWindow under the Meta.Window and the
     * current pointer coordinates;
     */
    _findNodeWindowAtPointer(metaWindow, pointer) {
      if (!metaWindow) return undefined;

      let sortedWindows = this.sortedWindows;

      if (!sortedWindows) {
        Logger.warn("No sorted windows");
        return;
      }

      for (let i = 0, n = sortedWindows.length; i < n; i++) {
        const w = sortedWindows[i];
        const metaRect = w.get_frame_rect();
        const atPointer = Utils.rectContainsPoint(metaRect, pointer);
        if (atPointer) return this.tree.getNodeByValue(w);
      }

      return null;
    }

    _handleGrabOpBegin(_display, _metaWindow, grabOp) {
      this.grabOp = grabOp;
      this.trackCurrentMonWs();
      let focusMetaWindow = this.focusMetaWindow;

      if (focusMetaWindow) {
        const frameRect = focusMetaWindow.get_frame_rect();
        const gaps = this.calculateGaps();

        let focusNodeWindow = this.findNodeWindow(focusMetaWindow);
        if (!focusNodeWindow) return;

        focusNodeWindow.grabMode = Utils.grabMode(grabOp);
        if (
          focusNodeWindow.grabMode === GRAB_TYPES.MOVING &&
          focusNodeWindow.mode === WINDOW_MODES.TILE
        ) {
          this.freezeRender();
          focusNodeWindow.mode = WINDOW_MODES.GRAB_TILE;
        }

        focusNodeWindow.initGrabOp = grabOp;
        focusNodeWindow.initRect = Utils.removeGapOnRect(frameRect, gaps);
      }
    }

    _handleGrabOpEnd(_display, _metaWindow, grabOp) {
      this.unfreezeRender();
      let focusMetaWindow = this.focusMetaWindow;
      if (!focusMetaWindow) return;
      let focusNodeWindow = this.findNodeWindow(focusMetaWindow);

      if (focusNodeWindow && !this.cancelGrab) {
        // WINDOW_BASE is when grabbing the window decoration
        // COMPOSITOR is when something like Overview requesting a grab, especially when Super is pressed.
        if (grabOp === Meta.GrabOp.WINDOW_BASE || grabOp === Meta.GrabOp.COMPOSITOR) {
          if (this.allowDragDropTile()) {
            this.moveWindowToPointer(focusNodeWindow);
          }
        }
      }
      this._grabCleanup(focusNodeWindow);

      if (focusMetaWindow.get_maximized() === 0) {
        this.renderTree("grab-op-end");
      }

      this.updateStackedFocus(focusNodeWindow);
      this.updateTabbedFocus(focusNodeWindow);
      this.nodeWinAtPointer = null;
    }

    _grabCleanup(focusNodeWindow) {
      this.cancelGrab = false;
      if (!focusNodeWindow) return;
      focusNodeWindow.initRect = null;
      focusNodeWindow.grabMode = null;
      focusNodeWindow.initGrabOp = null;

      if (focusNodeWindow.previewHint) {
        focusNodeWindow.previewHint.hide();
        global.window_group.remove_child(focusNodeWindow.previewHint);
        focusNodeWindow.previewHint.destroy();
        focusNodeWindow.previewHint = null;
      }

      if (focusNodeWindow.mode === WINDOW_MODES.GRAB_TILE) {
        focusNodeWindow.mode = WINDOW_MODES.TILE;
      }
    }

    allowDragDropTile() {
      return this.kbd.allowDragDropTile();
    }

    _handleResizing(focusNodeWindow) {
      if (!focusNodeWindow) return;
      let grabOp = this.grabOp;
      let initGrabOp = focusNodeWindow.initGrabOp;
      let direction = Utils.directionFromGrab(grabOp);
      let orientation = Utils.orientationFromGrab(grabOp);
      let parentNodeForFocus = focusNodeWindow.parentNode;
      let position = Utils.positionFromGrabOp(grabOp);
      // normalize the rect without gaps
      let frameRect = this.focusMetaWindow.get_frame_rect();
      let gaps = this.calculateGaps();
      let currentRect = Utils.removeGapOnRect(frameRect, gaps);
      let firstRect;
      let secondRect;
      let parentRect;
      let resizePairForWindow;

      if (initGrabOp === Meta.GrabOp.RESIZING_UNKNOWN) {
        // the direction is null so do not process yet below.
        return;
      } else {
        resizePairForWindow = this.tree.nextVisible(focusNodeWindow, direction);
      }

      let sameParent = resizePairForWindow
        ? resizePairForWindow.parentNode === focusNodeWindow.parentNode
        : false;

      if (orientation === Tree.ORIENTATION_TYPES.HORIZONTAL) {
        if (sameParent) {
          // use the window or con pairs
          if (this.tree.getTiledChildren(parentNodeForFocus.childNodes).length <= 1) {
            return;
          }

          firstRect = focusNodeWindow.initRect;
          if (resizePairForWindow) {
            if (
              !this.floatingWindow(resizePairForWindow) &&
              !this.minimizedWindow(resizePairForWindow)
            ) {
              secondRect = resizePairForWindow.rect;
            } else {
              // TODO try to get the next resize pair?
            }
          }

          if (!firstRect || !secondRect) {
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
          if (resizePairForWindow && resizePairForWindow.parentNode) {
            if (this.tree.getTiledChildren(resizePairForWindow.parentNode.childNodes).length <= 1) {
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
          if (this.tree.getTiledChildren(parentNodeForFocus.childNodes).length <= 1) {
            return;
          }
          firstRect = focusNodeWindow.initRect;
          if (resizePairForWindow) {
            if (
              !this.floatingWindow(resizePairForWindow) &&
              !this.minimizedWindow(resizePairForWindow)
            ) {
              secondRect = resizePairForWindow.rect;
            } else {
              // TODO try to get the next resize pair?
            }
          }
          if (!firstRect || !secondRect) {
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
          if (resizePairForWindow && resizePairForWindow.parentNode) {
            if (this.tree.getTiledChildren(resizePairForWindow.parentNode.childNodes).length <= 1) {
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

    _handleMoving(focusNodeWindow) {
      if (!focusNodeWindow || focusNodeWindow.mode !== WINDOW_MODES.GRAB_TILE) return;

      const nodeWinAtPointer = this.findNodeWindowAtPointer(focusNodeWindow);
      this.nodeWinAtPointer = nodeWinAtPointer;

      const hidePreview = () => {
        if (focusNodeWindow.previewHint) {
          focusNodeWindow.previewHint.hide();
        }
      };

      if (nodeWinAtPointer) {
        if (!focusNodeWindow.previewHint) {
          let previewHint = new St.Bin();
          global.window_group.add_child(previewHint);
          focusNodeWindow.previewHint = previewHint;
        }

        if (this.allowDragDropTile()) {
          this.moveWindowToPointer(focusNodeWindow, true);
        } else {
          hidePreview();
        }
      } else {
        hidePreview();
      }
    }

    isFloatingExempt(metaWindow) {
      if (!metaWindow) return true;
      let windowTitle = metaWindow.get_title();
      let windowType = metaWindow.get_window_type();

      let floatByType =
        windowType === Meta.WindowType.DIALOG ||
        windowType === Meta.WindowType.MODAL_DIALOG ||
        metaWindow.get_transient_for() !== null ||
        metaWindow.get_wm_class() === null ||
        windowTitle === null ||
        windowTitle === "" ||
        windowTitle.length === 0 ||
        !metaWindow.allows_resize();

      const knownFloats = this.windowProps.overrides.filter((wprop) => wprop.mode === "float");

      let floatOverride =
        knownFloats.filter((kf) => {
          let matchTitle = false;
          let matchClass = false;

          if (kf.wmTitle) {
            if (kf.wmTitle === " ") {
              matchTitle = kf.wmTitle === windowTitle;
            } else {
              let titles = kf.wmTitle.split(",");
              matchTitle = titles.filter((t) => windowTitle && windowTitle.includes(t)).length > 0;
            }
          }
          if (kf.wmClass) {
            matchClass = kf.wmClass.includes(metaWindow.get_wm_class());
          }

          if (kf.wmClass && kf.wmTitle) {
            return matchTitle && matchClass;
          } else {
            if (kf.wmTitle) {
              return matchTitle;
            } else {
              return matchClass;
            }
          }
        }).length > 0;

      return floatByType || floatOverride;
    }

    _getDragDropCenterPreviewStyle() {
      const centerLayout = this.ext.settings.get_string("dnd-center-layout");
      return `window-tilepreview-${centerLayout}`;
    }

    get currentMonWsNode() {
      const monWs = this.currentMonWs;
      if (monWs) {
        return this.tree.findNode(monWs);
      }
      return null;
    }

    get currentWsNode() {
      const ws = this.currentWs;
      if (ws) {
        return this.tree.findNode(ws);
      }
      return null;
    }

    get currentMonWs() {
      const monWs = `${this.currentMon}${this.currentWs}`;
      return monWs;
    }

    get currentWs() {
      const display = global.display;
      const wsMgr = display.get_workspace_manager();
      return `ws${wsMgr.get_active_workspace_index()}`;
    }

    get currentMon() {
      const display = global.display;
      return `mo${display.get_current_monitor()}`;
    }

    floatAllWindows() {
      this.tree.getNodeByType(Tree.NODE_TYPES.WINDOW).forEach((w) => {
        if (w.isFloat()) {
          w.prevFloat = true;
        }
        w.mode = WINDOW_MODES.FLOAT;
      });
    }

    unfloatAllWindows() {
      this.tree.getNodeByType(Tree.NODE_TYPES.WINDOW).forEach((w) => {
        if (!w.prevFloat) {
          w.mode = WINDOW_MODES.TILE;
        } else {
          // Reset the float marker
          w.prevFloat = false;
        }
      });
    }
  }
);
