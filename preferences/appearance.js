"use strict";

// Gnome imports
const { Adw, GObject, Gdk, Gtk } = imports.gi;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { ColorRow, DropDownRow, PreferencesPage, ResetButton, SpinButtonRow, SwitchRow } = Me.imports.widgets;

const _ = imports.gettext.domain(Me.metadata.uuid).gettext;

// Application imports
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;
const Settings = Me.imports.settings;
const Theme = Me.imports.theme;

var AppearancePage = GObject.registerClass(class AppearancePage extends PreferencesPage {
  _init({ settings }) {
    this.settings = settings;
    super._init({ title: _('Appearance'), icon_name: 'brush-symbolic' });
    this.themeMgr = new Theme.ThemeManager(settings, new Settings.ConfigManager(), { prefsMode: true });
    this.add_group({
      title: _('Gaps'),
      children: [
        // Gaps size
        new SpinButtonRow({
          title: Msgs.prefs_appearance_window_gaps_size_label,
          range: [0, 32, 1],
          settings,
          bind: 'window-gap-size',
        }),
        // Gaps size multiplier
        new SpinButtonRow({
          title: Msgs.prefs_appearance_window_gaps_increment_label,
          range: [0, 8, 1],
          settings,
          bind: 'window-gap-size-increment',
        }),
        // Gap Hidden when Single Window
        new SwitchRow({
          title: Msgs.prefs_appearance_window_gaps_hidden_single_label,
          settings,
          bind: 'window-gap-hidden-on-single',
        }),
        ],
    });

    this.add_group({
      title: _('Color'),
      children: [
        'window-tiled-border',
        'window-tabbed-border',
        'window-stacked-border',
        'window-floated-border',
        'window-split-border',
      ].map(x => this._createColorOptionWidget(x))
    });
  }

  _createColorOptionWidget(prefix) {
    const selector = `.${prefix}`;
    const theme = this.themeMgr;
    const title = Msgs.getCssSelectorAsMessage(selector);
    const colorScheme = theme.getColorSchemeBySelector(selector);
    const row = new Adw.ExpanderRow({ title });

    const borderSizeRow = new SpinButtonRow({
      title: Msgs.prefs_appearance_color_border_size_label,
      range: [1, 6, 1],
      // subtitle: 'Properties of the focus hint',
      max_width_chars: 1,
      max_length: 1,
      width_chars: 2,
      xalign: 1,
      init: theme.removePx(theme.getCssProperty(selector, "border-width").value),
      onChange: value => {
        const px = theme.addPx(value);
        Logger.debug(`Setting border width for selector: ${selector} ${px}`);
        theme.setCssProperty(selector, "border-width", px);
      },
    });

    borderSizeRow.add_suffix(new ResetButton({
      onReset: () => {
        const borderDefault = theme.defaultPalette[colorScheme]["border-width"];
        theme.setCssProperty(selector, "border-width", theme.addPx(borderDefault));
        borderSizeRow.activatable_widget.value = borderDefault;
      }
    }));

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
      title: `${Msgs.prefs_appearance_color_border_color_label}`,
      init: theme.getCssProperty(selector, "border-color").value,
      onChange: updateCssColors,
    });

    borderColorRow.add_suffix(new ResetButton({
      onReset: () => {
        const selectorColor = theme.defaultPalette[colorScheme].color;
        updateCssColors(selectorColor);
        const rgba = new Gdk.RGBA();
        if (rgba.parse(selectorColor)) {
          borderColorRow.colorButton.set_rgba(rgba);
        }
      }
    }));

    row.add_row(borderColorRow);
    row.add_row(borderSizeRow);

    return row;
  }
});

