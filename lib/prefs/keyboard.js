// Gnome imports
import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

// Extension Imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Prefs UI
import { EntryRow, PreferencesPage, RadioRow } from "./widgets.js";

const description = `${_("Syntax")}: &lt;Super&gt;h, &lt;Shift&gt;g, &lt;Shift&gt;&lt;Super&gt;h
${_("Legend")}: &lt;Super&gt; - ${_("Windows  key")}, &lt;Primary&gt; - ${_("Control key")}
${_("Delete text to unset. Press Return key to accept. Focus out to ignore.")} <i>${_(
  "Resets"
)}</i> ${_("to previous value when invalid")}`;

export class KeyboardPage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings }) {
    super({ title: _("Keyboard"), icon_name: "input-keyboard-symbolic" });

    // TODO - calling this each time can introduce performance issues
    // this.refSettings = this.buildRefSettings();

    this.add_group({
      title: _("Update Shortcuts"),
      description,
      children: Object.entries({
        window: "Window Shortcuts",
        workspace: "Workspace Shortcuts",
        con: "Container Shortcuts",
        focus: "Focus Shortcuts",
        prefs: "Other Shortcuts",
      }).map(([prefix, gettextKey]) =>
        KeyboardPage.makeKeygroupExpander(prefix, gettextKey, settings)
      ),
    });

    this.add_group({
      title: _("Drag-Drop Tiling Modifier Key Options"),
      description: `<i>${_(
        "Change the modifier for <b>tiling</b> windows via mouse/drag-drop"
      )}</i> ${_("Select <i>None</i> to <u>always tile immediately</u> by default")}`,
      children: [
        new RadioRow({
          title: _("Tile Modifier"),
          settings,
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
                  // TODO: Logger is on the instance so far, so will need a
                  // refactor
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

  // TODO move this to keybindings.js or settings.js
  buildRefSettings() {
    let refSettings = {};
    // List of schemas that might have conflicts with the keybindings for Forge
    let referenceSchemas = [
      "org.gnome.desktop.wm.keybindings",
      "org.gnome.mutter.wayland.keybindings",
      "org.gnome.shell.keybindings",
      "org.gnome.shell.extensions.pop-shell",
      "com.gexperts.Tilix.Keybindings",
      "org.gnome.mutter.keybindings",
    ];

    referenceSchemas.forEach((schema) => {
      let refSetting = this.getSettings();
      refSettings[schema] = refSetting;
    });

    return refSettings;
  }
}
