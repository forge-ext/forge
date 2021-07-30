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
imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Logger = Me.imports.logger;
const Settings = Me.imports.settings;

function init() {

}

function buildPrefsWidget() {
    let prefsWidget = new Gtk.Grid({
        margin: 18,
        column_spacing: 12,
        row_spacing: 12
    });

    createLoggingCombo(prefsWidget);

    // show the grid
    prefsWidget.show_all();

    return prefsWidget;
}

/**
 * Create Logger level changer in preferences
 * @param {grid} grid 
 */
function createLoggingCombo(grid) {
    let logLabel = new Gtk.Label({
        label: `Log Level`,
        halign: Gtk.Align.START
    });

    grid.attach(logLabel, 0, 0, 1, 1);

    let logCombo = new Gtk.ComboBoxText();

    for (const key in Logger.LOG_LEVELS) {
        logCombo.append(`${Logger.LOG_LEVELS[key]}`, key);
    }

    let currentLogLevelVal = Logger.getLogLevel();

    logCombo.set_active_id(`${currentLogLevelVal}`);
    logCombo.connect("changed", () => {
        let settings = Settings.getSettings();
        let activeId = logCombo.get_active_id();
        settings.set_uint("log-level", activeId);
    });

    grid.attach(logCombo, 1, 0, 1, 1);
}
