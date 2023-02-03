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
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Css = Me.imports.css;
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;
const Settings = Me.imports.settings;
const Theme = Me.imports.theme;

function init() {}

function buildPrefsWidget() {
  return new PrefsWidget();
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
        margin_start: 0,
        margin_end: 0,
        margin_top: 0,
        margin_bottom: 0,
        width_request: 950,
        height_request: 550,
      });

      this.connect("realize", () => {
        let topLevel = this.get_root();
        topLevel.set_title(Msgs.prefs_title);
        this.topLevel = topLevel;
      });

      // The main settings category
      this.settingsStack = new Gtk.Stack({
        hhomogeneous: true,
        transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
      });

      // list for each page of a settings category
      this.settingsPagesStack = new Gtk.Stack({
        hhomogeneous: true,
        transition_type: Gtk.StackTransitionType.CROSSFADE,
      });

      // left container box
      this.leftPanelBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      });

      let backButton = new Gtk.Button({
        icon_name: "go-previous-symbolic",
        visible: true,
      });

      this.backButton = backButton;

      backButton.connect("clicked", (_self) => {
        this.returnToTop();
        this.leftPanelBox.remove(this.backButton);
      });

      this.leftPanelBox.append(this.settingsStack);

      this.append(this.leftPanelBox);
      this.append(Gtk.Separator.new(Gtk.Orientation.VERTICAL));
      this.append(this.settingsPagesStack);
      this.settings = Settings.getSettings();

      this.buildSettingsList();
      this.buildPanelBoxes();
      this.show();
    }

    returnToTop() {
      let generalStack = this.settingsStack.get_child_by_name("General");
      this.settingsStack.visible_child = generalStack;
      generalStack.activateFirstRow();
    }

    showBackButton() {
      if (!this.leftPanelBox) return;
      this.leftPanelBox.prepend(this.backButton);
    }

    /**
     * This builds the settings item that has many child panels
     * Use the GeneralSettings box if single child panel or choose only to show the panel directly
     */
    buildSettingsList() {
      const leftBoxWidth = 220;

      // Main Settings
      let generalSettingsBox = new ScrollStackBox(this, {
        widthRequest: leftBoxWidth,
      });
      generalSettingsBox.addStackRow(
        "Home",
        Msgs.prefs_general_home,
        `${Me.path}/icons/prefs/go-home-symbolic.svg`
      );
      generalSettingsBox.addStackRow(
        "Appearance",
        Msgs.prefs_general_appearance,
        `${Me.path}/icons/prefs/color-picker-symbolic.svg`,
        "AppearanceSettings"
      );
      generalSettingsBox.addStackRow(
        "Workspace",
        Msgs.prefs_workspace_settings,
        `${Me.path}/icons/prefs/preferences-desktop-apps-symbolic.svg`
      );
      generalSettingsBox.addStackRow(
        "Keyboard",
        Msgs.prefs_general_keyboard,
        `${Me.path}/icons/prefs/input-keyboard-symbolic.svg`,
        "KeyboardSettings"
      );
      generalSettingsBox.addStackRow(
        "Experimental",
        Msgs.prefs_general_experimental,
        `${Me.path}/icons/prefs/applications-science-symbolic.svg`
      );
      if (!Settings.production) {
        generalSettingsBox.addStackRow(
          "Development",
          Msgs.prefs_general_development,
          `${Me.path}/icons/prefs/code-context-symbolic.svg`
        );
        generalSettingsBox.addStackRow(
          "About",
          Msgs.prefs_general_about,
          `${Me.path}/icons/prefs/forge-logo-symbolic.svg`
        );
      }
      this.settingsStack.add_named(generalSettingsBox, "General");

      // Appearance
      let appearanceSettingsBox = new ScrollStackBox(this, {
        widthRequest: leftBoxWidth,
      });
      appearanceSettingsBox.addStackRow(
        "Window",
        Msgs.prefs_appearance_windows,
        `${Me.path}/icons/prefs/focus-windows-symbolic.svg`
      );
      appearanceSettingsBox.addStackRow(
        "Layout",
        Msgs.prefs_appearance_layout,
        `${Me.path}/icons/prefs/preferences-desktop-wallpaper-symbolic.svg`
      );
      appearanceSettingsBox.addStackRow(
        "Color",
        Msgs.prefs_appearance_color,
        `${Me.path}/icons/prefs/color-select-symbolic.svg`
      );
      this.settingsStack.add_named(appearanceSettingsBox, "AppearanceSettings");

      // Keyboard
      let keyboardSettingsBox = new ScrollStackBox(this, {
        widthRequest: leftBoxWidth,
      });
      keyboardSettingsBox.addStackRow(
        "Window Shortcuts",
        Msgs.prefs_keyboard_window_shortcuts,
        `${Me.path}/icons/prefs/window-duplicate-symbolic.svg`
      );
      keyboardSettingsBox.addStackRow(
        "Workspace Shortcuts",
        Msgs.prefs_keyboard_workspace_shortcuts,
        `${Me.path}/icons/prefs/preferences-desktop-apps-symbolic.svg`
      );
      keyboardSettingsBox.addStackRow(
        "Container Shortcuts",
        Msgs.prefs_keyboard_container_shortcuts,
        `${Me.path}/icons/prefs/view-dual-symbolic.svg`
      );
      keyboardSettingsBox.addStackRow(
        "Focus Shortcuts",
        Msgs.prefs_keyboard_focus_shortcuts,
        `${Me.path}/icons/prefs/tool-rectangle-symbolic.svg`
      );
      keyboardSettingsBox.addStackRow(
        "Other Shortcuts",
        Msgs.prefs_keyboard_other_shortcuts,
        `${Me.path}/icons/prefs/view-grid-symbolic.svg`
      );
      keyboardSettingsBox.addStackRow(
        "Modifier Keys",
        Msgs.prefs_keyboard_function_mod_keys,
        `${Me.path}/icons/prefs/utilities-tweak-tool-symbolic.svg`
      );
      this.settingsStack.add_named(keyboardSettingsBox, "KeyboardSettings");
    }

    buildPanelBoxes() {
      this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "Home"), "Home");
      this.settingsPagesStack.add_named(
        new UnderConstructionPanel(this, "Appearance"),
        "Appearance"
      );
      this.settingsPagesStack.add_named(new AppearanceWindowSettingsPanel(this), "Window");
      this.settingsPagesStack.add_named(new AppearanceLayoutSettingsPanel(this), "Layout");
      this.settingsPagesStack.add_named(new AppearanceColorSettingsPanel(this), "Color");
      this.settingsPagesStack.add_named(new WorkspaceSettingsPanel(this), "Workspace");
      this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "Keyboard"), "Keyboard");
      this.settingsPagesStack.add_named(
        new KeyboardSettingsPanel(this, "window-"),
        "Window Shortcuts"
      );
      this.settingsPagesStack.add_named(
        new KeyboardSettingsPanel(this, "workspace-"),
        "Workspace Shortcuts"
      );
      this.settingsPagesStack.add_named(
        new KeyboardSettingsPanel(this, "con-"),
        "Container Shortcuts"
      );
      this.settingsPagesStack.add_named(
        new KeyboardSettingsPanel(this, "focus-"),
        "Focus Shortcuts"
      );
      this.settingsPagesStack.add_named(
        new KeyboardSettingsPanel(this, "prefs-"),
        "Other Shortcuts"
      );
      this.settingsPagesStack.add_named(
        new KeyboardSettingsPanel(this, "modmask"),
        "Modifier Keys"
      );
      this.settingsPagesStack.add_named(
        new ExperimentalSettingsPanel(this, "Experimental"),
        "Experimental"
      );
      if (!Settings.production) {
        this.settingsPagesStack.add_named(new DeveloperSettingsPanel(this), "Development");
        this.settingsPagesStack.add_named(new UnderConstructionPanel(this, "About"), "About");
      }
    }
  }
);

