"use strict";

const { Adw, GObject, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { EntryRow, PreferencesPage, RadioRow, SwitchRow } = Me.imports.widgets;

const _ = imports.gettext.domain(Me.metadata.uuid).gettext;

// Application imports
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;
const Settings = Me.imports.settings;

var KeyboardPage = GObject.registerClass(class KeyboardPage extends PreferencesPage {
  _init({ settings }) {
    super._init({ title: _('Keyboard'), icon_name: 'input-keyboard-symbolic' });

    const description = `${_('Syntax')}: &lt;Super&gt;h, &lt;Shift&gt;g, &lt;Shift&gt;&lt;Super&gt;h
${_('Legend')}: &lt;Super&gt; - ${_('Windows  key')}, &lt;Primary&gt; - ${_('Control key')}
${Msgs.prefs_keyboard_update_keys_instructions_text} <i>${Msgs.prefs_keyboard_update_keys_resets_label}</i> ${Msgs.prefs_keyboard_update_keys_resets_sub_1_label}`;

    // TODO - calling this each time can introduce performance issues
    // this.refSettings = this.buildRefSettings();

    this.add_group({
      title: _('Update Shortcuts'),
      description,
      children: Object.entries({
        window: 'Window Shortcuts',
        workspace: 'Workspace Shortcuts',
        con: 'Container Shortcuts',
        focus: 'Focus Shortcuts',
        prefs: 'Other Shortcuts',
      }).map(([prefix, gettextKey]) => KeyboardPage.makeKeygroupExpander(prefix, gettextKey, settings)),
    });

    this.add_group({
      title: Msgs.prefs_keyboard_other_mod_mask_header,
      description: `<i>${Msgs.prefs_keyboard_other_mod_mask_informational1}</i> ${Msgs.prefs_keyboard_other_mod_mask_informational2}`,
      children: [
        new RadioRow({
          title: Msgs.prefs_keyboard_mod_mask_tile_label,
          settings,
          bind: 'mod-mask-mouse-tile',
          options: {
            Super: _('Super'),
            Ctrl: _('Ctrl'),
            Alt: _('Alt'),
            None: _('None'),
          }
        })
      ]
    });
  }

  static makeKeygroupExpander(prefix, gettextKey, settings) {
    const expander = new Adw.ExpanderRow({ title: _(gettextKey) });
    KeyboardPage.createKeyList(settings, prefix).forEach(key =>
      expander.add_row(new EntryRow({
        title: key,
        settings,
        bind: key,
        map: {
          from(settings, bind) {
            return settings.get_strv(bind).join(',');
          },
          to(settings, bind, value) {
            const mappings = value.split(',').map(x => {
              const [, key, mods] = Gtk.accelerator_parse(x);
              return Gtk.accelerator_valid(key, mods) && Gtk.accelerator_name(key, mods);
            });
            if (mappings.every(x => !!x)) {
              Logger.info('setting', bind, 'to', mappings);
              settings.set_strv(bind, mappings)
            }
          }
        }
      })))
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
      let refSetting = Settings.getSettings(schema);
      refSettings[schema] = refSetting;
    });

    return refSettings;
  }
});
