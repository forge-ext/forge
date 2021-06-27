// Gnome imports
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const logger = Me.imports.logger;

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init() {
            super._init();
            logger.info("Forge initialized");

            this._bindSignals();
        }

        _bindSignals() {
            const display = global.display;
            this._displaySignals = [
                display.connect("window-created", this._windowCreate.bind(this)),
            ];
        }

        _removeSignals() {
            if (this._displaySignals) {
                for (const displaySignal of this._displaySignals) {
                    global.display.disconnect(displaySignal);
                }
            }
        }

        _trackWindows() {
        }

        _windowCreate(_display, metaWindow) {
            logger.debug(`window created: ${metaWindow.get_title()}`);
        }

        get windows() {
            let wsManager = global.workspace_manager;
            return global.display.get_tabs_list(Meta.TabList.NORMAL_ALL,
                wsManager.get_active_workspace());
        }

        disable() {
            logger.debug(`Disable is called`);
            this._removeSignals();
        }
    }
)