var ScrollStackBox = GObject.registerClass(
  class ScrollStackBox extends Gtk.ScrolledWindow {
    _init(prefsWidget, params) {
      super._init({
        valign: Gtk.Align.FILL,
        vexpand: true,
      });

      this.listBox = new Gtk.ListBox({
        hexpand: false,
        valign: Gtk.Align.FILL,
        vexpand: true,
        width_request: params.widthRequest,
        activate_on_single_click: true,
      });

      this.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
      this.set_child(this.listBox);
      this.prefsWidget = prefsWidget;

      this.bindSignals();
    }

    addStackRow(name, labelName, iconPath, childName) {
      let row = new Gtk.Grid({
        margin_start: 12,
        margin_end: 12,
        margin_top: 12,
        margin_bottom: 12,
        column_spacing: 10,
      });

      row.stack_name = name;
      row.label_name = labelName;

      let iconImage = new Gtk.Image({
        gicon: Gio.icon_new_for_string(iconPath),
      });

      let label = new Gtk.Label({
        label: labelName,
        halign: Gtk.Align.START,
      });

      row.attach(iconImage, 0, 0, 1, 1);
      row.attach(label, 1, 0, 1, 1);

      if (childName) {
        row.child_name = childName;
        let nextPageIcon = new Gtk.Image({
          gicon: Gio.icon_new_for_string(`${Me.path}/icons/prefs/go-next-symbolic.svg`),
          halign: Gtk.Align.END,
          hexpand: true,
        });

        row.attach(nextPageIcon, 2, 0, 1, 1);
      }

      this.listBox.append(row);
    }

    bindSignals() {
      let listBox = this.listBox;
      listBox.connect("row-activated", (_self, row) => {
        this.onRowLoad(_self, row);
      });
      listBox.connect("row-selected", (_self, row) => {
        let listRow = row.get_child();
        this.prefsWidget.topLevel.set_title(`${Msgs.prefs_title} - ${listRow.label_name}`);
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
        let listRow = row.get_child();
        let stackName = listRow.stack_name;
        settingsPagesStack.set_visible_child_name(stackName);

        if (listRow.child_name) {
          settingsStack.set_visible_child_name(listRow.child_name);
          let childRowScrollWin = settingsStack.get_child_by_name(listRow.child_name);
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
  class PanelBox extends Gtk.ScrolledWindow {
    _init(prefsWidget, title) {
      super._init({
        valign: Gtk.Align.FILL,
        vexpand: true,
      });
      this.prefsWidget = prefsWidget;
      this.title = title;
      this.box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_start: 24,
        margin_end: 24,
        margin_top: 24,
        margin_bottom: 24,
        spacing: 20,
        homogeneous: false,
      });

      Gtk.ScrolledWindow.prototype.set_child.call(this, this.box);
    }

    append(widget) {
      this.box.append(widget);
    }
  }
);

var FrameListBox = GObject.registerClass(
  class FrameListBox extends Gtk.Frame {
    _init() {
      super._init();
      this.listBox = new Gtk.ListBox();
      this.count = 0;
      this.listBox.set_selection_mode(Gtk.SelectionMode.NONE);
      Gtk.Frame.prototype.set_child.call(this, this.listBox);
    }

    add(boxRow) {
      this.listBox.append(boxRow);
      this.count++;
    }

    show() {
      this.listBox.show();
    }
  }
);

var ListBoxRow = GObject.registerClass(
  class ListBoxRow extends Gtk.ListBoxRow {
    _init(params) {
      super._init(params);
      this.selectable = false;
      this.activatable = false;
      this.box = new Gtk.Box({
        margin_top: 5,
        margin_bottom: 5,
        margin_start: 10,
        margin_end: 10,
        orientation: Gtk.Orientation.HORIZONTAL,
      });
      Gtk.ListBoxRow.prototype.set_child.call(this, this.box);
    }

    add(widget) {
      this.box.append(widget);
    }
  }
);

let createLabel = (text) => {
  let newLabel = new Gtk.Label({
    label: text,
    use_markup: true,
    xalign: 0,
    hexpand: true,
  });

  return newLabel;
};

var MainSettingsPanel = GObject.registerClass(
  class MainSettingsPanel extends PanelBox {
    _init(prefsWidget) {
      super._init(prefsWidget, "MainSettings");
      this.settings = prefsWidget.settings;
    }
  }
);

var AppearanceWindowSettingsPanel = GObject.registerClass(
  class AppearanceWindowSettingsPanel extends PanelBox {
    _init(prefsWidget) {
      super._init(prefsWidget, `Appearance Window Settings`);
      this.settings = prefsWidget.settings;

      let appearanceWindowFrame = new FrameListBox();
      // Gaps Section
      let gapHeader = createLabel(Msgs.prefs_appearance_window_gaps_title);
      this.append(gapHeader);

      // Gap Size Base
      let gapSizeRow = new ListBoxRow();
      let gapSizeLabel = createLabel(Msgs.prefs_appearance_window_gaps_size_label);
      let gapSizeAdjust = new Gtk.Adjustment({
        lower: 4,
        step_increment: 4,
        upper: 32,
        value: this.settings.get_uint("window-gap-size"),
      });
      let gapSizeSpin = new Gtk.SpinButton({
        adjustment: gapSizeAdjust,
      });
      gapSizeSpin.connect("value-changed", () => {
        this.settings.set_uint("window-gap-size", gapSizeSpin.value);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "window-gap-size") {
          gapSizeSpin.set_value(this.settings.get_uint("window-gap-size"));
        }
      });
      gapSizeRow.add(gapSizeLabel);
      gapSizeRow.add(gapSizeSpin);

      // Gap Size Increments
      let gapSizeIncrementRow = new ListBoxRow();
      let gapSizeIncrementLabel = createLabel(Msgs.prefs_appearance_window_gaps_increment_label);
      let gapSizeIncrementAdjust = new Gtk.Adjustment({
        lower: 0,
        step_increment: 1,
        upper: 8,
        value: this.settings.get_uint("window-gap-size-increment"),
      });
      let gapSizeIncrementSpin = new Gtk.SpinButton({
        adjustment: gapSizeIncrementAdjust,
      });
      gapSizeIncrementSpin.connect("value-changed", () => {
        this.settings.set_uint("window-gap-size-increment", gapSizeIncrementSpin.value);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "window-gap-size-increment") {
          gapSizeIncrementSpin.set_value(this.settings.get_uint("window-gap-size-increment"));
        }
      });
      gapSizeIncrementRow.add(gapSizeIncrementLabel);
      gapSizeIncrementRow.add(gapSizeIncrementSpin);

      // Gap Hidden when Single Window
      let gapHiddenWhenSingleRow = new ListBoxRow();
      let gapHiddenWhenSingleLabel = createLabel(
        Msgs.prefs_appearance_window_gaps_hidden_single_label
      );
      let gapHiddenWhenSingleSwitch = new Gtk.Switch();
      gapHiddenWhenSingleSwitch.set_active(
        this.settings.get_boolean("window-gap-hidden-on-single")
      );
      gapHiddenWhenSingleSwitch.connect("state-set", (_, state) => {
        if (!state) {
          if (this.settings.get_uint("window-gap-size-increment") === 0) {
            this.settings.set_uint("window-gap-size-increment", 1);
          }
        }
        this.settings.set_boolean("window-gap-hidden-on-single", state);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "window-gap-hidden-on-single") {
          gapHiddenWhenSingleSwitch.set_active(
            this.settings.get_boolean("window-gap-hidden-on-single")
          );
        }
      });
      gapHiddenWhenSingleRow.add(gapHiddenWhenSingleLabel);
      gapHiddenWhenSingleRow.add(gapHiddenWhenSingleSwitch);

      appearanceWindowFrame.add(gapSizeRow);
      appearanceWindowFrame.add(gapSizeIncrementRow);
      appearanceWindowFrame.add(gapHiddenWhenSingleRow);

      this.append(appearanceWindowFrame);
    }
  }
);

