/*
 * This file is part of the Forge Window Manager extension for Gnome 3
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

// Gnome imports
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

// Gnome Shell imports
const DND = imports.ui.dnd;
const Main = imports.ui.main;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Utils = Me.imports.utils;
const Logger = Me.imports.logger;
const WindowManager = Me.imports.windowManager;

var Keybindings = GObject.registerClass(
    class Keybindings extends GObject.Object {
        _init(forgeWm) {
            Logger.debug(`created keybindings`);
            this._grabbers = new Map();
            this._bindSignals();
            this._forgeWm = forgeWm;

            this._bindings = {
                'kbd-window-border': () => {
                    // TODO, add any keyboard actions here
                },
            };
        }

        _acceleratorActivate (action) {
            let grabber = this._grabbers.get(action);
            if(grabber) {
                Logger.debug(`Firing accelerator ${grabber.accelerator} : ${grabber.name}`);
                grabber.callback();
            } else {
                Logger.error(`No listeners [action={${action}}]`);
            }
        }

        _bindSignals() {
            global.display.connect('accelerator-activated', (_display, action, 
                _deviceId, _timestamp) => {
                this._acceleratorActivate(action);
            });
        }

        enable() {
            let keybindings = this._bindings;

            for (const key in keybindings) {
                Main.wm.addKeybinding(
                    key,
                    Utils.getSettings(),
                    Meta.KeyBindingFlags.NONE,
                    Shell.ActionMode.NORMAL,
                    keybindings[key]
                );
            }

            windowConfig.forEach((config) => {
                this.listenFor(config.shortcut, () => {
                    config.actions.forEach((action) => {
                        this._forgeWm.command(action);
                    });
                });
            });
            Logger.debug(`keybindings:enable`);
        }

        disable() {
            let keybindings = this._bindings;

            for (const key in keybindings) {
                Main.wm.removeKeybinding(key);
            }

            // The existing grabber items are from the custom config by 
            // this extension.
            this._grabbers.forEach((grabber) => {
                global.display.ungrab_accelerator(grabber.action)
                Main.wm.allowKeybinding(grabber.name, Shell.ActionMode.NONE);
            });

            this._grabbers.clear();
            Logger.debug(`keybindings:disable`);
        }

        /**
         * API for quick binding of keys to function. This is going to be useful with SpaceMode
         *
         * @param {String} accelerator - keybinding combinations
         * @param {Function} callback - function to call when the accelerator is invoked
         *
         * Credits: 
         *  - https://superuser.com/a/1182899
         *  - Adapted based on current Gnome-shell API or syntax
         */
        listenFor(accelerator, callback){
            let action = global.display.grab_accelerator(accelerator, callback)

            if(action == Meta.KeyBindingAction.NONE) {
                Logger.error(`Unable to grab accelerator [binding={${accelerator}}]`);
                // TODO - check the gnome keybindings for conflicts and notify the user
            } else {
                let name = Meta.external_binding_name_for_action(action)

                Logger.debug(`Requesting WM to allow binding [name={${name}}]`);
                Main.wm.allowKeybinding(name, Shell.ActionMode.ALL)

                this._grabbers.set(action, {
                    name: name,
                    accelerator: accelerator,
                    callback: callback,
                    action: action
                });
            }
        }
    }
);

var windowConfig = [
    {
        name: 'float',
        shortcut : '<Super>c',
        actions: [
            {
                name : 'MoveResize',
                mode: WindowManager.WINDOW_MODES['FLOAT'],
                x : 'center',
                y : 'center',
                width: 0.65,
                height: 0.75
            },
        ],
    },
];
