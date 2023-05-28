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

"use strict";

// Gnome imports
const SessionMode = imports.ui.main.sessionMode;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Logger = Me.imports.logger;
const Settings = Me.imports.settings;
const { Keybindings } = Me.imports.keybindings;
const { ThemeManager } = Me.imports.theme;
const { WindowManager } = Me.imports.window;
const { FeatureIndicator } = Me.imports.indicator;

function init() {
  Logger.info("init");
  ExtensionUtils.initTranslations();
  return new Extension();
}

class Extension {
  constructor() {
    this.indicator = null;
  }

  enable() {
    Logger.info("enable");
    this.settings = Settings.getSettings();
    this.kbdSettings = Settings.getSettings("org.gnome.shell.extensions.forge.keybindings");
    this.configMgr = new Settings.ConfigManager();
    this.theme = new ThemeManager(this.settings, this.configMgr);
    this.theme.patchCss();
    this.theme.reloadStylesheet();

    if (this.sameSession) {
      Logger.debug(`enable: still in same session`);
      this.sameSession = false;
      return;
    }

    this.extWm ||= new WindowManager(this);
    this.keybindings ||= new Keybindings(this);
    this.indicator ||= new FeatureIndicator(this.settings, this.extWm);

    this.extWm.enable();
    this.keybindings.enable();
    Logger.info(`enable: finalized vars`);
  }

  disable() {
    Logger.info("disable");

    if (SessionMode.isLocked) {
      this.sameSession = true;
      Logger.debug(`disable: still in same session`);
      return;
    }

    this.extWm?.disable();

    this.keybindings?.disable();

    if (this.indicator) {
      this.indicator.destroy();
      this.indicator = null;
    }

    Logger.info(`disable: cleaning up vars`);
    this.extWm = null;
    this.keybindings = null;
    this.settings = null;
    this.indicator = null;
    this.configMgr = null;
    this.theme = null;
  }
}
