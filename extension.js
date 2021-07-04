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

// Gnome imports

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Window = Me.imports.windowManager;
const Logger = Me.imports.logger;

var forgeWm;

function init() {
    Logger.info("init");
}

function enable() {
    Logger.info("enable");

    if (!forgeWm)
        forgeWm = new Window.ForgeWindowManager();

    forgeWm.enable();
}

function disable() {
    Logger.info("disable");

    if (forgeWm) 
        forgeWm.disable();
}
