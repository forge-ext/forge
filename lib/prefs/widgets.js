/** @license (c) aylur. GPL v3 */

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

// GNOME imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Shared state
import { Logger } from "../shared/logger.js";

export class PreferencesPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  add_group({ title, description = "", children, header_suffix = "" }) {
    const group = new Adw.PreferencesGroup({ title, description });
    for (const child of children) group.add(child);
    if (header_suffix) group.set_header_suffix(header_suffix);
    this.add(group);
  }
}

export class SwitchRow extends Adw.ActionRow {
  static {
    GObject.registerClass(this);
  }

  constructor({ title, settings, bind, subtitle = "", experimental = false }) {
    super({ title, subtitle });
    const gswitch = new Gtk.Switch({
      active: settings.get_boolean(bind),
      valign: Gtk.Align.CENTER,
    });
    settings.bind(bind, gswitch, "active", Gio.SettingsBindFlags.DEFAULT);
    if (experimental) {
      const icon = new Gtk.Image({ icon_name: "bug-symbolic" });
      icon.set_tooltip_markup(
        _("<b>CAUTION</b>: Enabling this setting can lead to bugs or cause the shell to crash")
      );
      this.add_suffix(icon);
    }
    this.add_suffix(gswitch);
    this.activatable_widget = gswitch;
  }
}

export class ColorRow extends Adw.ActionRow {
  static {
    GObject.registerClass(this);
  }

  constructor({ title, init, onChange, subtitle = "" }) {
    super({ title, subtitle });
    let rgba = new Gdk.RGBA();
    rgba.parse(init);
    this.colorButton = new Gtk.ColorButton({ rgba, use_alpha: true, valign: Gtk.Align.CENTER });
    this.colorButton.connect("color-set", () => {
      onChange(this.colorButton.get_rgba().to_string());
    });
    this.add_suffix(this.colorButton);
    this.activatable_widget = this.colorButton;
  }
}

export class SpinButtonRow extends Adw.ActionRow {
  static {
    GObject.registerClass(this);
  }

  constructor({
    title,
    range: [low, high, step],
    subtitle = "",
    init = undefined,
    onChange = undefined,
    max_width_chars = undefined,
    max_length = undefined,
    width_chars = undefined,
    xalign = undefined,
    settings = undefined,
    bind = undefined,
  }) {
    super({ title, subtitle });
    const gspin = Gtk.SpinButton.new_with_range(low, high, step);
    gspin.valign = Gtk.Align.CENTER;
    if (bind && settings) {
      settings.bind(bind, gspin, "value", Gio.SettingsBindFlags.DEFAULT);
    } else if (init) {
      gspin.value = init;
      gspin.connect("value-changed", (widget) => {
        onChange?.(widget.value);
      });
    }
    this.add_suffix(gspin);
    this.activatable_widget = gspin;
  }
}

export class DropDownRow extends Adw.ActionRow {
  static {
    GObject.registerClass(this);
  }

  /**
   * @type {string}
   * Name of the gsetting key to bind to
   */
  bind;

  /**
   * @type {'b'|'y'|'n'|'q'|'i'|'u'|'x'|'t'|'h'|'d'|'s'|'o'|'g'|'?'|'a'|'m'}
   * - b: the type string of G_VARIANT_TYPE_BOOLEAN; a boolean value.
   * - y: the type string of G_VARIANT_TYPE_BYTE; a byte.
   * - n: the type string of G_VARIANT_TYPE_INT16; a signed 16 bit integer.
   * - q: the type string of G_VARIANT_TYPE_UINT16; an unsigned 16 bit integer.
   * - i: the type string of G_VARIANT_TYPE_INT32; a signed 32 bit integer.
   * - u: the type string of G_VARIANT_TYPE_UINT32; an unsigned 32 bit integer.
   * - x: the type string of G_VARIANT_TYPE_INT64; a signed 64 bit integer.
   * - t: the type string of G_VARIANT_TYPE_UINT64; an unsigned 64 bit integer.
   * - h: the type string of G_VARIANT_TYPE_HANDLE; a signed 32 bit value that, by convention, is used as an index into an array of file descriptors that are sent alongside a D-Bus message.
   * - d: the type string of G_VARIANT_TYPE_DOUBLE; a double precision floating point value.
   * - s: the type string of G_VARIANT_TYPE_STRING; a string.
   * - o: the type string of G_VARIANT_TYPE_OBJECT_PATH; a string in the form of a D-Bus object path.
   * - g: the type string of G_VARIANT_TYPE_SIGNATURE; a string in the form of a D-Bus type signature.
   * - ?: the type string of G_VARIANT_TYPE_BASIC; an indefinite type that is a supertype of any of the basic types.
   * - v: the type string of G_VARIANT_TYPE_VARIANT; a container type that contain any other type of value.
   * - a: used as a prefix on another type string to mean an array of that type; the type string “ai”, for example, is the type of an array of signed 32-bit integers.
   * - m: used as a prefix on another type string to mean a “maybe”, or “nullable”, version of that type; the type string “ms”, for example, is the type of a value that maybe contains a string, or maybe contains nothing.
   */
  type;

