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
const Window = Me.imports.window;

var forgeWm;
var keybindings;
var sameSession = false;

function init() {
    Logger.info("init");
}

function enable() {
    Logger.info("enable");

    if (sameSession) {
        sameSession = false;
        return;
    }

    if (!forgeWm) {
        forgeWm = new Window.ForgeWindowManager();
    }

    if (!keybindings) {
        keybindings = new Keybindings.Keybindings(forgeWm);
    }

    forgeWm.enable();
    keybindings.enable();
}

function disable() {
    Logger.info("disable");

    if (SessionMode.isLocked) {
        sameSession = true;
        return;
    }

    if (forgeWm)
        forgeWm.disable();

    if (keybindings)
        keybindings.disable();
}
