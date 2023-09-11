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

// Gnome imports
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { Logger } from "./logger.js";

// Dev or Prod mode, see Makefile:debug
export const production = true;

export class ConfigManager extends GObject.Object {
  static {
    GObject.registerClass(this);
  }

  #confDir = GLib.get_user_config_dir();

  constructor({ dir }) {
    super();
    this.extensionPath = dir.get_path();
  }

  get confDir() {
    return `${this.#confDir}/forge`;
  }

  get defaultStylesheetFile() {
    const defaultStylesheet = GLib.build_filenamev([this.extensionPath, `stylesheet.css`]);

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
      this.extensionPath,
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

    if (GLib.mkdir_with_parents(windowConfigFile.get_parent().get_path(), PERMISSIONS_MODE) === 0) {
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
