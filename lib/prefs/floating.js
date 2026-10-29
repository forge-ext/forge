// Gtk imports
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

// Gnome imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Extension imports
import { PreferencesPage, RemoveItemRow, ResetButton } from "./widgets.js";
import { ConfigManager } from "../shared/settings.js";

export class FloatingPage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings, dir }) {
    super({ title: _("Windows"), icon_name: "window-symbolic" });

    this.settings = settings;
    this.configMgr = new ConfigManager({ dir });

    let overrides = this.configMgr.windowProps?.overrides;
    if (!Array.isArray(overrides)) {
      overrides = this.configMgr.loadDefaultWindowConfigContents()?.overrides ?? [];
    }
    this.rows = this.loadItemsFromConfig(overrides);

    this.floatingWindowGroup = this.add_group({
      title: _("Floating Windows"),
      description: _("Windows that will not be tiled"),
      header_suffix: new ResetButton({ onReset: () => this.onResetHandler() }),
      children: this.rows,
    });
  }

  loadItemsFromConfig(overrides) {
    let children = [];
    for (let override of Array.isArray(overrides) ? overrides : []) {
      if (override.mode === "float") {
        let itemrow = new RemoveItemRow({
          title: override.wmTitle ?? override.wmClass,
          subtitle: override.wmClass,
          item: override,
          onRemove: (item, parent) => this.onRemoveHandler(item, parent),
        });
        children.push(itemrow);
      }
    }
    return children;
  }

  onRemoveHandler(item, parent) {
    const existing = this.configMgr.windowProps?.overrides;
    if (!Array.isArray(existing)) return;

    const modified = existing.filter(
      (row) =>
        row.mode !== item.mode ||
        row.wmClass !== item.wmClass ||
        (row.wmTitle ?? null) !== (item.wmTitle ?? null) ||
        (row.wmId ?? null) !== (item.wmId ?? null)
    );
    if (!this.saveOverrides(modified)) return;

    this.floatingWindowGroup.remove(parent);
    this.rows = this.rows.filter((row) => row !== parent);
  }

  saveOverrides(modified) {
    if (!Array.isArray(modified) || !this.configMgr.windowConfigFile) return false;
    this.configMgr.windowProps = { overrides: modified };
    // Signal the main extension to reload floating overrides
    const changed = Math.floor(Date.now() / 1000);
    this.settings.set_uint("window-overrides-reload-trigger", changed);
    return true;
  }

  onResetHandler() {
    const defaultWindowProps = this.configMgr.loadDefaultWindowConfigContents();
    const original = defaultWindowProps?.overrides;
    if (!Array.isArray(original) || !this.saveOverrides(original)) return;

    for (const child of this.rows) {
      this.floatingWindowGroup.remove(child);
    }

    this.rows = this.loadItemsFromConfig(original);
    for (const item of this.rows) {
      this.floatingWindowGroup.add(item);
    }
  }
}
