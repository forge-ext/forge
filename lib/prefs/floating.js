// Gtk imports
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

// Gnome imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Extension imports
import { PreferencesPage, RemoveItemRow } from "./widgets.js";
import { ConfigManager } from "../shared/settings.js";

function showAddWindow() {
  console.log("Add window functionality not implemented yet");
}

function makeAddButton() {
  const button = new Gtk.Button({
    icon_name: "tab-new-symbolic",
    tooltip_text: _("Add Window"),
    valign: Gtk.Align.CENTER,
  });
  button.connect("clicked", () => showAddWindow());
  return button;
}

export class FloatingPage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings, dir }) {
    super({ title: _("Windows"), icon_name: "window-symbolic" });

    this.settings = settings;
    this.configMgr = new ConfigManager({ dir });
    let overrides = this.configMgr.windowProps.overrides;
    let children = [];
    for (let index in overrides) {
      let override = overrides[index];
      if (override.mode === "float") {
        let itemrow = new RemoveItemRow({
          title: override.wmTitle ?? override.wmClass,
          subtitle: override.wmClass,
          onRemove: this.onRemoveHandler,
        });
        children.push(itemrow);
      }
    }

    this.add_group({
      title: _("Floating Windows"),
      description: _("Windows that will not be tiled"),
      header_suffix: makeAddButton(),
      children: children,
    });
  }

  onRemoveHandler(item, parent) {
    parent.hide();
    const existing = this.configMgr.windowProps.overrides;
    const modified = existing.filter((row) => item != row.wmClass);
    this.saveOverrides(modified);
  }

  saveOverrides(modified) {
    if (modified) {
      this.configMgr.windowProps = {
        overrides: modified,
      };
      // Signal the main extension to reload floating overrides
      const changed = Math.floor(Date.now() / 1000);
      this.settings.set_uint("window-overrides-reload-trigger", changed);
    }
  }
}