  selected = 0;

  /** @type {{name: string; id: string}[]} */
  items;

  model = new Gtk.StringList();

  /** @type {Gtk.DropDown} */
  dropdown;

  constructor({ title, settings, bind, items, subtitle = "", type }) {
    super({ title, subtitle });
    this.settings = settings;
    this.items = items;
    this.bind = bind;
    this.type = type ?? this.settings.get_value(bind)?.get_type() ?? "?";
    this.#build();
    this.add_suffix(this.dropdown);
    this.add_suffix(new ResetButton({ settings, bind, onReset: () => this.reset() }));
  }

  reset() {
    this.dropdown.selected = 0;
    this.selected = 0;
  }

  #build() {
    for (const { name, id } of this.items) {
      this.model.append(name);
      if (this.#get() === id) this.selected = this.items.findIndex((x) => x.id === id);
    }
    const { model, selected } = this;
    this.dropdown = new Gtk.DropDown({ valign: Gtk.Align.CENTER, model, selected });
    this.dropdown.connect("notify::selected", () => this.#onSelected());
    this.activatable_widget = this.dropdown;
  }

  #onSelected() {
    this.selected = this.dropdown.selected;
    const { id } = this.items[this.selected];
    Logger.debug("setting", id, this.selected);
    this.#set(this.bind, id);
  }

  static #settingsTypes = {
    b: "boolean",
    y: "byte",
    n: "int16",
    q: "uint16",
    i: "int32",
    u: "uint",
    x: "int64",
    t: "uint64",
    d: "double",
    s: "string",
    o: "objv",
  };

  /**
   * @param {string} x
   */
  #get(x = this.bind) {
    const methodName = `get_${DropDownRow.#settingsTypes[this.type] ?? "value"}`;
    return this.settings[methodName]?.(x);
  }

  /**
   * @param {string} x
   * @param {unknown} y
   */
  #set(x, y) {
    const methodName = `set_${DropDownRow.#settingsTypes[this.type] ?? "value"}`;
    Logger.log(`${methodName}(${x}, ${y})`);
    return this.settings[methodName]?.(x, y);
  }
}

export class ResetButton extends Gtk.Button {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings = undefined, bind = undefined, onReset }) {
    super({
      icon_name: "edit-clear-symbolic",
      tooltip_text: _("Reset"),
      valign: Gtk.Align.CENTER,
    });
    this.connect("clicked", () => {
      settings?.reset(bind);
      onReset?.();
    });
  }
}

export class EntryRow extends Adw.EntryRow {
  static {
    GObject.registerClass(this);
  }

  constructor({ title, settings, bind, map }) {
    super({ title });
    this.connect("changed", () => {
      const text = this.get_text();
      if (typeof text === "string")
        if (map) {
          map.to(settings, bind, text);
        } else {
          settings.set_string(bind, text);
        }
    });
    const current = map ? map.from(settings, bind) : settings.get_string(bind);
    this.set_text(current ?? "");
    this.add_suffix(
      new ResetButton({
        settings,
        bind,
        onReset: () => {
          this.set_text((map ? map.from(settings, bind) : settings.get_string(bind)) ?? "");
        },
      })
    );
  }
}

export class RadioRow extends Adw.ActionRow {
  static {
    GObject.registerClass(this);
  }

  static orientation = Gtk.Orientation.HORIZONTAL;

  static spacing = 10;

  static valign = Gtk.Align.CENTER;

  constructor({ title, subtitle = "", settings, bind, options }) {
    super({ title, subtitle });
    const current = settings.get_string(bind);
    const labels = Object.fromEntries(Object.entries(options).map(([k, v]) => [v, k]));
    const { orientation, spacing, valign } = RadioRow;
    const hbox = new Gtk.Box({ orientation, spacing, valign });
    let group;
    for (const [key, label] of Object.entries(options)) {
      const toggle = new Gtk.ToggleButton({ label, ...(group && { group }) });
      group ||= toggle;
      toggle.active = key === current;
      toggle.connect("clicked", () => {
        if (toggle.active) {
          settings.set_string(bind, labels[toggle.label]);
        }
      });
      hbox.append(toggle);
    }
    this.add_suffix(hbox);
  }
}
