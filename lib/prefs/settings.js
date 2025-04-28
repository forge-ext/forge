// Gnome imports
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

// Shared state
import { Logger } from "../shared/logger.js";
import { production } from "../shared/settings.js";

// Prefs UI
import { DropDownRow, SwitchRow, PreferencesPage, EntryRow } from "./widgets.js";

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
    super({ title: _("Tiling"), icon_name: "view-grid-symbolic" });
    this.add_group({
      title: _("Behavior"),
      description: _("Change how the tiling behaves"),
      header_suffix: makeAboutButton(window, metadata),
      children: [
        new SwitchRow({
          title: _("Focus on Hover"),
          subtitle: _("Window focus follows the pointer"),
          experimental: true,
          settings,
          bind: "focus-on-hover-enabled",
        }),
        new SwitchRow({
          title: _("Move pointer with focused window"),
          subtitle: _("Moves the pointer when focusing or swapping via keyboard"),
          experimental: true,
          settings,
          bind: "move-pointer-focus-enabled",
        }),
        new SwitchRow({
          title: _("Quarter tiling"),
          subtitle: _("Places new windows in a clock-wise fashion"),
          experimental: true,
          settings,
          bind: "auto-split-enabled",
        }),
        new SwitchRow({
          title: _("Stacked tiling"),
          subtitle: _("Stacks windows on top of each other while still tiling them"),
          experimental: true,
          settings,
          bind: "stacked-tiling-mode-enabled",
        }),
        new SwitchRow({
          title: _("Tabbed tiling"),
          subtitle: _("Groups windows as tabs"),
          experimental: true,
          settings,
          bind: "tabbed-tiling-mode-enabled",
        }),
        new SwitchRow({
          title: _("Auto exit tabbed tiling"),
          subtitle: _("Exit tabbed tiling mode when only a single tab remains"),
          settings,
          bind: "auto-exit-tabbed",
          bind: "move-pointer-focus-enabled",
        }),
        new DropDownRow({
          title: _("Drag-and-drop behavior"),
          subtitle: _("What to do when dragging one window on top of another"),
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
          title: _("Always on Top mode for floating windows"),
          subtitle: _("Makes floating windows appear above tiled windows"),
          experimental: true,
          settings,
          bind: "float-always-on-top-enabled",
        }),
      ],
    });
    this.add_group({
      title: _("Non-tiling workspaces"),
      description: _("Disables tiling on specified workspaces. Starts from 0, separated by commas"),
      children: [
        new EntryRow({
          title: _("Example: 0,1,2"),
          settings,
          bind: "workspace-skip-tile",
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
