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
import { sessionMode } from "resource:///org/gnome/shell/ui/main.js";
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

// Shared state
import { Logger } from "./lib/shared/logger.js";
import { ConfigManager, production } from "./lib/shared/settings.js";
import { ThemeManager } from "./lib/shared/theme.js";

// Application imports
import { Keybindings } from "./lib/extension/keybindings.js";
import { WindowManager } from "./lib/extension/window.js";
import { FeatureIndicator } from "./lib/extension/indicator.js";

export default class ForgeExtension extends Extension {
  settings = this.getSettings();

  kbdSettings = this.getSettings("org.gnome.shell.extensions.forge.keybindings");

  configMgr = new ConfigManager(this);

  theme = new ThemeManager(this);

  extWm = new WindowManager(this);

  keybindings = new Keybindings(this);

  indicator = new FeatureIndicator(this);

  prefsTitle = `Forge ${_("Settings")} - ${
    !production ? "DEV" : `${PACKAGE_VERSION}-${this.metadata.version}`
  }`;

  sameSession = false;

  enable() {
    Logger.init(this.settings);
    this.indicator ??= new FeatureIndicator(this);

    Logger.info("enable");
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

    if (sessionMode.isLocked) {
      this.sameSession = true;
      Logger.debug(`disable: still in same session`);
      return;
    }

    this.extWm.disable();
    this.keybindings.disable();

    if (this.indicator) {
      this.indicator.destroy();
      this.indicator = null;
    }
  }
}
