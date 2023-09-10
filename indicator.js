import GObject from "gi://GObject";
import Gio from "gi://Gio";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as QuickSettingsMenu from "resource:///org/gnome/shell/ui/main/panel/statusArea/quickSettings.js";

import * as Logger from "./logger.js";
import * as Utils from "./utils.js";

const iconName = "view-grid-symbolic";

const SettingsPopupSwitch = GObject.registerClass(
  class SettingsPopupSwitch extends PopupMenu.PopupSwitchMenuItem {
    constructor(title, settings, bind) {
      this._settings = settings;
      const active = !!this._settings.get_boolean(bind);
      super(title, active);
      Logger.info(bind, active);
      this.connect("toggled", (item) => this._settings.set_boolean(bind, item.state));
    }
  }
);

const FeatureMenuToggle = GObject.registerClass(
  class FeatureMenuToggle extends QuickSettings.QuickMenuToggle {
    constructor(settings, extWm) {
      const title = _("Tiling");
      const initSettings = Utils.isGnome(44)
        ? { title, iconName, toggleMode: true }
        : { label: title, iconName, toggleMode: true };
      super(initSettings);

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

export const FeatureIndicator = GObject.registerClass(
  class FeatureIndicator extends QuickSettings.SystemIndicator {
    constructor(settings, extWm) {
      super();

      // Create the icon for the indicator
      this._indicator = this._addIndicator();
      this._indicator.icon_name = iconName;

      // Showing the indicator when the feature is enabled
      this._settings = settings;

      const tilingModeEnabled = this._settings.get_boolean("tiling-mode-enabled");
      const quickSettingsEnabled = this._settings.get_boolean("quick-settings-enabled");

      this._indicator.visible = tilingModeEnabled && quickSettingsEnabled;

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
