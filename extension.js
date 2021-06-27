// Gnome imports

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const app = Me.imports.app;
const logger = Me.imports.logger;

var forgeApp;

function init() {
    logger.info("init");
}

function enable() {
    logger.info("enable");
    forgeApp = new app.ForgeWindowManager();
}

function disable() {
    logger.info("disable");

    if (forgeApp) {
        forgeApp.disable();
    }
}
