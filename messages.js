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

// Extension imports
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

export const prefs_wip_text = _("Development in Progress...");
export const prefs_general_about = _("About");
export const prefs_general_appearance = _("Appearance");
export const prefs_general_development = _("Development");
export const prefs_general_experimental = _("Experimental");
export const prefs_general_home = _("Home");
export const prefs_general_keyboard = _("Keyboard");

export const prefs_appearance_windows = _("Window");
export const prefs_appearance_window_gaps_title = _("Gaps");
export const prefs_appearance_window_gaps_size_label = _("Gaps Size");
export const prefs_appearance_window_gaps_increment_label = _("Gaps Size Multiplier");
export const prefs_appearance_window_gaps_hidden_single_label = _("Gaps Hidden when Single");

export const prefs_appearance_borders_title = _("Borders");
export const prefs_appearance_focus_borders_label = _("Show Focus Hint Border");

export const prefs_appearance_color = _("Color");
export const prefs_appearance_color_border_size_label = _("Border Size");
export const prefs_appearance_color_border_color_label = _("Border Color");
export const prefs_appearance_color_border_palette_mode = _("Palette Mode");
export const prefs_appearance_color_border_editor_mode = _("Editor Mode");
export const prefs_appearance_color_border_changes_apply = _("Apply Changes");
export const prefs_appearance_color_border_size_reset = _("Reset");
export const prefs_appearance_color_border_color_reset = _("Reset");
export const prefs_appearance_layout = _("Layout");
export const prefs_appearance_layout_dnd_default_layout = _("Default Drag-and-Drop Center Layout");
export const prefs_appearance_layout_dnd_default_layout_option_tabbed = _("Tabbed");
export const prefs_appearance_layout_dnd_default_layout_option_stacked = _("Stacked");

export const prefs_workspace_settings = _("Workspace");
export const prefs_workspace_settings_title = _("Update Workspace Settings");
export const prefs_workspace_settings_skip_tiling_label = _("Skip Workspace Tiling");
export const prefs_workspace_settings_skip_tiling_instructions_text = _(
  "Provide workspace indices to skip. E.g. 0,1. Empty text to disable. Enter to accept"
);

export const prefs_keyboard_window_shortcuts = _("Window Shortcuts");
export const prefs_keyboard_workspace_shortcuts = _("Workspace Shortcuts");
export const prefs_keyboard_container_shortcuts = _("Container Shortcuts");
export const prefs_keyboard_focus_shortcuts = _("Focus Shortcuts");
export const prefs_keyboard_other_shortcuts = _("Other Shortcuts");
export const prefs_keyboard_function_mod_keys = _("Modifier Keys");
export const prefs_keyboard_other_mod_mask_header = _("Drag-Drop Tiling Modifier Key Options");
export const prefs_keyboard_other_mod_mask_informational1 = _(
  "Change the modifier for <b>tiling</b> windows via mouse/drag-drop"
);
export const prefs_keyboard_other_mod_mask_informational2 = _(
  "Select <i>None</i> to <u>always tile immediately</u> by default"
);
export const prefs_keyboard_mod_mask_tile_label = _("Tile Modifier");
export const prefs_keyboard_mod_mask_tile_ctrl_label = _("Ctrl");
export const prefs_keyboard_mod_mask_tile_super_label = _("Super");
export const prefs_keyboard_mod_mask_tile_alt_label = _("Alt");
export const prefs_keyboard_mod_mask_tile_none_label = _("None");

export const prefs_development_logging_level_label = _("Logger Level");

export const prefs_experimental_settings_title = _(
  "<b>CAUTION</b>: Enabling this setting can lead to bugs or cause the shell to crash"
);
export const prefs_experimental_stacked_tiling_label = _(
  "Stacked Tiling Mode (Stack windows on top of each other while still being tiled)"
);
export const prefs_experimental_tabbed_tiling_label = _(
  "Tabbed Tiling Mode (Group tiled windows as tabs)"
);
export const prefs_experimental_float_always_on_top = _(
  "Float Mode Always On Top (Floating windows always above tiling windows)"
);
export const prefs_experimental_auto_split = _("Auto Split (Quarter Tiling)");
export const prefs_experimental_preview_hint = _("Preview Hint Toggle");

export const prefs_keyboard_update_keys_title = _("Update Keybindings");
export const prefs_keyboard_update_keys_syntax_label = _("Syntax");
export const prefs_keyboard_update_keys_legend_label = _("Legend");
export const prefs_keyboard_update_keys_legend_sub_1_label = _("Windows key");
export const prefs_keyboard_update_keys_legend_sub_2_label = _("Control key");
export const prefs_keyboard_update_keys_instructions_text = _(
  "Delete text to unset. Press Return key to accept. Focus out to ignore."
);
export const prefs_keyboard_update_keys_resets_label = _("Resets");
export const prefs_keyboard_update_keys_resets_sub_1_label = _("to previous value when invalid");
export const prefs_keyboard_update_keys_column_1_header = _("Action");
export const prefs_keyboard_update_keys_column_2_header = _("Shortcut");
export const prefs_keyboard_update_keys_column_3_header = _("Notes");

export const panel_indicator_button_text = _("Forge Panel Settings");
export const panel_indicator_tile_switch_text = _("Tile Mode");
export const panel_indicator_prefs_open_text = _("Open Preferences");

export const getCssSelectorAsMessage = (selector) => {
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
