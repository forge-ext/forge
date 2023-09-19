// Gnome imports
import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gdk from "gi://Gdk";

// Extension imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Shared state
import { ConfigManager } from "../shared/settings.js";

import { PrefsThemeManager } from "./prefs-theme-manager.js";

// Prefs UI
import { ColorRow, PreferencesPage, ResetButton, SpinButtonRow, SwitchRow } from "./widgets.js";
import { Logger } from "../shared/logger.js";

export class AppearancePage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  /**
   * @param {string} selector
   */
  static getCssSelectorAsMessage(selector) {
    switch (selector) {
      case ".window-tiled-border":
        return _("Tiled Focus Hint and Preview");
      case ".window-floated-border":
        return _("Floated Focus Hint");
      case ".window-split-border":
        return _("Split Direction Hint");
      case ".window-stacked-border":
        return _("Stacked Focus Hint and Preview");
      case ".window-tabbed-border":
        return _("Tabbed Focus Hint and Preview");
    }
  }

  constructor({ settings, dir }) {
    super({ title: _("Appearance"), icon_name: "brush-symbolic" });
    this.settings = settings;
    this.configMgr = new ConfigManager({ dir });
    this.themeMgr = new PrefsThemeManager(this);
    this.add_group({
      title: _("Gaps"),
      children: [
        // Gaps size
        new SpinButtonRow({
          title: _("Gaps Size"),
          range: [0, 32, 1],
          settings,
          bind: "window-gap-size",
        }),
        // Gaps size multiplier
        new SpinButtonRow({
          title: _("Gaps Size Multiplier"),
          range: [0, 8, 1],
          settings,
          bind: "window-gap-size-increment",
        }),
        // Gap Hidden when Single Window
        new SwitchRow({
          title: _("Gaps Hidden when Single"),
          settings,
          bind: "window-gap-hidden-on-single",
        }),
      ],
    });

    this.add_group({
      title: _("Color"),
      children: [
        "window-tiled-border",
        "window-tabbed-border",
        "window-stacked-border",
        "window-floated-border",
        "window-split-border",
      ].map((x) => this._createColorOptionWidget(x)),
    });
  }

  /**
   * @param {string} prefix
   */
  _createColorOptionWidget(prefix) {
    const selector = `.${prefix}`;
    const theme = this.themeMgr;
    const title = AppearancePage.getCssSelectorAsMessage(selector);
    const colorScheme = theme.getColorSchemeBySelector(selector);
    const row = new Adw.ExpanderRow({ title });

    const borderSizeRow = new SpinButtonRow({
      title: _("Border Size"),
      range: [1, 6, 1],
      // subtitle: 'Properties of the focus hint',
      max_width_chars: 1,
      max_length: 1,
      width_chars: 2,
      xalign: 1,
      init: theme.removePx(theme.getCssProperty(selector, "border-width").value),
      onChange: (value) => {
        const px = theme.addPx(value);
        Logger.debug(`Setting border width for selector: ${selector} ${px}`);
        theme.setCssProperty(selector, "border-width", px);
      },
    });

    borderSizeRow.add_suffix(
      new ResetButton({
        onReset: () => {
          const borderDefault = theme.defaultPalette[colorScheme]["border-width"];
          theme.setCssProperty(selector, "border-width", theme.addPx(borderDefault));
          borderSizeRow.activatable_widget.value = borderDefault;
        },
      })
    );

    const updateCssColors = (rgbaString) => {
      const rgba = new Gdk.RGBA();

      if (rgba.parse(rgbaString)) {
        Logger.debug(`Setting color for selector: ${selector} ${rgbaString}`);
        const previewBorderRgba = rgba.copy();
        const previewBackgroundRgba = rgba.copy();
        const overviewBackgroundRgba = rgba.copy();

        previewBorderRgba.alpha = 0.3;
        previewBackgroundRgba.alpha = 0.2;
        overviewBackgroundRgba.alpha = 0.5;

        // The primary color updates the focus hint:
        theme.setCssProperty(selector, "border-color", rgba.to_string());

        // Only apply below on the tabbed scheme
        if (colorScheme === "tabbed") {
          const tabBorderRgba = rgba.copy();
          const tabActiveBackgroundRgba = rgba.copy();
          tabBorderRgba.alpha = 0.6;
          theme.setCssProperty(
            `.window-${colorScheme}-tab`,
            "border-color",
            tabBorderRgba.to_string()
          );
          theme.setCssProperty(
            `.window-${colorScheme}-tab-active`,
            "background-color",
            tabActiveBackgroundRgba.to_string()
          );
        }
        // And then finally the preview when doing drag/drop tiling:
        theme.setCssProperty(
          `.window-tilepreview-${colorScheme}`,
          "border-color",
          previewBorderRgba.to_string()
        );
        theme.setCssProperty(
          `.window-tilepreview-${colorScheme}`,
          "background-color",
          previewBackgroundRgba.to_string()
        );
      }
    };

    const borderColorRow = new ColorRow({
      title: _("Border Color"),
      init: theme.getCssProperty(selector, "border-color").value,
      onChange: updateCssColors,
    });

    borderColorRow.add_suffix(
      new ResetButton({
        onReset: () => {
          const selectorColor = theme.defaultPalette[colorScheme].color;
          updateCssColors(selectorColor);
          const rgba = new Gdk.RGBA();
          if (rgba.parse(selectorColor)) {
            borderColorRow.colorButton.set_rgba(rgba);
          }
        },
      })
    );

    row.add_row(borderColorRow);
    row.add_row(borderSizeRow);

    return row;
  }
}
