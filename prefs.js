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
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
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

/*********************************************
 * Declare GTK widgets for Forge.
 * Credits from ArcMenu's prefs.js
 *********************************************/

var PrefsWidget = GObject.registerClass(
    class PrefsWidget extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.HORIZONTAL,
                border_width: 0,
                margin: 0,
                width_request: 950,
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
                topLevel.set_title("Forge Preferences");
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
                this.topLevel = topLevel;
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
                    icon_name: "go-previous-symbolic"
                }),
                visible: true
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
            this.settings = Settings.getSettings();

            this.buildSettingsList();
            this.buildPanelBoxes();
            this.show_all();
        }

        returnToTop() {
            let generalStack = this.settingsStack.get_child_by_name("General");
            this.settingsStack.visible_child = generalStack;
            generalStack.activateFirstRow();
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

        showBackButton() {
            if (!this.leftHeaderBox) return;
            this.leftHeaderBox.add(this.backButton);
            this.addBackButtonAccelerator();
        }

        buildSettingsList() {
            const leftBoxWidth = 220;
            // TODO - translations!

            // Main Settings
            let generalSettingsBox = new ScrollStackBox(this, {
                widthRequest: leftBoxWidth
            });
            generalSettingsBox.addStackRow("Home", "Home", "go-home-symbolic");
            generalSettingsBox.addStackRow("Appearance", "Appearance", `${Me.path}/icons/prefs/preferences-desktop-wallpaper-symbolic.svg`, "AppearanceSettings");
            generalSettingsBox.addStackRow("Keyboard", "Keyboard", `${Me.path}/icons/prefs/input-keyboard-symbolic.svg`);
            generalSettingsBox.addStackRow("Development", "Development", `${Me.path}/icons/prefs/code-context-symbolic.svg`);
            generalSettingsBox.addStackRow("Experimental", "Experimental", `${Me.path}/icons/prefs/applications-science-symbolic.svg`);
            generalSettingsBox.addStackRow("About", "About", `${Me.path}/icons/prefs/forge-logo-symbolic.svg`);
            this.settingsStack.add_named(generalSettingsBox, "General");

            // Appearance
            let appearanceSettingsBox = new ScrollStackBox(this, {
                widthRequest: leftBoxWidth
            });
            appearanceSettingsBox.addStackRow("Focus Hint", "Focus Hint", `${Me.path}/icons/prefs/window-symbolic.svg`);
            appearanceSettingsBox.addStackRow("Windows", "Windows", `${Me.path}/icons/prefs/focus-windows-symbolic.svg`);
            this.settingsStack.add_named(appearanceSettingsBox, "AppearanceSettings");
        }

        buildPanelBoxes() {
            this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "Home"), "Home");
            this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "Focus Hint"), "Focus Hint");
            this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "Windows"), "Windows");
            this.settingsPagesStack.add_named(new KeyboardSettingsPanel(this), "Keyboard");
            this.settingsPagesStack.add_named(new DeveloperSettingsPanel(this), "Development");
            this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "Experimental"), "Experimental");
            this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "About"), "About");
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

            this.bindSignals();
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

        bindSignals() {
            let listBox = this.listBox;
            listBox.connect("row-activated", (_self, row) => {
                this.onRowLoad(_self, row);
            });
            listBox.connect("row-selected", (_self, row) => {
                let listRow = row.get_children()[0];
                this.prefsWidget.topLevel.set_title(`Forge Preferences - ${listRow.stack_name}`);
                // Always check if the listbox row has children
                // Autoload when no children, else activate the next child
                if (!listRow.child_name) {
                    this.onRowLoad(_self, row);
                }
            });
        }

        onRowLoad(_self, row) {
            let prefsWidget = this.prefsWidget;
            let settingsStack = prefsWidget.settingsStack;
            let settingsPagesStack = prefsWidget.settingsPagesStack;

            if (row) {
                let listRow = row.get_children()[0];
                let stackName = listRow.stack_name;
                settingsPagesStack.set_visible_child_name(stackName);

                if (listRow.child_name) {
                    settingsStack.set_visible_child_name(listRow.child_name);
                    let childRowScrollWin = settingsStack.
                        get_child_by_name(listRow.child_name);
                    childRowScrollWin.activateFirstRow();
                    prefsWidget.showBackButton();
                }
            }
        }

        selectFirstRow() {
            this.listBox.select_row(this.get_row_at_index(0));
        }

        activateFirstRow() {
            this.listBox.get_row_at_index(0).activate();
        }
    }
);

