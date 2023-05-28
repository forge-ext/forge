/** @license (c) aylur. GPL v3 */

'use strict';

const { Adw, Gio, Gtk, GObject, Gdk, GdkPixbuf } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Logger = Me.imports.logger;

const _ = imports.gettext.domain(Me.metadata.uuid).gettext;

var PreferencesPage = GObject.registerClass(class PreferencesPage extends Adw.PreferencesPage {
  add_group({ title, description = '', children, header_suffix }) {
    const group = new Adw.PreferencesGroup({ title, description });
    for (const child of children) group.add(child)
    if (header_suffix) group.set_header_suffix(header_suffix);
    this.add(group);
  }
})

var SwitchRow = GObject.registerClass(class SwitchRow extends Adw.ActionRow {
  _init({ title, settings, bind, subtitle = '', experimental }){
    super._init({ title, subtitle });
    const gswitch = new Gtk.Switch({
      active: settings.get_boolean(bind),
      valign: Gtk.Align.CENTER,
    });
    settings.bind(bind, gswitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    if (experimental) {
      const icon = new Gtk.Image({ icon_name: 'bug-symbolic' });
            icon.set_tooltip_markup(_("<b>CAUTION</b>: Enabling this setting can lead to bugs or cause the shell to crash"));
      this.add_suffix(icon);
    }
    this.add_suffix(gswitch);
    this.activatable_widget = gswitch;
  }
});

var ColorRow = GObject.registerClass(class ColorRow extends Adw.ActionRow {
  _init({ title, init, onChange, subtitle = '' }){
    super._init({ title, subtitle });
    let rgba = new Gdk.RGBA();
        rgba.parse(init);
    this.colorButton = new Gtk.ColorButton({ rgba, use_alpha: true, valign: Gtk.Align.CENTER });
    this.colorButton.connect('color-set', () => {
      onChange(this.colorButton.get_rgba().to_string());
    });
    this.add_suffix(this.colorButton);
    this.activatable_widget = this.colorButton;
  }
});

var SpinButtonRow = GObject.registerClass(class SpinButtonRow extends Adw.ActionRow {
  _init({
    title,
    range: [low, high, step],
    subtitle = '',
    init,
    onChange,
    settings,
    bind,
  }){
      super._init({ title, subtitle });
      const gspin = Gtk.SpinButton.new_with_range(low, high, step);
            gspin.valign = Gtk.Align.CENTER;
      if (bind && settings) {
        settings.bind(bind, gspin, 'value', Gio.SettingsBindFlags.DEFAULT)
      } else {
        gspin.value = init,
        gspin.connect('value-changed',(widget) => {
          onChange(widget.value);
        });
      }
      this.add_suffix(gspin);
      this.activatable_widget = gspin;
  }
});

var DropDownRow = GObject.registerClass(class DropDownRow extends Adw.ActionRow {
  _init({ title, settings, bind, items, subtitle = '' }){
    super._init({ title, subtitle });
    const model = new Gtk.StringList();
    const type = settings.get_value(bind)?.get_type() ?? '?'
    /**
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
    const get = x => {
      switch(type) {
        case 'b': return settings.get_boolean(x);
        case 'y': return settings.get_byte(x);
        case 'n': return settings.get_int16(x);
        case 'q': return settings.get_uint16(x);
        case 'i': return settings.get_int32(x);
        case 'u': return settings.get_uint(x);
        case 'x': return settings.get_int64(x);
        case 't': return settings.get_uint64(x);
        case 'd': return settings.get_double(x);
        case 's': return settings.get_string(x);
        case 'o': return settings.get_objv(x);
      }
    }

    const set = (x, y) => {
      switch(type) {
        case 'b': return settings.set_boolean(x, y);
        case 'y': return settings.set_byte(x, y);
        case 'n': return settings.set_int16(x, y);
        case 'q': return settings.set_uint16(x, y);
        case 'i': return settings.set_int32(x, y);
        case 'u': return settings.set_uint(x, y);
        case 'x': return settings.set_int64(x, y);
        case 't': return settings.set_uint64(x, y);
        case 'd': return settings.set_double(x, y);
        case 's': return settings.set_string(x, y);
        case 'o': return settings.set_objv(x, y);
      }
    }

    let selected = 0;
    for (const { name, id } of items) {
      model.append(name)
      if (get() === id)
        selected = items.findIndex(x => x.id === id);
    }
    const glist = new Gtk.DropDown({ valign: Gtk.Align.CENTER, model, selected });
          glist.connect('notify::selected', (dropdown) => {
            Logger.debug(dropdown.selected, glist.get_selected())
            const { id } = items[glist.get_selected()];
            Logger.debug(id)
            set(bind, id);
          });
    this.add_suffix(glist);
    this.activatable_widget = glist;
    this.add_suffix(new ResetButton({ settings, bind, onReset: () => glist.selected = 0 }));
  }
});

var ResetButton = GObject.registerClass(class ResetButton extends Gtk.Button {
  _init({ settings, bind, onReset }) {
    super._init({
      icon_name: "edit-clear-symbolic",
      tooltip_text: _("Reset"),
      valign: Gtk.Align.CENTER,
    });
    this.connect("clicked", () => {
      settings?.reset(bind);
      onReset?.();
    });
  }
});

var EntryRow = GObject.registerClass(class EntryRow extends Adw.EntryRow {
  _init({ title, settings, bind, map }){
    super._init({ title });
    this.connect('changed', () => {
      const text = this.get_text();
      if (typeof text === 'string')
        if (map) {
          map.to(settings, bind, text)
        } else {
          settings.set_string(bind, text);
        }
    });
    const current = map ? map.from(settings, bind) : settings.get_string(bind);
    this.set_text(current ?? '');
    this.add_suffix(new ResetButton({
      settings,
      bind,
      onReset: () => {
        this.set_text((map ? map.from(settings, bind) : settings.get_string(bind)) ?? '');
      },
    }));
  }
});

var RadioRow = GObject.registerClass(class RadioRow extends Adw.ActionRow {
  static orientation = Gtk.Orientation.HORIZONTAL;
  static spacing = 10;
  static valign = Gtk.Align.CENTER;
  _init({ title, subtitle = '',  settings, bind, options }) {
    super._init({ title, subtitle });
    const current = settings.get_string(bind);
    const labels = Object.fromEntries(Object.entries(options).map(([k, v]) => [v, k]));
    const { orientation, spacing, valign } = RadioRow;
    const hbox = new Gtk.Box({ orientation, spacing, valign });
    let group;
    for (const [key, label] of Object.entries(options)) {
      const toggle = new Gtk.ToggleButton({ label, ...group && { group } });
      group ||= toggle;
      toggle.active = key === current;
      toggle.connect('clicked', () => {
        if (toggle.active) {
          settings.set_string(bind, labels[toggle.label]);
        }
      });
      hbox.append(toggle);
    };
    this.add_suffix(hbox);
  }
});
