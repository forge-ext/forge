// Gnome imports
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

import { developers } from "./metadata.js";
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";

function showAboutWindow(parent, { version, description: comments }) {
  const abt = new Adw.AboutWindow({
    ...(parent && { transient_for: parent }),
    // TODO: fetch these from github at build time
    application_name: _("Forge"),
    application_icon: "forge-logo-symbolic",
    version: `${PACKAGE_VERSION}-${version.toString()}`,
    copyright: `© 2021-${new Date().getFullYear()} jmmaranan`,
    issue_url: "https://github.com/forge-ext/forge/issues/new",
    license_type: Gtk.License.GPL_3_0,
    website: "https://github.com/forge-ext/forge",
    developers,
    comments,
    designers: [],
    translator_credits: _("translator-credits"),
  });
  abt.present();
}

export function makeAboutButton(parent, metadata) {
  const button = new Gtk.Button({
    icon_name: "help-about-symbolic",
    tooltip_text: _("About"),
    valign: Gtk.Align.CENTER,
  });
  button.connect("clicked", () => showAboutWindow(parent, metadata));
  return button;
}