var AppearanceLayoutSettingsPanel = GObject.registerClass(
  class AppearanceLayoutSettingsPanel extends PanelBox {
    _init(prefsWidget) {
      super._init(prefsWidget, `Appearance Layout Settings`);
      this.settings = prefsWidget.settings;

      let appearanceLayoutFrame = new FrameListBox();

      // default drag-and-drop layout when grouping
      let defaultDndLayout = new ListBoxRow();
      let defaultLayoudDndLabel = new Gtk.Label({
        label: `${Msgs.prefs_appearance_layout_dnd_default_layout}`,
        use_markup: true,
        xalign: 0,
        hexpand: true,
      });
      let defaultDndLayoutCombo = new Gtk.ComboBoxText();
      // uppercase IDs break drag-and-drop center area color
      defaultDndLayoutCombo.append(
        "tabbed",
        `${Msgs.prefs_appearance_layout_dnd_default_layout_option_tabbed}`
      );
      defaultDndLayoutCombo.append(
        "stacked",
        `${Msgs.prefs_appearance_layout_dnd_default_layout_option_stacked}`
      );
      let currentDndLayout = this.settings.get_string("dnd-center-layout");
      defaultDndLayoutCombo.set_active_id(`${currentDndLayout}`);
      defaultDndLayoutCombo.connect("changed", () => {
        let activeId = defaultDndLayoutCombo.get_active_id();
        this.settings.set_string("dnd-center-layout", activeId);
      });
      defaultDndLayout.add(defaultLayoudDndLabel);
      defaultDndLayout.add(defaultDndLayoutCombo);

      appearanceLayoutFrame.add(defaultDndLayout);

      this.append(appearanceLayoutFrame);
    }
  }
);

