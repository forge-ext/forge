import GObject from "gi://GObject";
import Gio from "gi://Gio";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import { QuickMenuToggle, SystemIndicator } from "resource:///org/gnome/shell/ui/quickSettings.js";
import {
  PopupSwitchMenuItem,
  PopupSeparatorMenuItem,
} from "resource:///org/gnome/shell/ui/popupMenu.js";

import * as Utils from "./utils.js";
import { Logger } from "../shared/logger.js";

const iconName = "view-grid-symbolic";

/** @typedef {import('../../extension.js').default} ForgeExtension */

class SettingsPopupSwitch extends PopupSwitchMenuItem {
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
    const active = !!extension.settings.get_boolean(bind);
    super(title, active);
    this.extension = extension;
    Logger.info(bind, active);
    this.connect("toggled", (item) => this.extension.settings.set_boolean(bind, item.state));
  }
}

export class FeatureMenuToggle extends QuickMenuToggle {
  static {
    GObject.registerClass(this);
  }

  constructor(extension) {
    const title = _("Tiling");
    const initSettings = Utils.isGnomeGTE(45)
      ? { title, iconName, toggleMode: true }
      : { label: title, iconName, toggleMode: true };
    super(initSettings);
    this.extension = extension;
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
    this.menu.addMenuItem(new PopupSeparatorMenuItem());
    const settingsItem = this.menu.addAction(_("Settings"), () => this.extension.openPreferences());

    // Ensure the settings are unavailable when the screen is locked
    settingsItem.visible = Main.sessionMode.allowSettings;
    this.menu._settingsActions[this.extension.uuid] = settingsItem;
  }
}

export class FeatureIndicator extends SystemIndicator {
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
  }
}
