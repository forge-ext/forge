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

'use strict';

// Gnome imports
const SessionMode = imports.ui.main.sessionMode;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Keybindings = Me.imports.keybindings;
const Logger = Me.imports.logger;
const Settings = Me.imports.settings;
const Window = Me.imports.window;

function init() {
    Logger.info("init");
    ExtensionUtils.initTranslations();
    return new Extension();
}

class Extension {
    constructor() {
        this.sameSession = false;
    }

    enable() {
        Logger.info("enable");
        this.settings = Settings.getSettings();
        this.kbdSettings = Settings.getSettings("org.gnome.shell.extensions.forge.keybindings");

        if (this.sameSession) {
            Logger.debug(`enable: still in same session`);
            this.sameSession = false;
            return;
        }

        if (!this.forgeWm) {
            this.forgeWm = new Window.ForgeWindowManager(this);
        }

        if (!this.keybindings) {
            this.keybindings = new Keybindings.Keybindings(this);
        }

        this.forgeWm.enable();
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

        if (this.forgeWm)
            this.forgeWm.disable();

        if (this.keybindings)
            this.keybindings.disable();

        Logger.info(`disable: cleaning up vars`);
        this.forgeWm = null;
        this.keybindings = null;
        this.settings = null;
    }
}

