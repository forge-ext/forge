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
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Logger = Me.imports.logger;
const Settings = Me.imports.settings;

var newPrefs = true;

function init() {

}

function buildPrefsWidget() {
    let prefsWidget;
    if (newPrefs) {
        prefsWidget = new PrefsWidget();
    } else {
        prefsWidget = legacy();
    }

    return prefsWidget;
}

function legacy() {
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

/**
 * Declare the root Gtk class
 */
var PrefsWidget = GObject.registerClass(
    class PrefsWidget extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.HORIZONTAL,
                border_width: 0,
                margin: 0,
                width_request: 750,
                height_request: 550
            });

            this.connect("realize", () => {
                this.leftHeaderBox = new Gtk.Box({
                    hexpand: true,
                    visible: true
                });

                this.accelGroup = new Gtk.AccelGroup();
                let prefsAccelGroup = this.accelGroup;
                let topLevel = this.get_toplevel();
                topLevel.set_title("Forge Preferences Window");
                topLevel.get_titlebar().pack_start(this.leftHeaderBox);
                topLevel.add_accel_group(prefsAccelGroup);
                topLevel.set_modal(true);
                topLevel.set_type_hint(Gdk.WindowTypeHint.DIALOG);
                topLevel.set_resizable(false);

                topLevel.connect("key-press-event", (_self, keyevent) => {
                    let [, val] = keyevent.get_keyval();
                    if (val === Gdk.KEY_Escape) {
                        topLevel.close();
                    }
                    return false;
                });
            });

            // The main settings category
            this.settingsStack = new Gtk.Stack({
                hhomogeneous: true,
                transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT
            });

            // list for each page of a settings category
            this.settingsPagesStack = new Gtk.Stack({
                hhomogeneous: true,
                transition_type: Gtk.StackTransitionType.CROSSFADE
            });

            // left container box
            this.leftPanelBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL
            });

            let backButton = new Gtk.Button({
                image: new Gtk.Image({
                    icon_name: "go-previous-symbolic",
                    visible: true
                })
            });

            this.backButton = backButton;

            backButton.connect("clicked", (_self) => {
                this.returnToTop();
                this.leftHeaderBox.remove(this.backButton);
                this.removeBackButtonAccelerator();
            });

            this.leftPanelBox.add(this.settingsStack);

            this.add(this.leftPanelBox);
            this.add(Gtk.Separator.new(Gtk.Orientation.VERTICAL));
            this.add(this.settingsPagesStack);

            this.buildSettingsList();
            this.show_all();
        }

        returnToTop() {
            let generalStack = this.settingsStack.get_child_by_name("General");
            this.settingsStack.visible_child = generalStack;
            generalStack.activate_first_row();
        }

        addBackButtonAccelerator() {
            let backButton = this.backButton;
            let backButtonShortCut = `<Alt>Left`;
            let [backButtonKey, backButtonMod] =
                Gtk.accelerator_parse(backButtonShortCut);
            backButton.add_accelerator("clicked",
                this.accelGroup,
                backButtonKey,
                backButtonMod,
                Gtk.AccelFlags.VISIBLE);
        }

        removeBackButtonAccelerator() {
            let backButton = this.backButton;
            let backButtonShortCut = `<Alt>Left`;
            let [backButtonKey, backButtonMod] =
                Gtk.accelerator_parse(backButtonShortCut);
            backButton.remove_accelerator(this.accelGroup,
                backButtonKey,
                backButtonMod);
        }

        buildSettingsList() {
            const leftBoxWidth = 220;
            let generalSettingsBox = new ScrollStackBox(this, {
                widthRequest: leftBoxWidth
            });

            generalSettingsBox.addStackRow("Main", "Main", "go-home-symbolic");

            this.settingsStack.add_named(generalSettingsBox, "General");
        }
    }
);

var ScrollStackBox = GObject.registerClass(
    class ScrollStackBox extends Gtk.ScrolledWindow {
        _init(prefsWidget, params) {
            super._init({
                valign: Gtk.Align.FILL,
                vexpand: true
            });

            this.listBox = new Gtk.ListBox({
                hexpand: false,
                valign: Gtk.Align.FILL,
                vexpand: true,
                width_request: params.widthRequest,
                activate_on_single_click: true
            });

            this.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
            this.add_with_viewport(this.listBox);
            this.prefsWidget = prefsWidget;
        }

        addStackRow(name, labelName, iconPath, childName) {
            let row = new Gtk.Grid({
                margin: 12,
                column_spacing: 10
            });

            row.stack_name = name;
            row.label_name = labelName;

            let iconImage = new Gtk.Image({
                gicon: Gio.icon_new_for_string(iconPath)
            });

            let label = new Gtk.Label({
                label: labelName,
                halign: Gtk.Align.START
            });

            row.add(iconImage);
            row.add(label);

            if (childName) {
                row.child_name = childName;
                let nextPageIcon = new Gtk.Image({
                    gicon: Gio.icon_new_for_string("go-next-symbolic"),
                    halign: Gtk.Align.END,
                    hexpand: true
                });

                row.add(nextPageIcon);
            }

            this.listBox.add(row);
        }
    }
);
