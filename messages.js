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

const Gettext = imports.gettext;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
ExtensionUtils.initTranslations();
Gettext.textdomain(Me.metadata["gettext-domain"]);
const _ = Gettext.gettext;

// App imports
const Settings = Me.imports.settings;

let pkgVersion = imports.misc.config.PACKAGE_VERSION;

var pkg_ext_text =`${pkgVersion}-${Me.metadata.version}`;
var prefs_title = "Forge" + " " + _("Settings") + (!Settings.production ? " - DEV" : ` - ${pkg_ext_text}`);
var prefs_wip_text = _("Development in Progress...");
var prefs_general_about = _("About");
var prefs_general_appearance = _("Appearance");
var prefs_general_development = _("Development");
var prefs_general_experimental = _("Experimental");
var prefs_general_home = _("Home");
var prefs_general_keyboard = _("Keyboard");

var prefs_appearance_windows = _("Windows");
var prefs_appearance_window_gaps_title = _("Gaps");
var prefs_appearance_window_gaps_size_label = _("Gaps Size");
var prefs_appearance_window_gaps_increment_label = _("Gaps Size Increments");
var prefs_appearance_window_gaps_hidden_single_label = _("Gaps Hidden when Single");

var prefs_workspace_settings = _("Workspace");
var prefs_workspace_settings_title = _("Update Workspace Settings");
var prefs_workspace_settings_skip_tiling_label = _("Skip Workspace Tiling");
var prefs_workspace_settings_skip_tiling_instructions_text = _("Provide workspace indices to skip. E.g. 0,1. Empty text to disable. Enter to accept");

var prefs_keyboard_window_shortcuts = _("Window Shortcuts");
var prefs_keyboard_workspace_shortcuts = _("Workspace Shortcuts");
var prefs_keyboard_container_shortcuts = _("Container Shortcuts");
var prefs_keyboard_focus_shortcuts = _("Focus Shortcuts");
var prefs_keyboard_other_shortcuts = _("Other Shortcuts");

var prefs_development_logging_level_label = _("Logger Level");

var prefs_keyboard_update_keys_title = _("Update Keybindings");
var prefs_keyboard_update_keys_syntax_label = _("Syntax");
var prefs_keyboard_update_keys_legend_label = _("Legend");
var prefs_keyboard_update_keys_legend_sub_1_label = _("Windows key");
var prefs_keyboard_update_keys_legend_sub_2_label = _("Control key");
var prefs_keyboard_update_keys_instructions_text = _("Delete text to unset. Press Return key to accept. Focus out to ignore.");
var prefs_keyboard_update_keys_resets_label = _("Resets");
var prefs_keyboard_update_keys_resets_sub_1_label = _("to previous value when invalid");
var prefs_keyboard_update_keys_column_1_header = _("Action");
var prefs_keyboard_update_keys_column_2_header = _("Shortcut");
var prefs_keyboard_update_keys_column_3_header = _("Notes");

var panel_indicator_button_text = _("Forge Panel Settings");
