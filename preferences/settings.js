"use strict";

// Gnome imports
const { Adw, GObject, Gtk } = imports.gi;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const _ = imports.gettext.domain(Me.metadata.uuid).gettext;

// Application imports
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;

const { DropDownRow, SwitchRow, PreferencesPage } = Me.imports.widgets;
const { makeAboutButton } = Me.imports.preferences.about;
const { production } = Me.imports.settings;

var SettingsPage = GObject.registerClass(
  class SettingsPage extends PreferencesPage {
    _init({ settings, window }) {
      super._init({ title: _("Settings"), icon_name: "settings-symbolic" });
      this.add_group({
        title: _("Settings"),
        description: _("Toggle Forge's high-level features"),
        header_suffix: makeAboutButton(window),
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
);
