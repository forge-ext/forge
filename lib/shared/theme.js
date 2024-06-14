/*
 * This file is part of the Forge extension for GNOME
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

// Application imports
import { stringify, parse } from "../css/index.js";
import { production } from "./settings.js";

export class ThemeManagerBase extends GObject.Object {
  static {
    GObject.registerClass(this);
  }

  constructor({ configMgr, settings }) {
    super();
    this.configMgr = configMgr;
    this.settings = settings;
    this._importCss();
    this.defaultPalette = this.getDefaultPalette();

    // A random number to denote an update on the css, usually the possible next version
    // in extensions.gnome.org
    // TODO: need to research the most effective way to bring in CSS updates
    //  since the schema css-last-update might be triggered when there is a
    //  code change on the schema unrelated to css updates.
    //  For now tagging works. See @this.patchCss() and @this._needUpdate().
    this.cssTag = 37;

    // TODO: should the patchCss() call be done here?
  }

  /**
   * @param {string} value
   */
  addPx(value) {
    return `${value}px`;
  }

  /**
   * @param {string} value
   */
  removePx(value) {
    return value.replace("px", "");
  }

  getDefaultPalette() {
    return {
      tiled: this.getDefaults("tiled"),
      split: this.getDefaults("split"),
      floated: this.getDefaults("floated"),
      stacked: this.getDefaults("stacked"),
      tabbed: this.getDefaults("tabbed"),
    };
  }

  /**
   * The scheme name is in between the CSS selector name
   * E.g. window-tiled-color should return `tiled`
   * @param {string} selector
   */
  getColorSchemeBySelector(selector) {
    if (!selector.includes("-")) return null;
    let firstDash = selector.indexOf("-");
    let secondDash = selector.indexOf("-", firstDash + 1);
    const scheme = selector.substr(firstDash + 1, secondDash - firstDash - 1);
    return scheme;
  }

  /**
   * @param {string} color
   */
  getDefaults(color) {
    return {
      color: this.getCssProperty(`.${color}`, "color").value,
      "border-width": this.removePx(this.getCssProperty(`.${color}`, "border-width").value),
      opacity: this.getCssProperty(`.${color}`, "opacity").value,
    };
  }

  /**
   * @param {any} selector
   */
  getCssRule(selector) {
    if (this.cssAst) {
      const rules = this.cssAst.stylesheet.rules;
      // return only the first match, Forge CSS authors should make sure class names are unique :)
      const matchRules = rules.filter((r) => r.selectors.filter((s) => s === selector).length > 0);
      return matchRules.length > 0 ? matchRules[0] : {};
    }
    return {};
  }

  /**
   * @param {string} selector
   * @param {string} propertyName
   */
  getCssProperty(selector, propertyName) {
    const cssRule = this.getCssRule(selector);

    if (cssRule) {
      const matchDeclarations = cssRule.declarations.filter((d) => d.property === propertyName);
      return matchDeclarations.length > 0 ? matchDeclarations[0] : {};
    }

    return {};
  }

  /**
   * @param {string} selector
   * @param {string} propertyName
   * @param {string} propertyValue
   */
  setCssProperty(selector, propertyName, propertyValue) {
    const cssProperty = this.getCssProperty(selector, propertyName);
    if (cssProperty) {
      cssProperty.value = propertyValue;
      this._updateCss();
      return true;
    }
    return false;
  }

  /**
   * Returns the AST for stylesheet.css
   */
  _importCss() {
    let cssFile = this.configMgr.stylesheetFile;
    if (!cssFile || !production) {
      cssFile = this.configMgr.defaultStylesheetFile;
    }

    let [success, contents] = cssFile.load_contents(null);
    if (success) {
      const cssContents = new TextDecoder().decode(contents);
      this.cssAst = parse(cssContents);
    }
  }

  /**
   * Writes the AST back to stylesheet.css and reloads the theme
   */
  _updateCss() {
    if (!this.cssAst) {
      return;
    }

    let cssFile = this.configMgr.stylesheetFile;
    if (!cssFile || !production) {
      cssFile = this.configMgr.defaultStylesheetFile;
    }

    const cssContents = stringify(this.cssAst);
    const PERMISSIONS_MODE = 0o744;

    if (GLib.mkdir_with_parents(cssFile.get_parent().get_path(), PERMISSIONS_MODE) === 0) {
      let [success, _tag] = cssFile.replace_contents(
        cssContents,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
      if (success) {
        this.reloadStylesheet();
      }
    }
  }

  /**
   * BREAKING: Patches the CSS by overriding the $HOME/.config stylesheet
   * at the moment.
   *
   * TODO: work needed to consolidate the existing config stylesheet and
   * when the extension default stylesheet gets an update.
   */
  patchCss() {
    if (this._needUpdate()) {
      let originalCss = this.configMgr.defaultStylesheetFile;
      let configCss = this.configMgr.stylesheetFile;
      let copyConfigCss = Gio.File.new_for_path(this.configMgr.stylesheetFileName + ".bak");
      let backupFine = configCss.copy(copyConfigCss, Gio.FileCopyFlags.OVERWRITE, null, null);
      let copyFine = originalCss.copy(configCss, Gio.FileCopyFlags.OVERWRITE, null, null);
      if (backupFine && copyFine) {
        this.settings.set_uint("css-last-update", this.cssTag);
        return true;
      }
    }
    return false;
  }

  /**
   * Credits: ExtensionSystem.js:_callExtensionEnable()
   */
  reloadStylesheet() {
    throw new Error("Must implement reloadStylesheet");
  }

  _needUpdate() {
    let cssTag = this.cssTag;
    return this.settings.get_uint("css-last-update") !== cssTag;
  }
}

/**
 * Credits: Color Space conversion functions from CSS Tricks
 * https://css-tricks.com/converting-color-spaces-in-javascript/
 */
export function RGBAToHexA(rgba) {
  let sep = rgba.indexOf(",") > -1 ? "," : " ";
  rgba = rgba.substr(5).split(")")[0].split(sep);

  // Strip the slash if using space-separated syntax
  if (rgba.indexOf("/") > -1) rgba.splice(3, 1);

  for (let R in rgba) {
    let r = rgba[R];
    if (r.indexOf("%") > -1) {
      let p = r.substr(0, r.length - 1) / 100;

      if (R < 3) {
        rgba[R] = Math.round(p * 255);
      } else {
        rgba[R] = p;
      }
    }
  }
  let r = (+rgba[0]).toString(16),
    g = (+rgba[1]).toString(16),
    b = (+rgba[2]).toString(16),
    a = Math.round(+rgba[3] * 255).toString(16);

  if (r.length == 1) r = "0" + r;
  if (g.length == 1) g = "0" + g;
  if (b.length == 1) b = "0" + b;
  if (a.length == 1) a = "0" + a;

  return "#" + r + g + b + a;
}

export function hexAToRGBA(h) {
  let r = 0,
    g = 0,
    b = 0,
    a = 1;

  if (h.length == 5) {
    r = "0x" + h[1] + h[1];
    g = "0x" + h[2] + h[2];
    b = "0x" + h[3] + h[3];
    a = "0x" + h[4] + h[4];
  } else if (h.length == 9) {
    r = "0x" + h[1] + h[2];
    g = "0x" + h[3] + h[4];
    b = "0x" + h[5] + h[6];
    a = "0x" + h[7] + h[8];
  }
  a = +(a / 255).toFixed(3);

  return "rgba(" + +r + "," + +g + "," + +b + "," + a + ")";
}
