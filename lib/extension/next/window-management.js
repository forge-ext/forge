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

// Gnome imports
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import GObject from "gi://GObject";
import Meta from "gi://Meta";
import St from "gi://St";

// Gnome Shell imports
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";

// Shared state
import { Logger } from "../../shared/logger.js";

/** @typedef {import('../../extension.js').default} ForgeExtension */

export class WindowManagement extends GObject.Object {
  static {
    GObject.registerClass(this);
  }

  /** @type {ForgeExtension} */
  #ext;

  /** @type {any} */
  #settings;

  /** @type {Array} */
  #tree = [];

  /** @type {Array} */
  #displaySignals = [];

  /** @type {Array} */
  #windowManagerSignals = [];

  /** @type {Array} */
  #workspaceSignals = [];

  /** @type {Array} */
  #settingsSignals = [];

  /**
   * GNOME Display
   * @type {any} */
  #display;

  /**
   * GNOME Window Manager
   * @type {any} */
  #windowManager;

  /**
   * GNOME Workspace Manager
   * @type {any} */
  #workspaceManager;

  /** @param {ForgeExtension} ext */
  constructor(ext) {
    super();
    this.#ext = ext;
    this.#settings = ext.settings;
    this.#display = global.display;
    this.#windowManager = global.window_manager;
    this.#bindSignals();
  }

  destroy() {
    Logger.info("window-management destroy");
    this.#unbindSignals();
    this.#tree.length = 0;
  }

  #bindSignals() {
    Logger.info("bind signals");

