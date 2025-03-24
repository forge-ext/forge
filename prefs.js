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
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { KeyboardPage } from "./lib/prefs/keyboard.js";
import { AppearancePage } from "./lib/prefs/appearance.js";
import { SettingsPage } from "./lib/prefs/settings.js";

export default class ForgeExtensionPreferences extends ExtensionPreferences {
  settings = this.getSettings();

  kbdSettings = this.getSettings("org.gnome.shell.extensions.forge.keybindings");

  constructor(...args) {
    super(...args);
    const iconPath = this.dir.get_child("resources").get_child("icons").get_path();
    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    iconTheme.add_search_path(iconPath);
  }

  fillPreferencesWindow(window) {
    this.window = window;
    window._settings = this.settings;
    window._kbdSettings = this.kbdSettings;
    window.add(new SettingsPage(this));
    window.add(new AppearancePage(this));
    window.add(new KeyboardPage(this));
    window.search_enabled = true;
    window.can_navigate_back = true;
  }
}
