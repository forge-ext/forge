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
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

// Shell imports
const Button = imports.ui.panelMenu.Button;
const PopupMenuItem = imports.ui.popupMenu.PopupMenuItem;
const PopupSeparatorMenuItem = imports.ui.popupMenu.PopupSeparatorMenuItem;
const PopupSwitchMenuItem = imports.ui.popupMenu.PopupSwitchMenuItem;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;

var PanelIndicator = GObject.registerClass(
  class PanelIndicator extends Button {
    _init(settings, extWm) {
      super._init(0.0, Msgs.panel_indicator_button_text);
      this.settings = settings;
      this.extWm = extWm;

      let tileIconOff = Gio.icon_new_for_string(
        `${Me.path}/icons/panel/focus-windows-symbolic.svg`
      );
      let tileIconOn = Gio.icon_new_for_string(`${Me.path}/icons/panel/view-dual-symbolic.svg`);
      let workspaceIconOff = Gio.icon_new_for_string(
        `${Me.path}/icons/panel/window-duplicate-symbolic.svg`
      );

      let buttonIcon = new St.Icon({
        gicon: tileIconOn,
        style_class: "system-status-icon",
      });

      this.buttonOn = tileIconOn;
      this.buttonOff = tileIconOff;
      this.buttonWsOff = workspaceIconOff;

      this.icon = buttonIcon;
      this._buildMenu();

      this.settings.connect("changed", (_, settingName) => {
        switch (settingName) {
          case "tiling-mode-enabled":
          case "workspace-skip-tile":
            this.updateTileIcon();
            this.tileSwitch.setToggleState(this._isTiled());
        }
      });

      this.add_actor(this.icon);
      this.updateTileIcon();
    }

    updateTileIcon() {
      if (this._isTiled()) {
        if (this.extWm.isCurrentWorkspaceTiled()) {
          this.icon.gicon = this.buttonOn;
        } else {
          this.icon.gicon = this.buttonWsOff;
        }
      } else {
        this.icon.gicon = this.buttonOff;
      }
    }

    _buildMenu() {
      // Tiling Mode switch
      let tileSwitch = new PopupSwitchMenuItem(
        Msgs.panel_indicator_tile_switch_text,
        this._isTiled()
      );
      tileSwitch.connect("toggled", () => {
        let state = tileSwitch.state;
        this.settings.set_boolean("tiling-mode-enabled", state);
        this.updateTileIcon();
      });
      this.tileSwitch = tileSwitch;
      this.menu.addMenuItem(tileSwitch);

      // Preferences Shortcut
      let prefMenuItem = new PopupMenuItem(Msgs.panel_indicator_prefs_open_text);
      prefMenuItem.connect("activate", () => {
        const action = { name: "PrefsOpen" };
        this.extWm.command(action);
      });
      this.menu.addMenuItem(prefMenuItem);

      // Extension version
      const gnomeVersion = imports.misc.config.PACKAGE_VERSION;
      const versionLabel = new PopupMenuItem(
        `Version ${Me.metadata.version} on GNOME ${gnomeVersion}`
      );
      this.menu.addMenuItem(versionLabel);
    }

    _isTiled() {
      return this.settings.get_boolean("tiling-mode-enabled");
    }
  }
);
