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
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;

// Gnome Shell imports
const DND = imports.ui.dnd;
const Main = imports.ui.main;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;
const Window = Me.imports.window;

var Keybindings = GObject.registerClass(
  class Keybindings extends GObject.Object {
    _init(ext) {
      Logger.debug(`created keybindings`);
      this._grabbers = new Map();
      // this._bindSignals();
      this.ext = ext;
      this.extWm = ext.extWm;
      this.kbdSettings = ext.kbdSettings;
      this.settings = ext.settings;
      this.buildBindingDefinitions();
    }

    // @deprecated
    _acceleratorActivate(action) {
      let grabber = this._grabbers.get(action);
      if (grabber) {
        Logger.debug(`Firing accelerator ${grabber.accelerator} : ${grabber.name}`);
        grabber.callback();
      } else {
        Logger.error(`No listeners [action={${action}}]`);
      }
    }

    // @deprecated
    _bindSignals() {
      global.display.connect("accelerator-activated", (_display, action, _deviceId, _timestamp) => {
        this._acceleratorActivate(action);
      });
    }

    enable() {
      let keybindings = this._bindings;

      for (const key in keybindings) {
        Main.wm.addKeybinding(
          key,
          this.kbdSettings,
          Meta.KeyBindingFlags.NONE,
          Shell.ActionMode.NORMAL,
          keybindings[key]
        );
      }

      Logger.debug(`keybindings:enable`);
    }

    disable() {
      let keybindings = this._bindings;

      for (const key in keybindings) {
        Main.wm.removeKeybinding(key);
      }

      Logger.debug(`keybindings:disable`);
    }

    // @deprecated
    enableListenForBindings() {
      windowConfig.forEach((config) => {
        config.shortcut.forEach((shortcut) => {
          this.listenFor(shortcut, () => {
            config.actions.forEach((action) => {
              this.extWm.command(action);
            });
          });
        });
      });
    }

    // @deprecated
    disableListenForBindings() {
      // The existing grabber items are from the custom config by
      // this extension.
      this._grabbers.forEach((grabber) => {
        global.display.ungrab_accelerator(grabber.action);
        Main.wm.allowKeybinding(grabber.name, Shell.ActionMode.NONE);
      });

      this._grabbers.clear();
    }

    /**
     * API for quick binding of keys to function. This is going to be useful with SpaceMode
     *
     * @param {String} accelerator - keybinding combinations
     * @param {Function} callback - function to call when the accelerator is invoked
     *
     * Credits:
     *  - https://superuser.com/a/1182899
     *  - Adapted based on current Gnome-shell API or syntax
     */
    listenFor(accelerator, callback) {
      let grabFlags = Meta.KeyBindingFlags.NONE;
      let action = global.display.grab_accelerator(accelerator, grabFlags);

      if (action == Meta.KeyBindingAction.NONE) {
        Logger.error(`Unable to grab accelerator [binding={${accelerator}}]`);
        // TODO - check the gnome keybindings for conflicts and notify the user
      } else {
        let name = Meta.external_binding_name_for_action(action);

        Logger.debug(`Requesting WM to allow binding [name={${name}}]`);
        Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);

        this._grabbers.set(action, {
          name: name,
          accelerator: accelerator,
          callback: callback,
          action: action,
        });
      }
    }

    get modifierState() {
      const [_x, _y, state] = this.extWm.getPointer();
      return state;
    }

    allowDragDropTile() {
      const tileModifier = this.kbdSettings.get_string("mod-mask-mouse-tile");
      const modState = this.modifierState;
      // Using Clutter.ModifierType values and also testing for pointer
      // being grabbed (256). E.g. grabbed + pressing Super = 256 + 64 = 320
      // See window.js#_handleMoving() - an overlay preview is shown.
      // See window.js#_handleGrabOpEnd() - when the drag has been dropped
      switch (tileModifier) {
        case "Super":
          return modState === 64 || modState === 320;
        case "Alt":
          return modState === 8 || modState === 264;
        case "Ctrl":
          return modState === 4 || modState === 260;
        case "None":
          return true;
      }
      return false;
    }

    buildBindingDefinitions() {
      this._bindings = {
        "window-toggle-float": () => {
          let actions = [
            {
              name: "FloatToggle",
              mode: "float",
              x: "center",
              y: "center",
              width: 0.65,
              height: 0.75,
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-toggle-always-float": () => {
          let action = {
            name: "FloatClassToggle",
            mode: "float",
            x: "center",
            y: "center",
            width: 0.65,
            height: 0.75,
          };
          this.extWm.command(action);
        },
        "window-focus-left": () => {
          let actions = [
            {
              name: "Focus",
              direction: "Left",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-focus-down": () => {
          let actions = [
            {
              name: "Focus",
              direction: "Down",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-focus-up": () => {
          let actions = [
            {
              name: "Focus",
              direction: "Up",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-focus-right": () => {
          let actions = [
            {
              name: "Focus",
              direction: "Right",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-swap-left": () => {
          let actions = [
            {
              name: "Swap",
              direction: "Left",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-swap-down": () => {
          let actions = [
            {
              name: "Swap",
              direction: "Down",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-swap-up": () => {
          let actions = [
            {
              name: "Swap",
              direction: "Up",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-swap-right": () => {
          let actions = [
            {
              name: "Swap",
              direction: "Right",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-move-left": () => {
          let actions = [
            {
              name: "Move",
              direction: "Left",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-move-down": () => {
          let actions = [
            {
              name: "Move",
              direction: "Down",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-move-up": () => {
          let actions = [
            {
              name: "Move",
              direction: "Up",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "window-move-right": () => {
          let actions = [
            {
              name: "Move",
              direction: "Right",
            },
          ];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "con-split-layout-toggle": () => {
          let actions = [{ name: "LayoutToggle" }];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "con-split-vertical": () => {
          let actions = [{ name: "Split", orientation: "vertical" }];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "con-split-horizontal": () => {
          let actions = [{ name: "Split", orientation: "horizontal" }];
          actions.forEach((action) => {
            this.extWm.command(action);
          });
        },
        "con-stacked-layout-toggle": () => {
          let action = { name: "LayoutStackedToggle" };
          this.extWm.command(action);
        },
        "con-tabbed-layout-toggle": () => {
          let action = { name: "LayoutTabbedToggle" };
          this.extWm.command(action);
        },
        "con-tabbed-showtab-decoration-toggle": () => {
          let action = { name: "ShowTabDecorationToggle" };
          this.extWm.command(action);
        },
        "focus-border-toggle": () => {
          let action = { name: "FocusBorderToggle" };
          this.extWm.command(action);
        },
        "prefs-tiling-toggle": () => {
          let action = { name: "TilingModeToggle" };
          this.extWm.command(action);
        },
        "window-gap-size-increase": () => {
          let action = { name: "GapSize", amount: 1 };
          this.extWm.command(action);
        },
        "window-gap-size-decrease": () => {
          let action = { name: "GapSize", amount: -1 };
          this.extWm.command(action);
        },
        "workspace-active-tile-toggle": () => {
          let action = { name: "WorkspaceActiveTileToggle" };
          this.extWm.command(action);
        },
        "prefs-open": () => {
          let action = { name: "PrefsOpen" };
          this.extWm.command(action);
        },
        "window-swap-last-active": () => {
          let action = {
            name: "WindowSwapLastActive",
          };
          this.extWm.command(action);
        },
        "window-snap-one-third-right": () => {
          let action = {
            name: "SnapLayoutMove",
            direction: "Right",
            amount: 1 / 3,
          };
          this.extWm.command(action);
        },
        "window-snap-two-third-right": () => {
          let action = {
            name: "SnapLayoutMove",
            direction: "Right",
            amount: 2 / 3,
          };
          this.extWm.command(action);
        },
        "window-snap-one-third-left": () => {
          let action = {
            name: "SnapLayoutMove",
            direction: "Left",
            amount: 1 / 3,
          };
          this.extWm.command(action);
        },
        "window-snap-two-third-left": () => {
          let action = {
            name: "SnapLayoutMove",
            direction: "Left",
            amount: 2 / 3,
          };
          this.extWm.command(action);
        },
        "window-snap-center": () => {
          let action = {
            name: "SnapLayoutMove",
            direction: "Center",
          };
          this.extWm.command(action);
        },
      };
    }
  }
);
