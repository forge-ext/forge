// Gnome imports
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

// Prefs UI
import { PreferencesPage, RemoveItemRow } from "./widgets.js";

// Extension imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Shared state
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

    let configMgr = new ConfigManager({ dir });
    let overrides = configMgr.windowProps.overrides;
    let children = [];
    for (let index in overrides) {
      let override = overrides[index];
      if (override.mode === "float") {
        children.push(
          new RemoveItemRow({
            title: override.wmTitle ?? override.wmClass,
            subtitle: override.wmClass,
            onRemove: (item, parent) => {
              const existing = configMgr.windowProps.overrides;
              const modified = existing.filter((row) => item != row.wmClass);
              parent.hide();
              const saveProps = {
                overrides: modified,
              };
              configMgr.windowProps = saveProps;
            },
          })
        );
      }
    }

    this.add_group({
      title: _("Floating Windows"),
      description: _("Windows that will not be tiled"),
      header_suffix: makeAddButton(),
      children: children,
    });
  }
}
