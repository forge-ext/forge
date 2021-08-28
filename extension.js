/*
 * This file is part of the Forge Window Manager extension for Gnome 3
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
    return new Extension();
}

class Extension {
    constructor() {
        this.sameSession = false;
        this.forgeWm;
        this.keybindings;
        this.settings = Settings.getSettings();
        this.kbdSettings = Settings.getSettings("org.gnome.shell.extensions.forge.keybindings");
    }

    enable() {
        Logger.info("enable");

        if (this.sameSession) {
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
    }

    disable() {
        Logger.info("disable");

        if (SessionMode.isLocked) {
            this.sameSession = true;
            return;
        }

        if (this.forgeWm)
            this.forgeWm.disable();

        if (this.keybindings)
            this.keybindings.disable();
    }
}

