import GObject from "gi://GObject";

import { ThemeManagerBase } from "../shared/theme.js";

export class PrefsThemeManager extends ThemeManagerBase {
  static {
    GObject.registerClass(this);
  }

  reloadStylesheet() {
    this.settings.set_string("css-updated", Date.now().toString());
  }
}
