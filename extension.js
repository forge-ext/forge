// Gnome imports

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Application imports
const Window = Me.imports.windowManager;
const logger = Me.imports.logger;

var forgeWm;

function init() {
    logger.info("init");
}

function enable() {
    logger.info("enable");

    if (!forgeWm)
        forgeWm = new Window.ForgeWindowManager();

    forgeWm.bindSignals();
}

function disable() {
    logger.info("disable");

    if (forgeWm) 
        forgeWm.disable();
}
