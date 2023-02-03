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

var pkg_ext_text = `${pkgVersion}-${Me.metadata.version}`;
var prefs_title =
  "Forge" + " " + _("Settings") + (!Settings.production ? " - DEV" : ` - ${pkg_ext_text}`);
var prefs_wip_text = _("Development in Progress...");
var prefs_general_about = _("About");
var prefs_general_appearance = _("Appearance");
var prefs_general_development = _("Development");
var prefs_general_experimental = _("Experimental");
var prefs_general_home = _("Home");
var prefs_general_keyboard = _("Keyboard");

var prefs_appearance_windows = _("Window");
var prefs_appearance_window_gaps_title = _("Gaps");
var prefs_appearance_window_gaps_size_label = _("Gaps Size");
var prefs_appearance_window_gaps_increment_label = _("Gaps Size Increments");
var prefs_appearance_window_gaps_hidden_single_label = _("Gaps Hidden when Single");
var prefs_appearance_color = _("Color");
var prefs_appearance_color_border_size_label = _("Border Size");
var prefs_appearance_color_border_color_label = _("Border Color");
var prefs_appearance_color_border_palette_mode = _("Palette Mode");
var prefs_appearance_color_border_editor_mode = _("Editor Mode");
var prefs_appearance_color_border_changes_apply = _("Apply Changes");
var prefs_appearance_color_border_size_reset = _("Reset");
var prefs_appearance_color_border_color_reset = _("Reset");
var prefs_appearance_layout = _("Layout");
var prefs_appearance_layout_dnd_default_layout = _("Default Drag-and-Drop Center Layout");
var prefs_appearance_layout_dnd_default_layout_option_tabbed = _("Tabbed");
var prefs_appearance_layout_dnd_default_layout_option_stacked = _("Stacked");

var prefs_workspace_settings = _("Workspace");
var prefs_workspace_settings_title = _("Update Workspace Settings");
var prefs_workspace_settings_skip_tiling_label = _("Skip Workspace Tiling");
var prefs_workspace_settings_skip_tiling_instructions_text = _(
  "Provide workspace indices to skip. E.g. 0,1. Empty text to disable. Enter to accept"
);

var prefs_keyboard_window_shortcuts = _("Window Shortcuts");
var prefs_keyboard_workspace_shortcuts = _("Workspace Shortcuts");
var prefs_keyboard_container_shortcuts = _("Container Shortcuts");
var prefs_keyboard_focus_shortcuts = _("Focus Shortcuts");
var prefs_keyboard_other_shortcuts = _("Other Shortcuts");
var prefs_keyboard_function_mod_keys = _("Modifier Keys");
var prefs_keyboard_other_mod_mask_header = _("Drag-Drop Tiling Modifier Key Options");
var prefs_keyboard_other_mod_mask_informational1 = _(
  "Change the modifier for <b>tiling</b> windows via mouse/drag-drop"
);
var prefs_keyboard_other_mod_mask_informational2 = _(
  "Select <i>None</i> to <u>always tile immediately</u> by default"
);
var prefs_keyboard_mod_mask_tile_label = _("Tile Modifier");
var prefs_keyboard_mod_mask_tile_ctrl_label = _("Ctrl");
var prefs_keyboard_mod_mask_tile_super_label = _("Super");
var prefs_keyboard_mod_mask_tile_alt_label = _("Alt");
var prefs_keyboard_mod_mask_tile_none_label = _("None");

var prefs_development_logging_level_label = _("Logger Level");

var prefs_experimental_settings_title = _(
  "CAUTION: These settings when enabled are buggy or can cause the shell to crash"
);
var prefs_experimental_stacked_tiling_label = _(
  "Stacked Tiling Mode (Stack windows on top of each other while still being tiled)"
);
var prefs_experimental_tabbed_tiling_label = _("Tabbed Tiling Mode (Group tiled windows as tabs)");
var prefs_experimental_float_always_on_top = _(
  "Float Mode Always On Top (Floating windows always above tiling windows)"
);
var prefs_experimental_auto_split = _("Auto Split (Quarter Tiling)");
var prefs_experimental_preview_hint = _("Preview Hint Toggle");

var prefs_keyboard_update_keys_title = _("Update Keybindings");
var prefs_keyboard_update_keys_syntax_label = _("Syntax");
var prefs_keyboard_update_keys_legend_label = _("Legend");
var prefs_keyboard_update_keys_legend_sub_1_label = _("Windows key");
var prefs_keyboard_update_keys_legend_sub_2_label = _("Control key");
var prefs_keyboard_update_keys_instructions_text = _(
  "Delete text to unset. Press Return key to accept. Focus out to ignore."
);
var prefs_keyboard_update_keys_resets_label = _("Resets");
var prefs_keyboard_update_keys_resets_sub_1_label = _("to previous value when invalid");
var prefs_keyboard_update_keys_column_1_header = _("Action");
var prefs_keyboard_update_keys_column_2_header = _("Shortcut");
var prefs_keyboard_update_keys_column_3_header = _("Notes");

var panel_indicator_button_text = _("Forge Panel Settings");
var panel_indicator_tile_switch_text = _("Tile Mode");
var panel_indicator_prefs_open_text = _("Open Preferences");

var getCssSelectorAsMessage = (selector) => {
  switch (selector) {
    case ".window-tiled-border":
      return _("Tiled Focus Hint and Preview");
    case ".window-floated-border":
      return _("Floated Focus Hint");
    case ".window-split-border":
      return _("Split Direction Hint");
    case ".window-stacked-border":
      return _("Stacked Focus Hint and Preview");
    case ".window-tabbed-border":
      return _("Tabbed Focus Hint and Preview");
  }
};
