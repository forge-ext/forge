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
const { Gdk, Gtk } = imports.gi;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const _ = imports.gettext.domain(Me.metadata.uuid).gettext;

// Application imports
const Css = Me.imports.css;
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;
const Settings = Me.imports.settings;
const Theme = Me.imports.theme;

const { ColorRow, DropDownRow, EntryRow, RadioRow, SpinButtonRow, SwitchRow } = Me.imports.widgets;

const { KeyboardPage } = Me.imports.preferences.keyboard;
const { AppearancePage } = Me.imports.preferences.appearance;
const { WorkspacePage } = Me.imports.preferences.workspace;
const { SettingsPage } = Me.imports.preferences.settings;

function init() {
  const iconPath = Me.dir.get_child('resources').get_child('icons').get_path();
  const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path(iconPath);
}

function fillPreferencesWindow(window) {
  const settings = ExtensionUtils.getSettings();
  window._settings = settings;
  const kbdSettings = ExtensionUtils.getSettings("org.gnome.shell.extensions.forge.keybindings");
  window._kbdSettings = kbdSettings;
  window.add(new SettingsPage({ settings, window }));
  window.add(new AppearancePage({ settings }));
  window.add(new WorkspacePage({ settings }));
  window.add(new KeyboardPage({ settings: kbdSettings }));
  window.search_enabled = true;
  window.can_navigate_back = true;
}

