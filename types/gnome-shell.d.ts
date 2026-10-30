/*
 * This file is part of the Forge GNOME extension
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

/*
 * Hand-written types for the two pieces of the GNOME platform that have no
 * typings package:
 *
 *   - the `resource:///org/gnome/shell/...` shell modules, and
 *   - the `gi://Shell` typelib (there is no `@girs/shell` package on npm).
 *
 * This is a partial stub: it declares only the surface Forge imports. It is not
 * a replacement for real shell typings, and it is intentionally permissive for
 * shell UI base classes, whose internals change between GNOME releases and are
 * not part of any contract we control. The point is to make `npm run typecheck`
 * resolve Forge's imports, so real mistakes inside `lib/` surface instead of
 * being buried under "cannot find module".
 *
 * When Forge starts using more of the shell API, add it here.
 */

/*
 * GJS runtime globals. @girs/gjs describes the GLib/Gio bindings but not the
 * prelude functions GJS injects into every module.
 */
declare function log(...args: any[]): void;
declare function print(...args: any[]): void;
/** Provided by GJS (not part of the ECMAScript lib this project targets). */
declare class TextDecoder {
  constructor(label?: string);
  decode(input?: Uint8Array): string;
}
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare const console: {
  log(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  debug(...args: any[]): void;
};
/** The legacy `imports` namespace (imports.gi.Gtk, imports.ui.main, ...). */
declare const imports: any;

/*
 * The shell's global object (`global`). GJS declares its own globals, but the
 * contents of `global` are a gnome-shell detail with no typings package, so
 * they are declared here with the typelib types where they exist.
 */
declare const global: {
  display: import("gi://Meta").default.Display;
  window_group: import("gi://Meta").default.WindowGroup;
  workspace_manager: import("gi://Meta").default.WorkspaceManager;
  window_manager: any;
  /* `context` is probed with optional chaining in older/newer shell versions. */
  stage: import("gi://Clutter").default.Stage & { context?: any };
  get_pointer(): [number, number, number];
  get_current_time(): number;
  get_window_actors(): any[];
};

/*
 * @girs only declares the versioned specifier for these typelibs
 * (`gi://Meta?version=12`), while GJS accepts the bare `gi://Meta`. Alias the
 * bare specifiers so the imports in lib/ resolve without changing runtime code.
 */
declare module "gi://Clutter" {
  import Clutter from "gi://Clutter?version=12";
  export default Clutter;
}

declare module "gi://Gdk" {
  import Gdk from "gi://Gdk?version=4.0";
  export default Gdk;
}

declare module "gi://Gtk" {
  import Gtk from "gi://Gtk?version=4.0";
  export default Gtk;
}

declare module "gi://Meta" {
  import Meta from "gi://Meta?version=12";
  export default Meta;
}

declare module "gi://St" {
  import St from "gi://St?version=12";
  export default St;
}

declare module "gi://Shell" {
  namespace Shell {
    enum ActionMode {
      NONE = 0,
      NORMAL = 1,
      OVERVIEW = 2,
      LOCK_SCREEN = 3,
      UNLOCK_SCREEN = 4,
      LOGIN_SCREEN = 5,
      SYSTEM_MODAL = 6,
      ALL = 7,
    }

    interface App {
      get_name(): string;
      get_id(): string;
      [key: string]: any;
    }

    class WindowTracker {
      static get_default(): WindowTracker;
      get_window_app(window: any): App | null;
    }
  }

  export default Shell;
}

declare module "resource:///org/gnome/shell/misc/config.js" {
  export const PACKAGE_NAME: string;
  export const PACKAGE_VERSION: string;
}

declare module "resource:///org/gnome/Shell/Extensions/js/misc/config.js" {
  export const PACKAGE_NAME: string;
  export const PACKAGE_VERSION: string;
}

declare module "resource:///org/gnome/shell/extensions/extension.js" {
  import type Gio from "gi://Gio";

  export interface ExtensionMetadata {
    uuid: string;
    name: string;
    description?: string;
    version?: number;
    [key: string]: any;
  }

  export class Extension {
    constructor(metadata: ExtensionMetadata);
    metadata: ExtensionMetadata;
    /** Same value as `metadata.uuid`. */
    uuid: string;
    dir: Gio.File;
    path: string;
    getSettings(schema?: string | null): Gio.Settings;
    openPreferences(): void;
    init(): void;
    enable(): void;
    disable(): void;
  }

  export function gettext(str: string): string;
  export function ngettext(str: string, plural: string, n: number): string;
}

declare module "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js" {
  import type Adw from "gi://Adw";
  import type Gio from "gi://Gio";

  export class ExtensionPreferences {
    metadata: {
      uuid: string;
      name: string;
      [key: string]: any;
    };
    dir: Gio.File;
    path: string;
    getSettings(schema?: string | null): Gio.Settings;
    fillPreferencesWindow(window: Adw.PreferencesWindow): void | Promise<void>;
  }

  export function gettext(str: string): string;
  export function ngettext(str: string, plural: string, n: number): string;
}

declare module "resource:///org/gnome/shell/ui/main.js" {
  interface SignalTarget {
    connect(signal: string, callback: (...args: any[]) => void): number;
    disconnect(id: number): void;
  }

  export const overview: SignalTarget & {
    visible: boolean;
  };

  export const sessionMode: SignalTarget & {
    currentMode: string;
    parentMode: string | null;
    isLocked: boolean;
    allowSettings: boolean;
  };

  export const wm: {
    allowKeybinding(name: string, mode: number): void;
    addKeybinding(
      name: string,
      settings: any,
      flags: number,
      modes: number | number[],
      handler?: (...args: any[]) => void
    ): void;
    removeKeybinding(name: string): void;
  };

  export const panel: {
    statusArea: {
      quickSettings: {
        addExternalIndicator(indicator: any): void;
      };
    };
  };

  /** Number of shell-modal grabs currently open (password prompts, run dialog). */
  export const modalCount: number;

  export const extensionManager: {
    lookup(uuid: string): any;
  };
}

declare module "resource:///org/gnome/shell/ui/quickSettings.js" {
  /*
   * Shell UI base classes. Their members vary by shell version and are not
   * documented anywhere machine-readable, so unknown members are allowed.
   */
  export class QuickMenuToggle {
    [key: string]: any;
    constructor(...args: any[]);
    menu: any;
    checked: boolean;
    connect(signal: string, callback: (...args: any[]) => void): number;
    disconnect(id: number): void;
    destroy(): void;
  }

  export class SystemIndicator {
    [key: string]: any;
    constructor(...args: any[]);
    quickSettingsItems: any[];
    connect(signal: string, callback: (...args: any[]) => void): number;
    disconnect(id: number): void;
    destroy(): void;
  }
}

declare module "resource:///org/gnome/shell/ui/popupMenu.js" {
  export class PopupBaseMenuItem {
    [key: string]: any;
    constructor(...args: any[]);
    connect(signal: string, callback: (...args: any[]) => void): number;
    disconnect(id: number): void;
    destroy(): void;
  }

  export class PopupSwitchMenuItem extends PopupBaseMenuItem {
    constructor(text: string, active: boolean, params?: object);
    state: boolean;
    setToggleState(state: boolean): void;
  }

  export class PopupSeparatorMenuItem extends PopupBaseMenuItem {}

  export class PopupMenuItem extends PopupBaseMenuItem {
    constructor(text: string, params?: object);
  }
}
