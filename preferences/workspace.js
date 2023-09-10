// Gnome imports
import GObject from "gi://GObject";

import { EntryRow, PreferencesPage } from "../widgets.js";

import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

var WorkspacePage = GObject.registerClass(
  class WorkspacePage extends PreferencesPage {
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
);
