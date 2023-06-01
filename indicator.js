"use strict";

const { GObject, Gio } = imports.gi;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const QuickSettings = imports.ui.quickSettings;
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Logger = Me.imports.logger;
const Utils = Me.imports.utils;

const iconName = "view-grid-symbolic";

const SettingsPopupSwitch = GObject.registerClass(
  class SettingsPopupSwitch extends PopupMenu.PopupSwitchMenuItem {
    _init(title, settings, bind) {
      this._settings = settings;
      const active = !!this._settings.get_boolean(bind);
      super._init(title, active);
      Logger.info(bind, active);
      this.connect("toggled", (item) => this._settings.set_boolean(bind, item.state));
    }
  }
);

const FeatureMenuToggle = GObject.registerClass(
  class FeatureMenuToggle extends QuickSettings.QuickMenuToggle {
    _init(settings, extWm) {
      const title = _("Tiling");
      const initSettings = Utils.isGnome(44)
        ? { title, iconName, toggleMode: true }
        : { label: title, iconName, toggleMode: true };
      super._init(initSettings);

      this._settings = settings;
      this._extWm = extWm;
      this._settings.bind("tiling-mode-enabled", this, "checked", Gio.SettingsBindFlags.DEFAULT);
      this._settings.bind("quick-settings-enabled", this, "visible", Gio.SettingsBindFlags.DEFAULT);

      this.menu.setHeader(iconName, _("Forge"), _("Tiling Window Management"));

      this.menu.addMenuItem(
        (this._singleSwitch = new SettingsPopupSwitch(
          _("Gaps Hidden when Single"),
          this._settings,
          "window-gap-hidden-on-single"
        ))
      );

      this.menu.addMenuItem(
        (this._focusHintSwitch = new SettingsPopupSwitch(
          _("Show Focus Hint Border"),
          this._settings,
          "focus-border-toggle"
        ))
      );

      // Add an entry-point for more settings
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const settingsItem = this.menu.addAction(_("Settings"), () => ExtensionUtils.openPrefs());

      // Ensure the settings are unavailable when the screen is locked
      settingsItem.visible = Main.sessionMode.allowSettings;
      this.menu._settingsActions[Me.uuid] = settingsItem;
    }
  }
);

var FeatureIndicator = GObject.registerClass(
  class FeatureIndicator extends QuickSettings.SystemIndicator {
    _init(settings, extWm) {
      super._init();

      // Create the icon for the indicator
      this._indicator = this._addIndicator();
      this._indicator.icon_name = iconName;

      // Showing the indicator when the feature is enabled
      this._settings = settings;

      this._settings.connect("changed", (_, name) => {
        switch (name) {
          case "tiling-mode-enabled":
          case "quick-settings-enabled":
            this._indicator.visible = this._settings.get_boolean(name);
        }
      });

      // Create the toggle and associate it with the indicator, being sure to
      // destroy it along with the indicator
      this.quickSettingsItems.push(new FeatureMenuToggle(settings, extWm));

      this.connect("destroy", () => {
        this.quickSettingsItems.forEach((item) => item.destroy());
      });

      // Add the indicator to the panel and the toggle to the menu
      QuickSettingsMenu._indicators.add_child(this);
      this._addItems(this.quickSettingsItems);
    }

    // To add your toggle above another item, such as Background Apps, add it
    // using the built-in function, then move them afterwards.
    _addItems(items) {
      QuickSettingsMenu._addItems(items);

      if (QuickSettingsMenu._backgroundApps) {
        for (const item of items) {
          QuickSettingsMenu.menu._grid.set_child_below_sibling(
            item,
            QuickSettingsMenu._backgroundApps.quickSettingsItems[0]
          );
        }
      }
    }
  }
);
