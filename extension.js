/*
 * This file is part of the Forge GNOME extension
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
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

// Shared state
import { Logger } from "./lib/shared/logger.js";
import { ConfigManager } from "./lib/shared/settings.js";

// Application imports
import { Keybindings } from "./lib/extension/keybindings.js";
import { WindowManager } from "./lib/extension/window.js";
import { FeatureIndicator, FeatureMenuToggle } from "./lib/extension/indicator.js";
import { ExtensionThemeManager } from "./lib/extension/extension-theme-manager.js";

export default class ForgeExtension extends Extension {
  /**
   * Services created in `_enable()`.
   *
   * They are deliberately non-nullable: every consumer (session signal,
   * keybindings, indicator, window-manager signals) is unbound before
   * `disable()` clears them, so a read can only happen while they are live.
   * `disable()` breaks the type once, on purpose, so a callback that outlives
   * teardown fails loudly instead of walking a torn-down tree.
   */
  /** @type {import("gi://Gio").default.Settings} */
  settings;

  /** @type {import("gi://Gio").default.Settings} */
  kbdSettings;

  /** @type {ConfigManager} */
  configMgr;

  /** @type {ExtensionThemeManager} */
  theme;

  /** @type {WindowManager} */
  extWm;

  /** @type {Keybindings} */
  keybindings;

  /** @type {FeatureIndicator | null} */
  indicator = null;

  enable() {
    try {
      this._enable();
    } catch (e) {
      // GNOME Shell reports an enable() exception as an extension error and does
      // not call disable(). Tear down anything initialized before the failure so
      // keybindings, indicators, session handlers, or stylesheets aren't stranded.
      try {
        this.disable();
      } catch (cleanupError) {
        Logger.error(`enable: cleanup after failed enable also failed: ${cleanupError}`);
      }
      throw e;
    }
  }

  _enable() {
    this.settings = this.getSettings();
    this.kbdSettings = this.getSettings("org.gnome.shell.extensions.forge.keybindings");
    Logger.init(this.settings);
    Logger.info("enable");

    this.configMgr = new ConfigManager(this);
    this.theme = new ExtensionThemeManager(this);
    this.extWm = new WindowManager(this);
    this.keybindings = new Keybindings(this);
    this._keybindingsEnabled = false;

    this._onSessionModeChanged(Main.sessionMode);
    this._sessionId = Main.sessionMode.connect("updated", this._onSessionModeChanged.bind(this));

    this.theme.patchCss();
    this.theme.reloadStylesheet();
    this.extWm.enable();
    Logger.info(`enable: finalized vars`);
  }

  disable() {
    Logger.info("disable");

    // See session mode unlock-dialog explanation on _onSessionModeChanged()
    if (this._sessionId) {
      Main.sessionMode.disconnect(this._sessionId);
      this._sessionId = null;
    }

    this._removeIndicator();
    this.extWm?.disable();
    this._setKeybindingsEnabled(false);
    this.theme?.unloadStylesheet();

    // Cleared last, once every consumer above is unbound. This is the only
    // place the non-null service types are violated on purpose; see the field
    // declarations for why.
    const torn = /** @type {any} */ (this);
    torn.keybindings = null;
    torn.extWm = null;
    torn.theme = null;
    torn.configMgr = null;
    torn.settings = null;
    torn.kbdSettings = null;
    this._keybindingsEnabled = false;
  }

  _onSessionModeChanged(session) {
    // unlock-dialog inherits parentMode "user"; handle it first or the user
    // branch below re-enables keybindings on the lock screen.
    if (session.currentMode === "unlock-dialog") {
      Logger.info("lock-screen on session change");
      this._setKeybindingsEnabled(false);
      this._removeIndicator();
      return;
    }

    if (session.currentMode === "user" || session.parentMode === "user") {
      Logger.info("user on session change");
      this._addIndicator();
      this._setKeybindingsEnabled(true);
      return;
    }

    this._setKeybindingsEnabled(false);
    this._removeIndicator();
  }

  _setKeybindingsEnabled(enabled) {
    if (this._keybindingsEnabled === enabled) return;
    if (enabled) {
      // Mark the attempt before registering individual bindings. If enable()
      // throws partway through, the outer enable() cleanup must still call
      // disable() to remove the subset that was already installed.
      this._keybindingsEnabled = true;
      this.keybindings?.enable();
    } else {
      this.keybindings?.disable();
      this._keybindingsEnabled = false;
    }
  }

  _addIndicator() {
    if (this.indicator) return;
    this.indicator = new FeatureIndicator(this);
    this.indicator.quickSettingsItems.push(new FeatureMenuToggle(this));
    Main.panel.statusArea.quickSettings.addExternalIndicator(this.indicator);
  }

  _removeIndicator() {
    this.indicator?.quickSettingsItems.forEach((item) => item.destroy());
    this.indicator?.destroy();
    this.indicator = null;
  }
}
