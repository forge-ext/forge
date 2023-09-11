import GObject from "gi://GObject";
import Gio from "gi://Gio";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as QuickSettingsMenu from "resource:///org/gnome/shell/ui/main/panel/statusArea/quickSettings.js";

import * as Utils from "./utils.js";

const iconName = "view-grid-symbolic";

/** @typedef {import('./extension.js').default} ForgeExtension */

class SettingsPopupSwitch extends PopupMenu.PopupSwitchMenuItem {
  static {
    GObject.registerClass(this);
  }

  /** @type {ForgeExtension} extension */
  extension;

  /**
   * @param {string} title
   * @param {ForgeExtension} extension
   * @param {string} bind
   */
  constructor(title, extension, bind) {
    this.extension = extension;
    const active = !!this.extension.settings.get_boolean(bind);
    super(title, active);
    this.extension.settings.info(bind, active);
    this.connect("toggled", (item) => this.extension.settings.set_boolean(bind, item.state));
  }
}

class FeatureMenuToggle extends QuickSettings.QuickMenuToggle {
  static {
    GObject.registerClass(this);
  }

  constructor(extension) {
    this.extension = extension;
    const title = _("Tiling");
    // TODO: 45?
    const initSettings = Utils.isGnomeGTE(44)
      ? { title, iconName, toggleMode: true }
      : { label: title, iconName, toggleMode: true };
    super(initSettings);

    this.extension.settings.bind(
      "tiling-mode-enabled",
      this,
      "checked",
      Gio.SettingsBindFlags.DEFAULT
    );
    this.extension.settings.bind(
      "quick-settings-enabled",
      this,
      "visible",
      Gio.SettingsBindFlags.DEFAULT
    );

    this.menu.setHeader(iconName, _("Forge"), _("Tiling Window Management"));

    this.menu.addMenuItem(
      (this._singleSwitch = new SettingsPopupSwitch(
        _("Gaps Hidden when Single"),
        this.extension,
        "window-gap-hidden-on-single"
      ))
    );

    this.menu.addMenuItem(
      (this._focusHintSwitch = new SettingsPopupSwitch(
        _("Show Focus Hint Border"),
        this.extension,
        "focus-border-toggle"
      ))
    );

    // Add an entry-point for more settings
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    const settingsItem = this.menu.addAction(_("Settings"), () => ExtensionUtils.openPrefs());

    // Ensure the settings are unavailable when the screen is locked
    settingsItem.visible = Main.sessionMode.allowSettings;
    this.menu._settingsActions[this._extWm.ext.uuid] = settingsItem;
  }
}

export class FeatureIndicator extends QuickSettings.SystemIndicator {
  static {
    GObject.registerClass(this);
  }

  constructor(extension) {
    super();

    this.extension = extension;

    // Create the icon for the indicator
    this._indicator = this._addIndicator();
    this._indicator.icon_name = iconName;

    const tilingModeEnabled = this.extension.settings.get_boolean("tiling-mode-enabled");
    const quickSettingsEnabled = this.extension.settings.get_boolean("quick-settings-enabled");

    this._indicator.visible = tilingModeEnabled && quickSettingsEnabled;

    this.extension.settings.connect("changed", (_, name) => {
      switch (name) {
        case "tiling-mode-enabled":
        case "quick-settings-enabled":
          this._indicator.visible = this.extension.settings.get_boolean(name);
      }
    });

    // Create the toggle and associate it with the indicator, being sure to
    // destroy it along with the indicator
    this.quickSettingsItems.push(new FeatureMenuToggle(extension));

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