    this.#displaySignals = [
      this.#display.connect("window-created", this.#windowCreated.bind(this)),
      this.#display.connect("window-entered-monitor", this.#windowEnteredMonitor.bind(this)),
      this.#display.connect("grab-op-begin", this.#grabOpBegin.bind(this)),
      this.#display.connect("grab-op-end", this.#grabOpEnd.bind(this)),
    ];
  }

  #unbindSignals() {
    Logger.info("unbind signals");

    this.#displaySignals.forEach((signal) => {
      this.#display.disconnect(signal);
    });
    this.#displaySignals.length = 0;
    this.#displaySignals = null;

    this.#tree.forEach((entry) => {
      this.#unbindWindowSignals(entry.instance, entry.actor);
    });
  }

  get focusWindow() {
    return this.#display.get_focus_window();
  }

  #windowEnteredMonitor(_display, monitor, metaWindow) {
    Logger.debug(`window entered monitor-${monitor} ${metaWindow.get_id()}:${metaWindow.title}`);
  }

  #windowCreated(_display, metaWindow) {
    Logger.debug(`window created ${metaWindow.get_id()}:${metaWindow.title}`);

    // Track the window here
    this.#trackWindow(metaWindow);
  }

  #windowShown(metaWindow) {
    Logger.debug(`window shown ${metaWindow.get_id()}:${metaWindow.title}`);
  }

  #workspaceChanged(metaWindow) {
    Logger.debug(`window workspace changed ${JSON.stringify(this.#forgedWindow(metaWindow))}`);
  }

  #trackWindow(metaWindow) {
    if (!this.#trackingAllowed(metaWindow)) return;
    if (this.#windowExists(metaWindow)) return;

    this.#tree.push(this.#forgedWindow(metaWindow));

    // Bind metaWindow signals
    const windowSignals = [
      metaWindow.connect("position-changed", this.#positionChanged.bind(this)),
      metaWindow.connect("size-changed", this.#sizeChanged.bind(this)),
      metaWindow.connect("focus", this.#focus.bind(this)),
      metaWindow.connect("shown", this.#windowShown.bind(this)),
      metaWindow.connect("workspace-changed", this.#workspaceChanged.bind(this)),
    ];
    metaWindow.windowSignals = windowSignals;

    let windowActor = metaWindow.get_compositor_private();
    const actorSignals = [windowActor.connect("destroy", this.#windowDestroyed.bind(this))];
    windowActor.actorSignals = actorSignals;

    Logger.info(`window tracked ${metaWindow.get_id()}:${metaWindow.title}`);
    this.#sync();
  }

  /** @param {Meta.Window} metaWindow */
  #trackingAllowed(metaWindow) {
    switch (metaWindow.get_window_type()) {
      case Meta.WindowType.NORMAL:
      case Meta.WindowType.MODAL_DIALOG:
      case Meta.WindowType.DIALOG:
        return true;
      default:
        return false;
    }
  }

  /** @param {Meta.Window} metaWindow */
  #forgedWindow(metaWindow) {
    let frameRect = metaWindow.get_frame_rect();
    return {
      id: metaWindow.get_id(),
      title: metaWindow.title,
      workspace: metaWindow.get_workspace()?.index(),
      class: metaWindow.wm_class,
      type: metaWindow.get_window_type(),
      rect: {
        x: frameRect.x,
        y: frameRect.y,
        width: frameRect.width,
        height: frameRect.height,
      },
      monitor: metaWindow.get_monitor(),
      fullscreen: metaWindow.fullscreen,
      minimized: metaWindow.minimized,
      resizable: metaWindow.resizable,
      "skip-taskbar": metaWindow["skip-taskbar"],
      "on-all-workspaces": metaWindow["on-all-workspaces"],
      actor: metaWindow.get_compositor_private(),
      instance: metaWindow,
    };
  }

  /** @param {Meta.Window} metaWindow */
  #serialize(metaWindow) {
    return JSON.stringify(this.#forgedWindow(metaWindow));
  }

  #sync() {
    Logger.debug(`tree count: [${this.#tree.length}], status : ${JSON.stringify(this.#tree)}`);
  }

  /** @param {Meta.Window} metaWindow */
  #windowExists(metaWindow) {
    return this.#tree?.filter((entry) => entry.id === metaWindow.get_id()).length > 0;
  }

  /**
   * @param {Meta.Display} _display
   * @param {Meta.Window} metaWindow */
  #grabOpBegin(_display, metaWindow, grabOp) {
    Logger.debug(`grab op begin ${metaWindow.get_id()}:${metaWindow.title}`);
  }

  /**
   * @param {Meta.Display} _display
   * @param {Meta.Window} metaWindow */
  #grabOpEnd(_display, metaWindow, grabOp) {
    Logger.debug(`grab op end ${metaWindow.get_id()}:${metaWindow.title}`);
  }

  /** @param {Clutter.Actor} windowActor */
  #windowDestroyed(windowActor) {
    Logger.debug(`window destroyed`);

    /* Search for the windowActor in the tree and then remove its entry */
    let entry = this.#tree.filter((entry) => entry.actor === windowActor)[0];
    let index = this.#tree.indexOf(entry);

    if (index > -1) {
      this.#unbindWindowSignals(entry.instance, windowActor);
      this.#tree.splice(index, 1);
      Logger.debug(`window untracked ${this.#serialize(entry.instance)}`);
    }
    this.#sync();
  }

  /**
   * @param {Meta.Window} metaWindow
   * @param {Clutter.Actor} windowActor */
  #unbindWindowSignals(metaWindow, windowActor) {
    windowActor?.actorSignals?.forEach((signal) => {
      windowActor.disconnect(signal);
    });
    windowActor.actorSignals.length = 0;
    windowActor.actorSignals = null;

    metaWindow?.windowSignals?.forEach((signal) => {
      metaWindow.disconnect(signal);
    });
    metaWindow.windowSignals.length = 0;
    metaWindow.windowSignals = null;
  }

  /** @param {Meta.Window} metaWindow */
  #positionChanged(metaWindow) {
    Logger.trace(`position changed ${this.#serialize(metaWindow)}`);
  }

  /** @param {Meta.Window} metaWindow */
  #sizeChanged(metaWindow) {
    Logger.trace(`size changed ${this.#serialize(metaWindow)}`);
  }

  /** @param {Meta.Window} metaWindow */
  #focus(metaWindow) {
    Logger.debug(`window focus ${this.#serialize(metaWindow)}`);
  }
}
