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

// Gnome imports
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

// Shell imports
const Button = imports.ui.panelMenu.Button;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;

var PanelIndicator = GObject.registerClass(
    class PanelIndicator extends Button {
        _init(settings, forgeWm) {
            super._init(0.0, Msgs.panel_indicator_button_text);
            this.settings = settings;
            this.forgeWm = forgeWm;

            let tileIconOff = Gio.icon_new_for_string(`${Me.path}/icons/panel/focus-windows-symbolic.svg`);
            let tileIconOn = Gio.icon_new_for_string(`${Me.path}/icons/panel/view-dual-symbolic.svg`);
            let workspaceIconOff = Gio.icon_new_for_string(`${Me.path}/icons/panel/window-duplicate-symbolic.svg`);

            let buttonIcon = new St.Icon({
                gicon: tileIconOn,
                style_class: "system-status-icon"
            });

            this.buttonOn = tileIconOn;
            this.buttonOff = tileIconOff;
            this.buttonWsOff = workspaceIconOff;

            this.icon = buttonIcon;

            this.settings.connect("changed", (_, settingName) => {
                switch (settingName) {
                    case "tiling-mode-enabled":
                    case "workspace-skip-tile":
                        this._updateTileIcon();
                }
            });

            this.add_actor(this.icon);
            this._updateTileIcon();
        }

        _updateTileIcon() {
            if (this.settings.get_boolean("tiling-mode-enabled")) {
                if (this.forgeWm.isWorkspaceTiled(this.forgeWm.focusMetaWindow)) {
                    this.icon.gicon = this.buttonOn;
                } else {
                    this.icon.gicon = this.buttonWsOff;
                }
            } else {
                this.icon.gicon = this.buttonOff;
            }

        }
    }
);
