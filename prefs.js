// Gnome imports

imports.gi.versions.Gtk = "3.0";
const { Gtk } = imports.gi;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const logging = Me.imports.logger;

function init() {

}

function buildPrefsWidget() {
    let prefsWidget = new Gtk.Grid({
        margin: 18,
        column_spacing: 12,
        row_spacing: 12
    });

    createLoggingCombo(prefsWidget);

    // show the grid
    prefsWidget.show_all();

    return prefsWidget;
}

/**
 * Create logging level changer in preferences
 * @param {grid} grid 
 */
function createLoggingCombo(grid) {
    let logLabel = new Gtk.Label({
        label: `Log Level`,
        halign: Gtk.Align.START
    });

    grid.attach(logLabel, 0, 0, 1, 1);

    let logCombo = new Gtk.ComboBoxText();
    let itemId = 0;

    for (const key in logging.LOG_LEVELS) {
        logCombo.append(`${logging.LOG_LEVELS[key]}`, key);
    }

    let currentLogLevelVal = logging.getLogLevel();

    logCombo.set_active_id(`${currentLogLevelVal}`);
    logCombo.connect("changed", () => {
        let settings = ExtensionUtils.getSettings();
        let activeId = logCombo.get_active_id();
        settings.set_uint("log-level", activeId);
    });

    grid.attach(logCombo, 1, 0, 1, 1);
}
