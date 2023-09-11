import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Application imports
import { Logger } from "../logger.js";
import * as Msgs from "../messages.js";

import { DropDownRow, SwitchRow, PreferencesPage } from "./widgets.js";
import { makeAboutButton } from "./about.js";
import { production } from "../settings.js";

export class SettingsPage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings, window, metadata }) {
    super({ title: _("Settings"), icon_name: "settings-symbolic" });
    this.add_group({
      title: _("Settings"),
      description: _("Toggle Forge's high-level features"),
      header_suffix: makeAboutButton(window, metadata),
      children: [
        new SwitchRow({
          title: _("Stacked Tiling Mode"),
          subtitle: _("Stack windows on top of each other while still being tiled"),
          experimental: true,
          settings,
          bind: "stacked-tiling-mode-enabled",
        }),
        new SwitchRow({
          title: _("Tabbed Tiling Mode"),
          subtitle: _("Group tiles windows as tabs"),
          experimental: true,
          settings,
          bind: "tabbed-tiling-mode-enabled",
        }),
      ],
    });

    this.add_group({
      title: _("Tiling"),
      children: [
        new SwitchRow({
          title: Msgs.prefs_experimental_preview_hint,
          experimental: true,
          settings,
          bind: "preview-hint-enabled",
        }),
        new SwitchRow({
          title: _("Show Focus Hint Border"),
          subtitle: _("Display a colored border around the focused window"),
          settings,
          bind: "focus-border-toggle",
        }),
        new SwitchRow({
          title: _("Show Window Split Hint Border"),
          subtitle: _("Show split direction border on focused window"),
          settings,
          bind: "split-border-toggle",
        }),
        new DropDownRow({
          title: Msgs.prefs_appearance_layout_dnd_default_layout,
          settings,
          bind: "dnd-center-layout",
          items: [
            { id: "tabbed", name: _("Tabbed") },
            { id: "stacked", name: _("Stacked") },
          ],
        }),
        new SwitchRow({
          title: _("Auto Split"),
          subtitle: _("Quarter Tiling"),
          experimental: true,
          settings,
          bind: "auto-split-enabled",
        }),
        new SwitchRow({
          title: _("Float Mode Always On Top"),
          subtitle: _("Floating windows always above tiling windows"),
          experimental: true,
          settings,
          bind: "float-always-on-top-enabled",
        }),
        new SwitchRow({
          title: _("Show Tiling Quick Settings"),
          subtitle: _("Toggle showing Forge on quick settings"),
          experimental: true,
          settings,
          bind: "quick-settings-enabled",
        }),
      ],
    });

    if (!production) {
      this.add_group({
        title: _("Logger"),
        children: [
          new DropDownRow({
            title: _("Logger Level"),
            settings,
            bind: "log-level",
            items: Object.entries(Logger.LOG_LEVELS).map(([name, id]) => ({ id, name })),
          }),
        ],
      });
    }
  }
}
