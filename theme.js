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

"use strict";

// Gnome imports
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Css = Me.imports.css;
const Logger = Me.imports.logger;

var ThemeManager = GObject.registerClass(
    class ThemeManager extends GObject.Object {
        _init(settings, configMgr, options = { prefsMode: false }) {
            this.extensionPath = `${Me.dir.get_path()}`;
            this.settings = settings;
            this.configMgr = configMgr;
            this.options = options;
            this._importCss();
            this.defaultPalette = this.getDefaultPalette();
        }

        addPx(value) {
            return `${value}px`;
        }

        removePx(value) {
            return value.replace("px", "");
        }

        getDefaultPalette() {
            return {
                "tiled": this.getDefaults("tiled"),
                "split": this.getDefaults("split"),
                "floated": this.getDefaults("floated"),
                "stacked": this.getDefaults("stacked"),
                "tabbed": this.getDefaults("tabbed"),
            }
        }

        /**
         * The scheme name is in between the CSS selector name
         * E.g. window-tiled-color should return `tiled`
         */
        getColorSchemeBySelector(selector) {
            if (!selector.includes("-")) return null;
            let firstDash = selector.indexOf("-");
            let secondDash = selector.indexOf("-", firstDash + 1);
            const scheme = selector.substr(firstDash + 1, (secondDash - firstDash - 1));
            Logger.debug(`first ${firstDash}, second ${secondDash}, scheme ${scheme}`);
            return scheme;
        }

        getDefaults(color) {
            return {
                "color": this.getCssProperty(`.${color}`, "color").value,
                "border-width": this.removePx(this.getCssProperty(`.${color}`, "border-width").value),
                "opacity": this.getCssProperty(`.${color}`, "opacity").value,
            };
        }

        getCssRule(selector) {
            if (this.cssAst) {
                const rules = this.cssAst.stylesheet.rules;
                // return only the first match, Forge CSS authors should make sure class names are unique :)
                const matchRules = rules.filter(
                    (r) => r.selectors.filter((s) => s === selector).length > 0
                );
                Logger.debug(`matched rules ${matchRules.length}`);
                return matchRules.length > 0 ? matchRules[0] : {};
            }
            return {};
        }

        getCssProperty(selector, propertyName) {
            const cssRule = this.getCssRule(selector);

            if (cssRule) {
                const matchDeclarations = cssRule.declarations.filter(
                    (d) => d.property === propertyName
                );
                return matchDeclarations.length > 0
                    ? matchDeclarations[0]
                    : {};
            }

            return {};
        }

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
            if (!cssFile) {
                cssFile = this.configMgr.defaultStylesheetFile;
            }

            let [success, contents] = cssFile.load_contents(null);
            if (success) {
                const cssContents = imports.byteArray.toString(contents);
                Logger.trace(`${cssContents}`);
                this.cssAst = Css.parse(cssContents);
            }
        }

        /**
         * Writes the AST back to stylesheet.css and reloads the theme
         */
        _updateCss() {
            if (!this.cssAst) {
                Logger.warn(`There is no current CSS AST`);
                return;
            }

            let cssFile = this.configMgr.stylesheetFile;
            if (!cssFile) {
                cssFile = this.configMgr.defaultStylesheetFile;
            }

            const cssContents = Css.stringify(this.cssAst);
            const PERMISSIONS_MODE = 0o744;

            if (
                GLib.mkdir_with_parents(
                    cssFile.get_parent().get_path(),
                    PERMISSIONS_MODE
                ) === 0
            ) {
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
         * Credits: ExtensionSystem.js:_callExtensionEnable()
         */
        reloadStylesheet() {
            if (this.options.prefsMode) {
                this.settings.set_string("css-updated", Date.now().toString());
            } else {
                const uuid = Me.metadata.uuid;
                const St = imports.gi.St;
                const stylesheetFile = this.configMgr.stylesheetFile;
                const defaultStylesheetFile = this.configMgr.defaultStylesheetFile;
                let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
                try {
                    theme.unload_stylesheet(defaultStylesheetFile);
                    theme.unload_stylesheet(stylesheetFile);
                    theme.load_stylesheet(stylesheetFile);
                    Logger.debug("stylesheet reloaded");
                    Me.stylesheet = stylesheetFile;
                } catch (e) {
                    Logger.error(`${uuid} - ${e}`);
                    return;
                }
            }
        }
    }
);

/**
 * Credits: Color Space conversion functions from CSS Tricks
 * https://css-tricks.com/converting-color-spaces-in-javascript/
 */
function RGBAToHexA(rgba) {
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

function hexAToRGBA(h) {
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
