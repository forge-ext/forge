"use strict";

// Gnome imports
const { Adw, GObject } = imports.gi;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const _ = imports.gettext.domain(Me.metadata.uuid).gettext;

const { EntryRow, PreferencesPage } = Me.imports.widgets;

var WorkspacePage = GObject.registerClass(class WorkspacePage extends PreferencesPage {
  _init({ settings }) {
    super._init({ title: _('Workspace'), icon_name: 'shell-overview-symbolic' });
    this.add_group({
      title: _("Update Workspace Settings"),
      description: _("Provide workspace indices to skip. E.g. 0,1. Empty text to disable. Enter to accept"),
      children: [
        new EntryRow({
          title: _("Skip Workspace Tiling"),
          settings,
          bind: 'workspace-skip-tile',
        }),
      ]
    });
  }
});

