// Gnome imports
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

// Gnome Shell imports
const DND = imports.ui.dnd;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const logger = Me.imports.logger;

var ForgeWindowManager = GObject.registerClass(
    class ForgeWindowManager extends GObject.Object {
        _init() {
            super._init();
            this._rootContainer = null;

            this._bindSignals();

            logger.info("Forge initialized");
        }

        _bindSignals() {
            const display = global.display;
            this._displaySignals = [
                display.connect("window-created", this._windowCreate.
                    bind(this)),
            ];
        }

        _removeSignals() {
            if (this._displaySignals) {
                for (const displaySignal of this._displaySignals) {
                    global.display.disconnect(displaySignal);
                }
            }
        }

        _windowCreate(_display, metaWindow) {
            logger.debug(`window created: ${metaWindow.get_title()}`);
            if (metaWindow.get_window_type() == Meta.WindowType.NORMAL) {
                let windowActor = metaWindow.get_compositor_private();
                windowActor.connect("destroy", this._windowDestroy.bind(this));
            }
        }

        _windowDestroy(_actor) {
            // Release any resources on the window
            logger.debug(`window destroyed`);
        }

        get windows() {
            let wsManager = global.workspace_manager;
            // TODO: make it configurable
            return global.display.get_tabs_list(Meta.TabList.NORMAL_ALL,
                wsManager.get_active_workspace());
        }

        disable() {
            logger.debug(`Disable is called`);
            this._removeSignals();
        }
    }
);

var Container = GObject.registerClass(
    class Container extends GObject.Object {
        _init() {
            super._init();
            
        }
    }
);

