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

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { KeyboardPage } from "./preferences/keyboard.js";
import { AppearancePage } from "./preferences/appearance.js";
import { WorkspacePage } from "./preferences/workspace.js";
import { SettingsPage } from "./preferences/settings.js";

export default class ForgeExtentionPreferences extends ExtensionPreferences {
  init() {
    const iconPath = this.dir.get_child("resources").get_child("icons").get_path();
    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    iconTheme.add_search_path(iconPath);
  }

  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    window._settings = settings;
    const kbdSettings = this.getSettings("org.gnome.shell.extensions.forge.keybindings");
    window._kbdSettings = kbdSettings;
    window.add(new SettingsPage({ settings, window }));
    window.add(new AppearancePage({ settings }));
    window.add(new WorkspacePage({ settings }));
    window.add(new KeyboardPage({ settings: kbdSettings }));
    window.search_enabled = true;
    window.can_navigate_back = true;
  }
}
