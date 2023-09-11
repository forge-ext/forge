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
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

// Shared state
import { Logger } from "./lib/shared/logger.js";
import { ConfigManager, production } from "./lib/shared/settings.js";

// Application imports
import { Keybindings } from "./lib/extension/keybindings.js";
import { WindowManager } from "./lib/extension/window.js";
import { FeatureIndicator } from "./lib/extension/indicator.js";
import { ExtensionThemeManager } from "./lib/extension/extension-theme-manager.js";

export default class ForgeExtension extends Extension {
  settings = this.getSettings();

  kbdSettings = this.getSettings("org.gnome.shell.extensions.forge.keybindings");

  prefsTitle = `Forge ${_("Settings")} - ${
    !production ? "DEV" : `${PACKAGE_VERSION}-${this.metadata.version}`
  }`;

  sameSession = false;

  enable() {
    Logger.init(this.settings);
    Logger.info("enable");
    this.configMgr = new ConfigManager(this);
    this.theme = new ExtensionThemeManager(this);
    this.extWm = new WindowManager(this);
    this.keybindings = new Keybindings(this);
    this.indicator ??= new FeatureIndicator(this);

    this.theme.patchCss();
    this.theme.reloadStylesheet();

    if (this.sameSession) {
      Logger.debug(`enable: still in same session`);
      this.sameSession = false;
      return;
    }

    this.extWm.enable();
    this.keybindings.enable();
    Logger.info(`enable: finalized vars`);
  }

  disable() {
    Logger.info("disable");

    if (Main.sessionMode.isLocked) {
      this.sameSession = true;
      Logger.debug(`disable: still in same session`);
      return;
    }

    this.extWm.disable();
    this.keybindings.disable();

    this.indicator?.destroy();
    this.indicator = null;
    this.keybindings = null;
    this.extWm = null;
    this.themeWm = null;
    this.configMgr = null;
  }
}
