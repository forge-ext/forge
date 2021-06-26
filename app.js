// Gnome imports
const { GObject } = imports.gi;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const logger = Me.imports.logger;

var ReplaceMe = GObject.registerClass(
    class ReplaceMe extends GObject.Object {
        _init() {
            super._init();
            logger.info("ReplaceMe initialized");
        }
    }
)