var PanelBox = GObject.registerClass(
    class PanelBox extends Gtk.Box {
        _init(prefsWidget, title) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                margin: 24,
                spacing: 20,
                homogeneous: false
            });
            this.prefsWidget = prefsWidget;
            this.title = title;
        }
    }
);

var FrameListBox = GObject.registerClass(
    class FrameListBox extends Gtk.Frame {
        _init() {
            super._init({
                label_yalign: 0.550
            });
            this.listBox = new Gtk.ListBox();
            this.count = 0;
            this.listBox.set_selection_mode(Gtk.SelectionMode.NONE);
            Gtk.Frame.prototype.add.call(this, this.listBox);
        }

        add(boxRow) {
            this.listBox.add(boxRow);
            this.count++;
        }

        show() {
            this.listBox.show_all();
        }
    }
);

var ListBoxRow = GObject.registerClass(
    class ListBoxRow extends Gtk.ListBoxRow {
        _init(params) {
            super._init(params);
            this.selectable = false;
            this.activatable = false;
            this.grid = new Gtk.Grid({
                margin_top: 5,
                margin_bottom: 5,
                margin_left: 10,
                margin_right: 10,
                column_spacing: 20,
                row_spacing: 20
            });
            Gtk.ListBoxRow.prototype.add.call(this, this.grid);
        }

        add(widget) {
            this.grid.add(widget);
        }
    }
);

let createLabel = (text) => {
    let newLabel = new Gtk.Label({
        label: text,
        use_markup: true,
        xalign: 0,
        hexpand: true
    });

    return newLabel;
}

var MainSettingsPanel = GObject.registerClass(
    class MainSettingsPanel extends PanelBox {
        _init(prefsWidget) {
            super._init(prefsWidget, "MainSettings");
            this.settings = prefsWidget.settings;
        }
    }
);

var KeyboardSettingsPanel = GObject.registerClass(
    class KeyboardSettingsPanel extends PanelBox {
        _init(prefsWidget) {
            super._init(prefsWidget, "KeyboardSettings");
            this.settings = prefsWidget.settings;
            this.refSettings = this.buildRefSettings();
            this.schemaName = "org.gnome.shell.extensions.forge.keybindings";
            this.kbdSettings = Settings.getSettings(this.schemaName);

            let shortcutsFrame = new FrameListBox();
            let shortcutHeader = new Gtk.Label({
                label: `<b>Update Keybindings</b>`,
                use_markup: true,
                xalign: 0,
                hexpand: true
            });

            let descriptionBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin: 6,
                spacing: 5,
                homogeneous: false
            });

            descriptionBox.add(shortcutHeader);
            descriptionBox.add(createLabel(`Syntax Example: &lt;Super&gt;h, &lt;Shift&gt;g, &lt;Shift&gt;&lt;Super&gt;h`));
            descriptionBox.add(createLabel(`Press Return key to accept. Delete text to unset. <i>Resets</i> to previous value when invalid`));
            this.add(descriptionBox);

            let shortcutGrid = new Gtk.Grid({
                margin: 12,
                column_spacing: 10,
                row_spacing: 10
            });

            this.createShortcutHeader(shortcutGrid);
            let keys = this.createKeyList(this.schemaName);

            keys.forEach((key, rowIndex) => {
                rowIndex += 1; // the header is zero index, bump by 1
                let value = this.kbdSettings.get_strv(key).toString();
                this.createShortcutRow(shortcutGrid, key, value, rowIndex);
            });

            shortcutsFrame.add(shortcutGrid);
            this.add(shortcutsFrame);
        }

        createShortcutHeader(grid) {
            grid.attach(createLabel(`Action`), 0, 0, 1, 1);
            grid.attach(createLabel(`Shortcut`), 1, 0, 1, 1);
            grid.attach(createLabel(`Conflicts With`), 2, 0, 1, 1);
        }

        createShortcutRow(grid, actionName, shortcut, rowIndex) {
            let actionLabel = createLabel(actionName);
            grid.attach(actionLabel, 0, rowIndex, 1, 1);

            let shortcutEntry = new Gtk.Entry({
                text: shortcut
            });
            shortcutEntry.prev = shortcut;
            shortcutEntry.connect("activate", (self) => {
                if (!this.setShortcut(actionName, self.text)) {
                    self.text = self.prev;
                } else {
                    self.prev = self.text;
                }
            });
            grid.attach(shortcutEntry, 1, rowIndex, 1, 1);
            // TODO check for conflicts
            grid.attach(createLabel(`--`), 2, rowIndex, 1, 1);
        }

        setShortcut(actionName, shortcut) {
            if (!shortcut || shortcut === "") {
                // when empty or blank entry, remove the shortcut
                this.kbdSettings.set_strv(actionName, []);
                return true;
            } else {
                let [key, mods] = Gtk.accelerator_parse(shortcut);

                if (Gtk.accelerator_valid(key, mods)) {
                    let shortcut = Gtk.accelerator_name(key, mods);
                    this.kbdSettings.set_strv(actionName, [shortcut]);
                    return true;
                } else {
                    // TODO warn user not valid
                    return false;
                }
            }
        }

        createKeyList(schemaName) {
            let settingsSchema = Settings.getSettingsSchema(schemaName);
            let keys = settingsSchema.list_keys();

            let alphaSortFn = (a, b) => {
                let aUp = a.toUpperCase();
                let bUp = b.toUpperCase();
                if (aUp < bUp) return -1;
                if (aUp > bUp) return 1;
                return 0;
            };

            keys.sort(alphaSortFn);
            return keys;
        }

        buildRefSettings() {
            let refSettings = {};
            // List of schemas that might have conflicts with the keybindings for Forge
            let referenceSchemas = [
                "org.gnome.desktop.wm.keybindings",
                "org.gnome.mutter.wayland.keybindings",
                "org.gnome.shell.keybindings",
                "org.gnome.shell.extensions.pop-shell",
                "com.gexperts.Tilix.Keybindings",
                "org.gnome.mutter.keybindings"
            ];

            referenceSchemas.forEach((schema) => {
                let refSetting = Settings.getSettings(schema);
                refSettings[schema] = refSetting;
            });

            return refSettings;
        }
    }
);