var AppearanceColorSettingsPanel = GObject.registerClass(
  class AppearanceColorSettingsPanel extends PanelBox {
    _init(prefsWidget) {
      super._init(prefsWidget, "Appearance Color Settings");
      this.themeMgr = new Theme.ThemeManager(prefsWidget.settings, new Settings.ConfigManager(), {
        prefsMode: true,
      });
      this._createColorOptionWidget(".window-tiled-border");
      this._createColorOptionWidget(".window-tabbed-border");
      this._createColorOptionWidget(".window-stacked-border");
      this._createColorOptionWidget(".window-floated-border");
      this._createColorOptionWidget(".window-split-border");
    }

    _createColorOptionWidget(selector) {
      const theme = this.themeMgr;
      const labelMessage = Msgs.getCssSelectorAsMessage(selector);
      const colorScheme = theme.getColorSchemeBySelector(selector);
      this.append(createLabel(`<b>${labelMessage}</b>`));

      let colorOptionFrame = new FrameListBox();
      let colorOptionHintSizeRow = new ListBoxRow();
      let colorOptionHintSizeLabel = createLabel(
        `${Msgs.prefs_appearance_color_border_size_label}`
      );
      let colorOptionHintSizeSpin = Gtk.SpinButton.new_with_range(1, 6, 1);
      let colorOptionHintSizeReset = new Gtk.Button({
        label: `${Msgs.prefs_appearance_color_border_size_reset}`,
        halign: Gtk.Align.END,
      });

      colorOptionHintSizeSpin.max_width_chars = 1;
      colorOptionHintSizeSpin.max_length = 1;
      colorOptionHintSizeSpin.width_chars = 2;
      colorOptionHintSizeSpin.xalign = 1;
      colorOptionHintSizeSpin.value = theme.removePx(
        theme.getCssProperty(selector, "border-width").value
      );

      colorOptionHintSizeSpin.connect("value-changed", (widget) => {
        theme.setCssProperty(selector, "border-width", theme.addPx(widget.value));
      });

      colorOptionHintSizeReset.connect("clicked", () => {
        const borderDefault = theme.defaultPalette[colorScheme]["border-width"];
        theme.setCssProperty(selector, "border-width", theme.addPx(borderDefault));
        colorOptionHintSizeSpin.value = borderDefault;
      });

      colorOptionHintSizeRow.add(colorOptionHintSizeLabel);
      colorOptionHintSizeRow.add(colorOptionHintSizeSpin);
      colorOptionHintSizeRow.add(colorOptionHintSizeReset);

      colorOptionFrame.add(colorOptionHintSizeRow);

      let colorOptionHintColorRow = new ListBoxRow();
      let colorOptionHintColorLabel = createLabel(
        `${Msgs.prefs_appearance_color_border_color_label}`
      );

      let colorOptionHintColorPalette = new Gtk.ToggleButton({
        label: `${Msgs.prefs_appearance_color_border_palette_mode}`,
        halign: Gtk.Align.END,
      });

      let colorOptionHintColorEditor = new Gtk.ToggleButton({
        label: `${Msgs.prefs_appearance_color_border_editor_mode}`,
        group: colorOptionHintColorPalette,
        halign: Gtk.Align.END,
      });

      let colorOptionHintColorApply = new Gtk.Button({
        label: `${Msgs.prefs_appearance_color_border_changes_apply}`,
        halign: Gtk.Align.END,
      });

      let colorOptionHintColorReset = new Gtk.Button({
        label: `${Msgs.prefs_appearance_color_border_color_reset}`,
        halign: Gtk.Align.END,
      });

      colorOptionHintColorPalette.connect("toggled", () => {
        colorOptionColorChooser.show_editor = !colorOptionHintColorPalette.get_active();
      });

      colorOptionHintColorEditor.connect("toggled", () => {
        colorOptionColorChooser.show_editor = colorOptionHintColorEditor.get_active();
      });

      const updateCssColors = (rgbaString) => {
        const rgba = new Gdk.RGBA();

        if (rgba.parse(rgbaString)) {
          const previewBorderRgba = rgba.copy();
          const previewBackgroundRgba = rgba.copy();
          const overviewBackgroundRgba = rgba.copy();

          previewBorderRgba.alpha = 0.3;
          previewBackgroundRgba.alpha = 0.2;
          overviewBackgroundRgba.alpha = 0.5;

          // The primary color updates the focus hint:
          theme.setCssProperty(selector, "border-color", rgba.to_string());

          // Only apply below on the tabbed scheme
          if (colorScheme === "tabbed") {
            const tabBorderRgba = rgba.copy();
            const tabActiveBackgroundRgba = rgba.copy();
            tabBorderRgba.alpha = 0.6;
            theme.setCssProperty(
              `.window-${colorScheme}-tab`,
              "border-color",
              tabBorderRgba.to_string()
            );
            theme.setCssProperty(
              `.window-${colorScheme}-tab-active`,
              "background-color",
              tabActiveBackgroundRgba.to_string()
            );
          }
          // And then finally the preview when doing drag/drop tiling:
          theme.setCssProperty(
            `.window-tilepreview-${colorScheme}`,
            "border-color",
            previewBorderRgba.to_string()
          );
          theme.setCssProperty(
            `.window-tilepreview-${colorScheme}`,
            "background-color",
            previewBackgroundRgba.to_string()
          );
        }
      };

      colorOptionHintColorApply.connect("clicked", () => {
        updateCssColors(colorOptionColorChooser.get_rgba().to_string());
      });

      colorOptionHintColorReset.connect("clicked", () => {
        const selectorColor = theme.defaultPalette[colorScheme].color;
        updateCssColors(selectorColor);
        updateColorChooserValue(selectorColor);
      });

      let colorOptionColorChooser = new Gtk.ColorChooserWidget({
        halign: Gtk.Align.CENTER,
        margin_top: 10,
        margin_bottom: 10,
      });

      let updateColorChooserValue = (borderColor) => {
        let gdkRgba = new Gdk.RGBA();

        if (gdkRgba.parse(borderColor)) {
          colorOptionColorChooser.set_rgba(gdkRgba);
        }
      };

      updateColorChooserValue(theme.getCssProperty(selector, "border-color").value);

      // TODO figure out how to connect the custom (+) color button so the radio buttons can be toggled
      colorOptionColorChooser.connect("color-activated", (colorRgba) => {
        theme.setCssProperty(selector, "border-color", colorRgba.to_string());
      });

      colorOptionHintColorRow.add(colorOptionHintColorLabel);
      colorOptionHintColorRow.add(colorOptionHintColorPalette);
      colorOptionHintColorRow.add(colorOptionHintColorEditor);
      colorOptionHintColorRow.add(colorOptionHintColorApply);
      colorOptionHintColorRow.add(colorOptionHintColorReset);

      colorOptionFrame.add(colorOptionHintColorRow);
      colorOptionFrame.add(colorOptionColorChooser);

      this.append(colorOptionFrame);
    }
  }
);

