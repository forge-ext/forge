// Gnome imports
import GObject from "gi://GObject";

import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { EntryRow, PreferencesPage } from "./widgets.js";

export class WorkspacePage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings }) {
    super({ title: _("Workspace"), icon_name: "shell-overview-symbolic" });
    this.add_group({
      title: _("Update Workspace Settings"),
      description: _(
        "Provide workspace indices to skip. E.g. 0,1. Empty text to disable. Enter to accept"
      ),
      children: [
        new EntryRow({
          title: _("Skip Workspace Tiling"),
          settings,
          bind: "workspace-skip-tile",
        }),
      ],
    });
  }
}
