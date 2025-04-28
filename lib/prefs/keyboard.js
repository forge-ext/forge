// Gnome imports
import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

// Extension Imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Prefs UI
import { EntryRow, PreferencesPage, RadioRow } from "./widgets.js";
import { Logger } from "../shared/logger.js";

export class KeyboardPage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ kbdSettings }) {
    super({ title: _("Keyboard"), icon_name: "input-keyboard-symbolic" });

    this.add_group({
      title: _("Drag-and-drop modifier key"),
      description: _(
        "Change the modifier key for tiling windows via drag-and-drop. Select 'None' to always tile"
      ),
      children: [
        new RadioRow({
          title: _("Modifier key"),
          settings: kbdSettings,
          bind: "mod-mask-mouse-tile",
          options: {
            Super: _("Super"),
            Ctrl: _("Ctrl"),
            Alt: _("Alt"),
            None: _("None"),
          },
        }),
      ],
    });
    this.add_group({
      title: _("Shortcuts"),
      description: _(
        'Change the tiling shortcuts. To clear a shortcut clear the input field. To apply a shortcut press enter. <a href="https://github.com/forge-ext/forge/wiki/Keyboard-Shortcuts">Syntax examples</a>'
      ),
      children: Object.entries({
        window: "Tiling shortcuts",
        con: "Container shortcuts",
        workspace: "Workspace shortcuts",
        focus: "Appearance shortcuts",
        prefs: "Other shortcuts",
      }).map(([prefix, gettextKey]) =>
        KeyboardPage.makeKeygroupExpander(prefix, gettextKey, kbdSettings)
      ),
    });
  }

  static makeKeygroupExpander(prefix, gettextKey, settings) {
    const expander = new Adw.ExpanderRow({ title: _(gettextKey) });
    KeyboardPage.createKeyList(settings, prefix).forEach((key) =>
      expander.add_row(
        new EntryRow({
          title: key,
          settings,
          bind: key,
          map: {
            from(settings, bind) {
              return settings.get_strv(bind).join(",");
            },
            to(settings, bind, value) {
              if (!!value) {
                const mappings = value.split(",").map((x) => {
                  const [, key, mods] = Gtk.accelerator_parse(x);
                  return Gtk.accelerator_valid(key, mods) && Gtk.accelerator_name(key, mods);
                });
                if (mappings.every((x) => !!x)) {
                  Logger.info("setting", bind, "to", mappings);
                  settings.set_strv(bind, mappings);
                }
              } else {
                // If value deleted, unset the mapping
                settings.set_strv(bind, []);
              }
            },
          },
        })
      )
    );
    return expander;
  }

  static createKeyList(settings, categoryName) {
    return settings
      .list_keys()
      .filter((keyName) => !!keyName && !!categoryName && keyName.startsWith(categoryName))
      .sort((a, b) => {
        const aUp = a.toUpperCase();
        const bUp = b.toUpperCase();
        if (aUp < bUp) return -1;
        if (aUp > bUp) return 1;
        return 0;
      });
  }
}
