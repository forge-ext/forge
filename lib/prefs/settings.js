// Gnome imports
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

// Shared state
import { Logger } from "../shared/logger.js";
import { production } from "../shared/settings.js";

// Prefs UI
import { DropDownRow, SwitchRow, PreferencesPage } from "./widgets.js";

// Extension imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { PACKAGE_VERSION } from "resource:///org/gnome/Shell/Extensions/js/misc/config.js";

import { developers } from "./metadata.js";

function showAboutWindow(parent, { version, description: comments }) {
  const abt = new Adw.AboutWindow({
    ...(parent && { transient_for: parent }),
    // TODO: fetch these from github at build time
    application_name: _("Forge"),
    application_icon: "forge-logo-symbolic",
    version: `${PACKAGE_VERSION}-${version.toString()}`,
    copyright: `© 2021-${new Date().getFullYear()} jmmaranan`,
    issue_url: "https://github.com/forge-ext/forge/issues/new",
    license_type: Gtk.License.GPL_3_0,
    website: "https://github.com/forge-ext/forge",
    developers,
    comments,
    designers: [],
    translator_credits: _("translator-credits"),
  });
  abt.present();
}

function makeAboutButton(parent, metadata) {
  const button = new Gtk.Button({
    icon_name: "help-about-symbolic",
    tooltip_text: _("About"),
    valign: Gtk.Align.CENTER,
  });
  button.connect("clicked", () => showAboutWindow(parent, metadata));
  return button;
}

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
      title: _("Behavior"),
      children: [
        new SwitchRow({
          title: _("Move Pointer with the Focus"),
          subtitle: _("Move the pointer when focusing or swapping via keyboard"),
          experimental: true,
          settings,
          bind: "move-pointer-focus-enabled",
        }),
      ],
    });

    this.add_group({
      title: _("Tiling"),
      children: [
        new SwitchRow({
          title: _("Preview Hint Toggle"),
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
          title: _("Default Drag-and-Drop Center Layout"),
          settings,
          type: "s",
          bind: "dnd-center-layout",
          items: [
            { id: "swap", name: _("Swap") },
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
            type: "u",
          }),
        ],
      });
    }
  }
}
