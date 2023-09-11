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

    try {
      theme.unload_stylesheet(defaultStylesheetFile);
      theme.unload_stylesheet(stylesheetFile);
      if (production) {
        theme.load_stylesheet(stylesheetFile);
        this.stylesheet = stylesheetFile;
      } else {
        theme.load_stylesheet(defaultStylesheetFile);
        this.stylesheet = defaultStylesheetFile;
      }
    } catch (e) {
      Logger.error(`${uuid} - ${e}`);
      return;
    }
  }
}
