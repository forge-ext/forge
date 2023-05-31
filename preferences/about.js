"use strict";

// Gnome imports
const { Adw, GObject, Gtk } = imports.gi;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const _ = imports.gettext.domain(Me.metadata.uuid).gettext;
const { developers } = Me.imports.preferences.metadata;
const gnomeVersion = imports.misc.config.PACKAGE_VERSION;

// Application imports
const Msgs = Me.imports.messages;

function makeAboutButton(parent) {
  const button = new Gtk.Button({
    icon_name: "help-about-symbolic",
    tooltip_text: _("About"),
    valign: Gtk.Align.CENTER,
  });
  button.connect("clicked", () => showAboutWindow(parent));
  return button;
}

function showAboutWindow(parent) {
  const { version: v, description: comments } = Me.metadata;
  const version = `${gnomeVersion}-${v.toString()}`;
  const abt = new Adw.AboutWindow({
    ...(parent && { transient_for: parent }),
    // TODO: fetch these from github at build time
    application_name: _("Forge"),
    application_icon: "forge-logo-symbolic",
    version,
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
