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

  loadDefaultWindowConfigContents() {
    const defaultSettingFile = this.defaultWindowConfigFile;
    if (defaultSettingFile) {
      try {
        const contents = this.loadFileContents(defaultSettingFile);
        if (contents) {
          const props = JSON.parse(contents);
          if (Array.isArray(props?.overrides)) return props;
          throw new Error("no overrides list");
        }
      } catch (e) {
        Logger.error(`Failed to load default window config ${defaultSettingFile.get_path()}: ${e}`);
      }
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
    if (customSettingFile.query_exists(null)) return customSettingFile;

    try {
      const profileCustomSettingDir = Gio.File.new_for_path(path);
      if (!profileCustomSettingDir.query_exists(null)) {
        profileCustomSettingDir.make_directory_with_parents(null);
      }

      const defaultContents = defaultFile ? (this.loadFileContents(defaultFile) ?? "") : "";
      Logger.trace(defaultContents);
      if (!GLib.file_set_contents(customSettingFile.get_path(), defaultContents)) {
        throw new Error(`GLib.file_set_contents failed for ${customSetting}`);
      }
      return customSettingFile;
    } catch (e) {
      // Another process may have created the file while we were setting it up.
      if (customSettingFile.query_exists(null)) return customSettingFile;
      Logger.error(`Failed to create custom setting file ${customSetting}: ${e}`);
    }

    return null;
  }

  loadFileContents(configFile) {
    if (!configFile) return null;
    let [success, contents] = configFile.load_contents(null);
    if (success) {
      const stringContents = imports.byteArray.toString(contents);
      return stringContents;
    }
  }

  get windowProps() {
    let windowConfigFile = this.windowConfigFile;
    let windowProps = null;
    // if (!windowConfigFile || !production) {
    if (!windowConfigFile) {
      windowConfigFile = this.defaultWindowConfigFile;
    }
    if (!windowConfigFile) return this.loadDefaultWindowConfigContents() ?? { overrides: [] };

    let windowConfigContents;
    try {
      const [success, contents] = windowConfigFile.load_contents(null);
      if (!success) throw new Error("file could not be read");
      windowConfigContents = imports.byteArray.toString(contents);
    } catch (e) {
      console.warn(
        `Forge: can't read ${windowConfigFile.get_path()} (${e.message}); ` +
          "using the default window rules"
      );
      return this.loadDefaultWindowConfigContents() ?? { overrides: [] };
    }

    Logger.trace(`${windowConfigContents}`);
    try {
      windowProps = JSON.parse(windowConfigContents);
      if (!Array.isArray(windowProps?.overrides)) throw new Error("no overrides list");
    } catch (e) {
      // An empty or broken file mustn't stop Forge from starting (#415): use the default
      // rules. Forge rewrites the file on the next change of the rules (e.g. a window closing),
      // so keep a copy of it first.
      let backup = "";
      if (windowConfigContents.trim()) {
        try {
          const backupFile = Gio.File.new_for_path(`${windowConfigFile.get_path()}.bak`);
          windowConfigFile.copy(backupFile, Gio.FileCopyFlags.OVERWRITE, null, null);
          backup = `; it was copied to ${backupFile.get_path()}`;
        } catch (copyError) {
          backup = `; it couldn't be copied (${copyError.message})`;
        }
      }
      console.warn(
        `Forge: ${windowConfigFile.get_path()} is not valid (${e.message}); ` +
          `using the default window rules${backup}`
      );
      windowProps = this.loadDefaultWindowConfigContents() ?? { overrides: [] };
    }
    return windowProps;
  }

  set windowProps(props) {
    let windowConfigFile = this.windowConfigFile;
    if (!windowConfigFile) {
      console.warn("Forge: cannot save windows.json in the user config directory");
      return;
    }

    let windowConfigContents = JSON.stringify(props, null, 4);

    const PERMISSIONS_MODE = 0o744;

    try {
      const configDir = windowConfigFile.get_parent().get_path();
      if (GLib.mkdir_with_parents(configDir, PERMISSIONS_MODE) !== 0) {
        throw new Error(`could not create ${configDir}`);
      }
      // GLib.file_set_contents() preserves the original on failure (#415).
      if (!GLib.file_set_contents(windowConfigFile.get_path(), windowConfigContents)) {
        throw new Error(`could not write ${windowConfigFile.get_path()}`);
      }
    } catch (e) {
      Logger.error(`Failed to save window config ${windowConfigFile.get_path()}: ${e}`);
    }
  }
}
