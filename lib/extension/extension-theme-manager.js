import GObject from "gi://GObject";

import St from "gi://St";

import { ThemeManagerBase } from "../shared/theme.js";
import { Logger } from "../shared/logger.js";
import { production } from "../shared/settings.js";

export class ExtensionThemeManager extends ThemeManagerBase {
  static {
    GObject.registerClass(this);
  }

  /**
   * @param {import("../../extension.js").default} extension
   */
  constructor(extension) {
    super(extension);
    this.metadata = extension.metadata;
  }

  reloadStylesheet() {
    const uuid = this.metadata.uuid;
    const stylesheetFile = this.configMgr.stylesheetFile;
    const defaultStylesheetFile = this.configMgr.defaultStylesheetFile;
    let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();

    const stylesheetsToUnload = new Map();
    for (const file of [this.stylesheet, defaultStylesheetFile, stylesheetFile]) {
      if (file) stylesheetsToUnload.set(file.get_path(), file);
    }
    for (const file of stylesheetsToUnload.values()) {
      try {
        theme.unload_stylesheet(file);
      } catch (e) {
        Logger.warn(`${uuid} - unable to unload stylesheet ${file.get_path()}: ${e}`);
      }
    }

    // If the user config file could not be created or read, still load Forge's
    // bundled stylesheet rather than passing null to Mutter and starting with
    // no extension styling.
    const stylesheetToLoad = production
      ? stylesheetFile || defaultStylesheetFile
      : defaultStylesheetFile;
    if (!stylesheetToLoad) {
      this.stylesheet = null;
      Logger.error(`${uuid} - no stylesheet is available to load`);
      return;
    }

    try {
      theme.load_stylesheet(stylesheetToLoad);
      this.stylesheet = stylesheetToLoad;
    } catch (e) {
      Logger.error(`${uuid} - ${e}`);
    }
  }
}
