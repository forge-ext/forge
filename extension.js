// Gnome imports

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const app = Me.imports.app;
const logger = Me.imports.logger;

var appInstance;

function init() {
    logger.info("init");
}

function enable() {
    logger.info("enable");
    appInstance = new app.ReplaceMe();
}

function disable() {
    logger.info("disable");

    if (appInstance) {
        // do something
    }
}