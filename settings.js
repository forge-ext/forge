/*
 * This file is part of the Forge Window Manager extension for Gnome 3
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

"use strict";

// Gnome imports
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Dev or Prod mode, see Makefile:debug
var production = true;

const Logger = Me.imports.logger;

/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for @schema, using schema files
 * in extensionsdir/schemas. If @schema is not provided, it is taken from
 * metadata['settings-schema'].
 *
 * Credits:
 *  - Code from convenience.js script by Dash-To-Panel
 *  - See credits also on that file for further derivatives.
 */
function getSettings(schema) {
  let settingsSchema = getSettingsSchema(schema);
  return new Gio.Settings({
    settings_schema: settingsSchema,
  });
}

/**
 * TODO patch this on GNOME 41
 */
function getSettingsSchema(schema) {
  let extension = ExtensionUtils.getCurrentExtension();

  schema = schema || extension.metadata["settings-schema"];

  const GioSSS = Gio.SettingsSchemaSource;

  // Check if this extension was built with "make zip-file", and thus
  // has the schema files in a subfolder
  // otherwise assume that extension has been installed in the
  // same prefix as gnome-shell (and therefore schemas are available
  // in the standard folders)
  let schemaDir = extension.dir.get_child("schemas");
  let schemaSource;
  if (schemaDir.query_exists(null)) {
    schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
  } else {
    schemaSource = GioSSS.get_default();
  }

  let settingsSchema = schemaSource.lookup(schema, true);
  if (!settingsSchema)
    throw new Error(
      "Schema " +
        schema +
        " could not be found for extension " +
        extension.metadata.uuid +
        ". Please check your installation."
    );
  return settingsSchema;
}

var ConfigManager = GObject.registerClass(
  class ConfigManager extends GObject.Object {
    _init() {
      this._confDir = GLib.get_user_config_dir();
    }

    get confDir() {
      return `${this._confDir}/forge`;
    }

    get defaultStylesheetFile() {
      const defaultStylesheet = GLib.build_filenamev([`${Me.dir.get_path()}`, `stylesheet.css`]);

      Logger.trace(`default-stylesheet: ${defaultStylesheet}`);

      const defaultStylesheetFile = Gio.File.new_for_path(defaultStylesheet);
      if (defaultStylesheetFile.query_exists(null)) {
        return defaultStylesheetFile;
      }

      return null;
    }

    get stylesheetFile() {
      const profileSettingPath = `${this.confDir}/stylesheet/forge`;
      const settingFile = "stylesheet.css";
      const defaultSettingFile = this.defaultStylesheetFile;
      return this.loadFile(profileSettingPath, settingFile, defaultSettingFile);
    }

    get defaultWindowConfigFile() {
      const defaultWindowConfig = GLib.build_filenamev([
        `${Me.dir.get_path()}`,
        `config`,
        `windows.json`,
      ]);

      Logger.trace(`default-window-config: ${defaultWindowConfig}`);
      const defaultWindowConfigFile = Gio.File.new_for_path(defaultWindowConfig);

      if (defaultWindowConfigFile.query_exists(null)) {
        return defaultWindowConfigFile;
      }

      return null;
    }

    get windowConfigFile() {
      const profileSettingPath = `${this.confDir}/config`;
      const settingFile = "windows.json";
      const defaultSettingFile = this.defaultWindowConfigFile;
      return this.loadFile(profileSettingPath, settingFile, defaultSettingFile);
    }

    loadFile(path, file, defaultFile) {
      const customSetting = GLib.build_filenamev([path, file]);
      Logger.trace(`custom-setting-file: ${customSetting}`);

      const customSettingFile = Gio.File.new_for_path(customSetting);
      if (customSettingFile.query_exists(null)) {
        return customSettingFile;
      } else {
        const profileCustomSettingDir = Gio.File.new_for_path(path);
        if (!profileCustomSettingDir.query_exists(null)) {
          if (profileCustomSettingDir.make_directory_with_parents(null)) {
            const createdStream = customSettingFile.create(Gio.FileCreateFlags.NONE, null);
            const defaultContents = this.loadFileContents(defaultFile);
            Logger.trace(defaultContents);
            createdStream.write_all(defaultContents, null);
          }
        }
      }

      return null;
    }

    loadFileContents(configFile) {
      let [success, contents] = configFile.load_contents(null);
      if (success) {
        const stringContents = imports.byteArray.toString(contents);
        return stringContents;
      }
    }

    get windowProps() {
      let windowConfigFile = this.windowConfigFile;
      let windowProps = null;
      if (!windowConfigFile || !production) {
        windowConfigFile = this.defaultWindowConfigFile;
      }

      let [success, contents] = windowConfigFile.load_contents(null);
      if (success) {
        const windowConfigContents = imports.byteArray.toString(contents);
        Logger.trace(`${windowConfigContents}`);
        windowProps = JSON.parse(windowConfigContents);
      }
      return windowProps;
    }

    set windowProps(props) {
      let windowConfigFile = this.windowConfigFile;
      if (!windowConfigFile || !production) {
        windowConfigFile = this.defaultWindowConfigFile;
      }

      let windowConfigContents = JSON.stringify(props, null, 4);

      const PERMISSIONS_MODE = 0o744;

      if (
        GLib.mkdir_with_parents(windowConfigFile.get_parent().get_path(), PERMISSIONS_MODE) === 0
      ) {
        let [_, _tag] = windowConfigFile.replace_contents(
          windowConfigContents,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null
        );
      }
    }
  }
);
