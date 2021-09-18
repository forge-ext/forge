/*
 * This file is part of the Forge extension for GNOME
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

'use strict';

// Gnome imports
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;

// Gnome Shell imports
const DND = imports.ui.dnd;
const Main = imports.ui.main;

// Extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Logger = Me.imports.logger;
const Msgs = Me.imports.messages;
const Window = Me.imports.window;
const ExtUtils = Me.imports.utils;

var Keybindings = GObject.registerClass(
    class Keybindings extends GObject.Object {
        _init(ext) {
            Logger.debug(`created keybindings`);
            this._grabbers = new Map();
            // this._bindSignals();
            this.ext = ext;
            this.forgeWm = ext.forgeWm;
            this.kbdSettings = ext.kbdSettings;
            this.settings = ext.settings;
            this.buildBindingDefinitions();
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
                    this.kbdSettings,
                    Meta.KeyBindingFlags.NONE,
                    Shell.ActionMode.NORMAL,
                    keybindings[key]
                );
            }

            Logger.debug(`keybindings:enable`);
        }

        disable() {
            let keybindings = this._bindings;

            for (const key in keybindings) {
                Main.wm.removeKeybinding(key);
            }

            Logger.debug(`keybindings:disable`);
        }

        checkConflict(shortcut) {
            return false;
        }

        // @deprecated
        enableListenForBindings() {
            windowConfig.forEach((config) => {
                config.shortcut.forEach((shortcut) => {
                    this.listenFor(shortcut, () => {
                        config.actions.forEach((action) => {
                            this.forgeWm.command(action);
                        });
                    });
                });
            });
        }

        // @deprecated
        disableListenForBindings() {
            // The existing grabber items are from the custom config by 
            // this extension.
            this._grabbers.forEach((grabber) => {
                global.display.ungrab_accelerator(grabber.action)
                Main.wm.allowKeybinding(grabber.name, Shell.ActionMode.NONE);
            });

            this._grabbers.clear();
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
            let grabFlags = Meta.KeyBindingFlags.NONE;
            let action = global.display.grab_accelerator(accelerator, grabFlags)

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

        buildBindingDefinitions() {
            this._bindings = {
                "window-toggle-float": () => {
                    let actions = [
                        {
                            name : "MoveResize",
                            mode: "float",
                            x : "center",
                            y : "center",
                            width: 0.65,
                            height: 0.75
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-focus-left": () => {
                    let actions = [
                        {
                            name : "Focus",
                            direction: "Left"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-focus-down": () => {
                    let actions = [
                        {
                            name : "Focus",
                            direction: "Down"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-focus-up": () => {
                    let actions = [
                        {
                            name : "Focus",
                            direction: "Up"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-focus-right": () => {
                    let actions = [
                        {
                            name : "Focus",
                            direction: "Right"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-swap-left": () => {
                    let actions = [
                        {
                            name : "Swap",
                            direction: "Left"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-swap-down": () => {
                    let actions = [
                        {
                            name : "Swap",
                            direction: "Down"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-swap-up": () => {
                    let actions = [
                        {
                            name : "Swap",
                            direction: "Up"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-swap-right": () => {
                    let actions = [
                        {
                            name : "Swap",
                            direction: "Right"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-move-left": () => {
                    let actions = [
                        {
                            name : "Move",
                            direction: "Left"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-move-down": () => {
                    let actions = [
                        {
                            name : "Move",
                            direction: "Down"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-move-up": () => {
                    let actions = [
                        {
                            name : "Move",
                            direction: "Up"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "window-move-right": () => {
                    let actions = [
                        {
                            name : "Move",
                            direction: "Right"
                        },
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "con-split-layout-toggle": () => {
                    let actions = [
                        { name: "LayoutToggle" }
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "con-split-vertical": () => {
                    let actions = [
                        { name: "Split", orientation: "vertical" }
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "con-split-horizontal": () => {
                    let actions = [
                        { name: "Split", orientation: "horizontal" }
                    ];
                    actions.forEach((action) => {
                        this.forgeWm.command(action);
                    });
                },
                "focus-border-toggle": () => {
                    let action = { name: "FocusBorderToggle" };
                    this.forgeWm.command(action);
                },
                "prefs-tiling-toggle": () => {
                    let action = { name: "TilingModeToggle" };
                    this.forgeWm.command(action);
                },
                "window-gap-size-increase": () => {
                    let action = { name: "GapSize", amount: 1 };
                    this.forgeWm.command(action);
                },
                "window-gap-size-decrease": () => {
                    let action = { name: "GapSize", amount: -1 };
                    this.forgeWm.command(action);
                },
                "prefs-open": () => {
                    let existWindow = ExtUtils.findWindowWith(Msgs.prefs_title);
                    if (existWindow && existWindow.get_workspace()) {
                        existWindow.get_workspace().activate_with_focus(existWindow,
                            global.display.get_current_time());
                        Logger.warn("prefs is already open");
                    } else {
                        Logger.debug("opening prefs");
                        ExtensionUtils.openPrefs();

                        // Wait for it to appear on TabList
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                            let newPrefsWindow = ExtUtils.findWindowWith(Msgs.prefs_title);
                            if (newPrefsWindow) {
                                newPrefsWindow.get_workspace()
                                    .activate_with_focus(newPrefsWindow,
                                global.display.get_current_time());
                            }
                            return false;
                        });
                    }
                },
            };
        }
    }
);