var WorkspaceSettingsPanel = GObject.registerClass(
  class WorkspaceSettingsPanel extends PanelBox {
    _init(prefsWidget) {
      super._init(prefsWidget, "Workspace Settings");
      this.settings = prefsWidget.settings;

      let workspaceHeader = new Gtk.Label({
        label: `<b>${Msgs.prefs_workspace_settings_title}</b>`,
        use_markup: true,
        xalign: 0,
        hexpand: true,
      });

      let descriptionBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 6,
        margin_start: 6,
        margin_end: 6,
        margin_bottom: 6,
        spacing: 5,
        homogeneous: false,
      });
      descriptionBox.append(workspaceHeader);
      this.append(descriptionBox);

      let workspaceFrame = new FrameListBox();

      let workspaceAdjustTileRow = new ListBoxRow();
      let workspaceAdjustDescriptBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 6,
        margin_start: 6,
        margin_end: 6,
        margin_bottom: 6,
        spacing: 5,
        homogeneous: false,
      });
      let workspaceAdjustTileLabel = createLabel(Msgs.prefs_workspace_settings_skip_tiling_label);
      let workspaceAdjustTileInstructions = createLabel(
        Msgs.prefs_workspace_settings_skip_tiling_instructions_text
      );
      workspaceAdjustDescriptBox.append(workspaceAdjustTileLabel);
      workspaceAdjustDescriptBox.append(workspaceAdjustTileInstructions);

      let workspaceAdjustTileEntry = new Gtk.Entry();

      workspaceAdjustTileEntry.set_text(this.settings.get_string("workspace-skip-tile"));
      this.settings.connect("changed::workspace-skip-tile", () => {
        workspaceAdjustTileEntry.set_text(this.settings.get_string("workspace-skip-tile"));
      });
      workspaceAdjustTileEntry.connect("activate", () => {
        let currEntry = workspaceAdjustTileEntry.get_text();
        let prevEntry = this.settings.get_string("workspace-skip-tile");
        if (!currEntry || (currEntry && (currEntry.trim().length === 0 || currEntry === ""))) {
          this.settings.set_string("workspace-skip-tile", "");
          return;
        } else {
          let currEntryArr = currEntry.split(",");
          let errors = 0;

          for (let i = 0; i < currEntryArr.length; i++) {
            if (isNaN(parseInt(currEntryArr[i]))) {
              errors += 1;
            }
          }

          if (errors > 0) {
            workspaceAdjustTileEntry.set_text(prevEntry);
          } else {
            this.settings.set_string("workspace-skip-tile", currEntry);
          }
        }
      });

      workspaceAdjustTileRow.add(workspaceAdjustDescriptBox);
      let workspaceAdjustEntryBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 6,
        margin_start: 6,
        margin_end: 6,
        margin_bottom: 6,
        spacing: 5,
        homogeneous: false,
      });
      workspaceAdjustEntryBox.append(workspaceAdjustTileEntry);
      workspaceAdjustTileRow.add(workspaceAdjustEntryBox);
      workspaceFrame.add(workspaceAdjustTileRow);

      this.append(workspaceFrame);
    }
  }
);

