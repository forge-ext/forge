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

// Gnome imports
import GObject from "gi://GObject";
import Meta from "gi://Meta";
import Shell from "gi://Shell";

// Gnome Shell imports
import * as Main from "resource:///org/gnome/shell/ui/main.js";

// Shared state
import { Logger } from "../shared/logger.js";

export class Keybindings extends GObject.Object {
  static {
    GObject.registerClass(this);
  }

  /** @type {import('../../extension.js').default} */
  ext;

  constructor(ext) {
    super();
    Logger.debug(`created keybindings`);
    this.ext = ext;
    this.extWm = ext.extWm;
    this.kbdSettings = ext.kbdSettings;
    this.settings = ext.settings;
    this.buildBindingDefinitions();
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

  get modifierState() {
    const [_x, _y, state] = this.extWm.getPointer();
    return state;
  }

  allowDragDropTile() {
    const tileModifier = this.kbdSettings.get_string("mod-mask-mouse-tile");
    const modState = this.modifierState;
    if (tileModifier === "None") return true;

    // These are Clutter.ModifierType masks. Ignore Lock and Mod2 (normally
    // Caps Lock and Num Lock) so they don't disable drag-to-tile. Preserve the
    // old requirement that the configured modifier be the only active key
    // modifier, with or without the primary pointer button grabbed.
    // Keep these masks aligned with Clutter.ModifierType. The schema has long
    // advertised Shift as a supported drag modifier, but it was missing here.
    const modifierMask = { Shift: 1, Ctrl: 4, Alt: 8, Super: 64 }[tileModifier];
    if (!modifierMask) return false;
    const normalizedState = modState & ~(2 | 16);
    const button1Mask = 256;

    return normalizedState === modifierMask || normalizedState === (modifierMask | button1Mask);
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
      "window-resize-top-increase": () => {
        let action = {
          name: "WindowResizeTop",
          amount: this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
      "window-resize-top-decrease": () => {
        let action = {
          name: "WindowResizeTop",
          amount: -1 * this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
      "window-resize-bottom-increase": () => {
        let action = {
          name: "WindowResizeBottom",
          amount: this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
      "window-resize-bottom-decrease": () => {
        let action = {
          name: "WindowResizeBottom",
          amount: -1 * this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
      "window-resize-left-increase": () => {
        let action = {
          name: "WindowResizeLeft",
          amount: this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
      "window-resize-left-decrease": () => {
        let action = {
          name: "WindowResizeLeft",
          amount: -1 * this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
      "window-resize-right-increase": () => {
        let action = {
          name: "WindowResizeRight",
          amount: this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
      "window-resize-right-decrease": () => {
        let action = {
          name: "WindowResizeRight",
          amount: -1 * this.settings.get_uint("resize-amount"),
        };
        this.extWm.command(action);
      },
    };
  }
}