var DeveloperSettingsPanel = GObject.registerClass(
    class DeveloperSettingsPanel extends PanelBox {
        _init(prefsWidget) {
            super._init(prefsWidget, "DeveloperSettings");
            this.settings = prefsWidget.settings;

            let developmentFrame = new FrameListBox();
            let loggingFrameRow = new ListBoxRow();

            let loggingLabel = new Gtk.Label({
                label: `Logging Level`,
                use_markup: true,
                xalign: 0,
                hexpand: true
            });

            let loggingCombo = new Gtk.ComboBoxText();

            for (const key in Logger.LOG_LEVELS) {
                if (typeof Logger.LOG_LEVELS[key] === "number") {
                    loggingCombo.append(`${Logger.LOG_LEVELS[key]}`, key);
                }
            }

            let currentLogLevel = Logger.getLogLevel();

            loggingCombo.set_active_id(`${currentLogLevel}`);
            loggingCombo.connect("changed", () => {
                let activeId = loggingCombo.get_active_id();
                this.settings.set_uint("log-level", activeId);
            });

            loggingFrameRow.add(loggingLabel);
            loggingFrameRow.add(loggingCombo);

            developmentFrame.add(loggingFrameRow);
            developmentFrame.show();
            this.add(developmentFrame);
        }
    }
);

var UnderConstructionPanel = GObject.registerClass(
    class UnderConstructionPanel extends PanelBox {
        _init(prefsWidget, label) {
            super._init(prefsWidget, label);
            this.prefsWidget = prefsWidget;
            
            let logoPath = `${Me.path}/icons/prefs/forge-logo-symbolic.svg`;
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(logoPath, 100, 100);
            let logoImage = new Gtk.Image({
                pixbuf: pixbuf,
                margin_bottom: 5
            });

            let underConstructionText = new Gtk.Label({
                label: "Work in Progress",
                hexpand: true
            });
            underConstructionText.set_justify(Gtk.Justification.CENTER);
            
            let verticalBox = new Gtk.VBox({
                margin_top: 100,
                margin_bottom: 0,
                expand: false
            });

            verticalBox.add(logoImage);

            this.add(verticalBox);
            this.add(underConstructionText);
        }
    }
);