var KeyboardSettingsPanel = GObject.registerClass(
  class KeyboardSettingsPanel extends PanelBox {
    _init(prefsWidget, category) {
      super._init(prefsWidget, `Keyboard Settings ${category}`);
      this.settings = prefsWidget.settings;
      this.category = category; //window-, focus-, con-
      // TODO - calling this each time can introduce performance issues
      // this.refSettings = this.buildRefSettings();
      this.schemaName = "org.gnome.shell.extensions.forge.keybindings";
      this.kbdSettings = Settings.getSettings(this.schemaName);

      switch (this.category) {
        case "window-":
        case "con-":
        case "workspace-":
        case "prefs-":
        case "focus-":
          this._initializeShortcuts();
          break;
        case "modmask":
          this._initializeModMaskOptions();
          break;
        case "options":
        default:
          break;
      }
    }

    createShortcutHeader(grid) {
      let headerAction = createLabel(`${Msgs.prefs_keyboard_update_keys_column_1_header}`);
      headerAction.width_chars = 30;
      grid.attach(headerAction, 0, 0, 1, 1);
      grid.attach(createLabel(`${Msgs.prefs_keyboard_update_keys_column_2_header}`), 1, 0, 1, 1);
      grid.attach(createLabel(`${Msgs.prefs_keyboard_update_keys_column_3_header}`), 2, 0, 1, 1);
    }

    createShortcutRow(grid, actionName, shortcuts, rowIndex) {
      let actionLabel = createLabel(actionName);
      grid.attach(actionLabel, 0, rowIndex, 1, 1);

      let shortcutEntry = new Gtk.Entry({
        text: shortcuts,
        width_request: 150,
      });
      shortcutEntry.prev = shortcuts;
      this.kbdSettings.connect(`changed::${actionName}`, () => {
        let shortcuts = this.kbdSettings.get_strv(actionName).toString();
        shortcutEntry.text = shortcuts;
      });
      let updateChange = () => {
        if (!this.setShortcut(actionName, shortcutEntry.text)) {
          shortcutEntry.text = shortcutEntry.prev;
        } else {
          shortcutEntry.prev = shortcutEntry.text;
        }
      };
      shortcutEntry.connect("activate", updateChange.bind(this));
      shortcutEntry.connect("move-focus", () => {
        shortcutEntry.text = shortcutEntry.prev;
      });

      grid.attach(shortcutEntry, 1, rowIndex, 1, 1);
      // TODO check for conflicts
      grid.attach(createLabel(`--`), 2, rowIndex, 1, 1);
    }

    setShortcut(actionName, shortcuts) {
      if (!shortcuts || shortcuts === "") {
        // when empty or blank entry, remove the shortcut
        this.kbdSettings.set_strv(actionName, []);
        return true;
      } else {
        let shortcutArray = shortcuts.split(",");
        let processed = 0;
        let processedShortcuts = [];
        shortcutArray.forEach((shortcut) => {
          let [_valid, key, mods] = Gtk.accelerator_parse(shortcut);

          if (Gtk.accelerator_valid(key, mods)) {
            let validShortcut = Gtk.accelerator_name(key, mods);
            processedShortcuts.push(validShortcut);
            processed += 1;
          }
        });

        if (processed === shortcutArray.length) {
          this.kbdSettings.set_strv(actionName, processedShortcuts);
          return true;
        }
        return false;
      }
    }

    createKeyList(schemaName, categoryName) {
      let settingsSchema = Settings.getSettingsSchema(schemaName);
      let keys = settingsSchema.list_keys();

      let filterFn = (keyName) => {
        if (!keyName) return false;
        if (!categoryName) return false;

        return keyName.indexOf(categoryName) === 0;
      };

      keys = keys.filter(filterFn);

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

    // TODO move this to keybindings.js or settings.js
    buildRefSettings() {
      let refSettings = {};
      // List of schemas that might have conflicts with the keybindings for Forge
      let referenceSchemas = [
        "org.gnome.desktop.wm.keybindings",
        "org.gnome.mutter.wayland.keybindings",
        "org.gnome.shell.keybindings",
        "org.gnome.shell.extensions.pop-shell",
        "com.gexperts.Tilix.Keybindings",
        "org.gnome.mutter.keybindings",
      ];

      referenceSchemas.forEach((schema) => {
        let refSetting = Settings.getSettings(schema);
        refSettings[schema] = refSetting;
      });

      return refSettings;
    }

    _initializeShortcuts() {
      let shortcutsFrame = new FrameListBox();
      let shortcutHeader = new Gtk.Label({
        label: `<b>${Msgs.prefs_keyboard_update_keys_title}</b>`,
        use_markup: true,
        xalign: 0,
        hexpand: true,
      });

      let descriptionBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_start: 6,
        margin_end: 6,
        margin_top: 6,
        margin_bottom: 6,
        spacing: 5,
        homogeneous: false,
      });

      descriptionBox.append(shortcutHeader);
      descriptionBox.append(
        createLabel(
          `<i>${Msgs.prefs_keyboard_update_keys_syntax_label}</i>: &lt;Super&gt;h, &lt;Shift&gt;g, &lt;Shift&gt;&lt;Super&gt;h`
        )
      );
      descriptionBox.append(
        createLabel(
          `<i>${Msgs.prefs_keyboard_update_keys_legend_label}</i>: &lt;Super&gt; - ${Msgs.prefs_keyboard_update_keys_legend_sub_1_label}, &lt;Primary&gt; - ${Msgs.prefs_keyboard_update_keys_legend_sub_2_label}`
        )
      );
      descriptionBox.append(
        createLabel(
          `${Msgs.prefs_keyboard_update_keys_instructions_text} <i>${Msgs.prefs_keyboard_update_keys_resets_label}</i> ${Msgs.prefs_keyboard_update_keys_resets_sub_1_label}`
        )
      );
      this.append(descriptionBox);

      let shortcutGrid = new Gtk.Grid({
        margin_start: 12,
        margin_end: 12,
        margin_top: 12,
        margin_bottom: 12,
        column_spacing: 10,
        row_spacing: 10,
      });

      this.createShortcutHeader(shortcutGrid);
      let keys = this.createKeyList(this.schemaName, this.category);

      keys.forEach((key, rowIndex) => {
        rowIndex += 1; // the header is zero index, bump by 1
        let shortcuts = this.kbdSettings.get_strv(key).toString(); // <Super>s,<Super>t
        this.createShortcutRow(shortcutGrid, key, shortcuts, rowIndex);
      });

      shortcutsFrame.add(shortcutGrid);
      this.append(shortcutsFrame);
    }

    _initializeModMaskOptions() {
      let modMaskDescriptionBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_start: 6,
        margin_end: 6,
        margin_top: 6,
        margin_bottom: 6,
        spacing: 5,
        homogeneous: false,
      });

      modMaskDescriptionBox.append(
        createLabel(`<b>${Msgs.prefs_keyboard_other_mod_mask_header}</b>`)
      );
      modMaskDescriptionBox.append(
        createLabel(`<i>${Msgs.prefs_keyboard_other_mod_mask_informational1}</i>`)
      );
      modMaskDescriptionBox.append(
        createLabel(`${Msgs.prefs_keyboard_other_mod_mask_informational2}`)
      );

      let modMaskFrame = new FrameListBox();
      let modMaskTileRowOption = new ListBoxRow();
      let modMaskTileLabel = createLabel(`${Msgs.prefs_keyboard_mod_mask_tile_label}`);
      let modMaskTileToggleBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_start: 3,
        margin_end: 3,
        margin_top: 3,
        margin_bottom: 3,
        spacing: 3,
        homogeneous: false,
      });

      const _handleTileToggle = (button) => {
        if (button.active === false) return;
        const toggleLabel = button.label;
        let labelValue = "Super";

        switch (toggleLabel) {
          case `${Msgs.prefs_keyboard_mod_mask_tile_ctrl_label}`:
            labelValue = "Ctrl";
            break;
          case `${Msgs.prefs_keyboard_mod_mask_swap_alt_label}`:
            labelValue = "Alt";
            break;
          case `${Msgs.prefs_keyboard_mod_mask_tile_none_label}`:
            labelValue = "None";
            break;
        }

        this.kbdSettings.set_string("mod-mask-mouse-tile", labelValue);
      };

      let modMaskTileCtrlToggle = new Gtk.ToggleButton({
        label: `${Msgs.prefs_keyboard_mod_mask_tile_ctrl_label}`,
      });

      let modMaskTileSuperToggle = new Gtk.ToggleButton({
        group: modMaskTileCtrlToggle,
        label: `${Msgs.prefs_keyboard_mod_mask_tile_super_label}`,
      });

      let modMaskTileAltToggle = new Gtk.ToggleButton({
        group: modMaskTileCtrlToggle,
        label: `${Msgs.prefs_keyboard_mod_mask_tile_alt_label}`,
      });

      let modMaskTileNoneToggle = new Gtk.ToggleButton({
        group: modMaskTileCtrlToggle,
        label: `${Msgs.prefs_keyboard_mod_mask_tile_none_label}`,
      });

      modMaskTileCtrlToggle.connect("clicked", _handleTileToggle.bind(this));
      modMaskTileSuperToggle.connect("clicked", _handleTileToggle.bind(this));
      modMaskTileAltToggle.connect("clicked", _handleTileToggle.bind(this));
      modMaskTileNoneToggle.connect("clicked", _handleTileToggle.bind(this));

      const currentTileModifier = this.kbdSettings.get_string("mod-mask-mouse-tile");

      // Set the initial toggle value:
      switch (currentTileModifier) {
        case "Ctrl":
          modMaskTileCtrlToggle.active = true;
          break;
        case "Super":
          modMaskTileSuperToggle.active = true;
          break;
        case "Alt":
          modMaskTileAltToggle.active = true;
          break;
        case "None":
          modMaskTileNoneToggle.active = true;
          break;
      }

      modMaskTileToggleBox.append(modMaskTileCtrlToggle);
      modMaskTileToggleBox.append(modMaskTileSuperToggle);
      modMaskTileToggleBox.append(modMaskTileAltToggle);
      modMaskTileToggleBox.append(modMaskTileNoneToggle);

      modMaskTileRowOption.add(modMaskTileLabel);
      modMaskTileRowOption.add(modMaskTileToggleBox);

      modMaskFrame.add(modMaskTileRowOption);

      this.append(modMaskDescriptionBox);
      this.append(modMaskFrame);
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
        label: `${Msgs.prefs_development_logging_level_label}`,
        use_markup: true,
        xalign: 0,
        hexpand: true,
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
      this.append(developmentFrame);
    }
  }
);

var ExperimentalSettingsPanel = GObject.registerClass(
  class ExperimentalSettingsPanel extends PanelBox {
    _init(prefsWidget) {
      super._init(prefsWidget, "ExperimentalSettings");
      this.settings = prefsWidget.settings;

      let experimentalHeader = new Gtk.Label({
        label: `<b>${Msgs.prefs_experimental_settings_title}</b>`,
        use_markup: true,
        xalign: 0,
        hexpand: true,
      });

      let descriptionBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 6,
        margin_start: 6,
        margin_end: 6,
        margin_bottom: 6,
        spacing: 5,
        homogeneous: false,
      });

      descriptionBox.append(experimentalHeader);

      this.append(descriptionBox);

      let experimentalFrame = new FrameListBox();
      let experimentStackedTilingRow = new ListBoxRow();

      // Stacked Windows switch
      let experimentStackedTilingLabel = createLabel(Msgs.prefs_experimental_stacked_tiling_label);
      let experimentStackedTilingSwitch = new Gtk.Switch();
      experimentStackedTilingSwitch.set_active(
        this.settings.get_boolean("stacked-tiling-mode-enabled")
      );
      experimentStackedTilingSwitch.connect("state-set", (_, state) => {
        this.settings.set_boolean("stacked-tiling-mode-enabled", state);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "stacked-tiling-mode-enabled") {
          experimentStackedTilingSwitch.set_active(
            this.settings.get_boolean("stacked-tiling-mode-enabled")
          );
        }
      });

      experimentStackedTilingRow.add(experimentStackedTilingLabel);
      experimentStackedTilingRow.add(experimentStackedTilingSwitch);

      experimentalFrame.add(experimentStackedTilingRow);

      // Tabbed Windows switch
      let experimentTabbedTilingRow = new ListBoxRow();
      let experimentTabbedTilingLabel = createLabel(Msgs.prefs_experimental_tabbed_tiling_label);
      let experimentTabbedTilingSwitch = new Gtk.Switch();
      experimentTabbedTilingSwitch.set_active(
        this.settings.get_boolean("tabbed-tiling-mode-enabled")
      );
      experimentTabbedTilingSwitch.connect("state-set", (_, state) => {
        this.settings.set_boolean("tabbed-tiling-mode-enabled", state);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "tabbed-tiling-mode-enabled") {
          experimentTabbedTilingSwitch.set_active(
            this.settings.get_boolean("tabbed-tiling-mode-enabled")
          );
        }
      });

      experimentTabbedTilingRow.add(experimentTabbedTilingLabel);
      experimentTabbedTilingRow.add(experimentTabbedTilingSwitch);

      experimentalFrame.add(experimentTabbedTilingRow);

      // Floating Windows Always On Top Switch
      let experimentFloatAlwaysOnTopRow = new ListBoxRow();
      let experimentFloatAlwaysOnTopLabel = createLabel(
        Msgs.prefs_experimental_float_always_on_top
      );
      let experimentFloatAlwaysOnTopSwitch = new Gtk.Switch();
      experimentFloatAlwaysOnTopSwitch.set_active(
        this.settings.get_boolean("float-always-on-top-enabled")
      );
      experimentFloatAlwaysOnTopSwitch.connect("state-set", (_, state) => {
        this.settings.set_boolean("float-always-on-top-enabled", state);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "float-always-on-top-enabled") {
          experimentFloatAlwaysOnTopSwitch.set_active(
            this.settings.get_boolean("float-always-on-top-enabled")
          );
        }
      });

      experimentFloatAlwaysOnTopRow.add(experimentFloatAlwaysOnTopLabel);
      experimentFloatAlwaysOnTopRow.add(experimentFloatAlwaysOnTopSwitch);

      experimentalFrame.add(experimentFloatAlwaysOnTopRow);

      let experimentAutoSplitRow = new ListBoxRow();
      let experimentAutoSplitLabel = createLabel(Msgs.prefs_experimental_auto_split);
      let experimentAutoSplitSwitch = new Gtk.Switch();
      experimentAutoSplitSwitch.set_active(this.settings.get_boolean("auto-split-enabled"));
      experimentAutoSplitSwitch.connect("state-set", (_, state) => {
        this.settings.set_boolean("auto-split-enabled", state);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "auto-split-enabled") {
          experimentAutoSplitSwitch.set_active(this.settings.get_boolean("auto-split-enabled"));
        }
      });

      experimentAutoSplitRow.add(experimentAutoSplitLabel);
      experimentAutoSplitRow.add(experimentAutoSplitSwitch);

      experimentalFrame.add(experimentAutoSplitRow);

      let experimentPreviewHintRow = new ListBoxRow();
      let experimentPreviewHintLabel = createLabel(Msgs.prefs_experimental_preview_hint);
      let experimentPreviewHintSwitch = new Gtk.Switch();
      experimentPreviewHintSwitch.set_active(this.settings.get_boolean("preview-hint-enabled"));
      experimentPreviewHintSwitch.connect("state-set", (_, state) => {
        this.settings.set_boolean("preview-hint-enabled", state);
      });
      this.settings.connect("changed", (_, keyName) => {
        if (keyName === "preview-hint-enabled") {
          experimentPreviewHintSwitch.set_active(this.settings.get_boolean("preview-hint-enabled"));
        }
      });

      experimentPreviewHintRow.add(experimentPreviewHintLabel);
      experimentPreviewHintRow.add(experimentPreviewHintSwitch);

      experimentalFrame.add(experimentPreviewHintRow);

      this.append(experimentalFrame);
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
      let logoImage = Gtk.Image.new_from_pixbuf(pixbuf);
      logoImage.margin_bottom = 5;

      let underConstructionText = new Gtk.Label({
        label: `${Msgs.prefs_wip_text} Extension version : ${Msgs.pkg_ext_text}`,
        hexpand: true,
      });
      underConstructionText.set_justify(Gtk.Justification.CENTER);

      let verticalBox = new Gtk.Box({
        margin_top: 100,
        margin_bottom: 0,
        orientation: Gtk.Orientation.VERTICAL,
      });

      verticalBox.append(logoImage);

      this.append(verticalBox);
      this.append(underConstructionText);
    }
  }
);
