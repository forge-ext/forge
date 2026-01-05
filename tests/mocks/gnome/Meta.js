// Mock Meta namespace (Meta window manager APIs)

export class Rectangle {
  constructor(params = {}) {
    this.x = params.x || 0;
    this.y = params.y || 0;
    this.width = params.width || 100;
    this.height = params.height || 100;
  }

  equal(other) {
    return this.x === other.x && this.y === other.y &&
           this.width === other.width && this.height === other.height;
  }

  contains_rect(other) {
    return this.x <= other.x && this.y <= other.y &&
           this.x + this.width >= other.x + other.width &&
           this.y + this.height >= other.y + other.height;
  }

  overlap(other) {
    return !(this.x + this.width <= other.x ||
             other.x + other.width <= this.x ||
             this.y + this.height <= other.y ||
             other.y + other.height <= this.y);
  }

  copy() {
    return new Rectangle({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    });
  }
}

export class Window {
  constructor(params = {}) {
    this.id = params.id || Math.random();
    this._rect = params.rect || new Rectangle();
    this.wm_class = params.wm_class || 'MockApp';
    this.title = params.title || 'Mock Window';
    this.maximized_horizontally = params.maximized_horizontally || false;
    this.maximized_vertically = params.maximized_vertically || false;
    this.minimized = params.minimized || false;
    this.fullscreen = params.fullscreen || false;
    this._window_type = params.window_type !== undefined ? params.window_type : WindowType.NORMAL;
    this._transient_for = params.transient_for || null;
    this._allows_resize = params.allows_resize !== undefined ? params.allows_resize : true;
    this._signals = {};
    this._workspace = params.workspace || null;
    this._monitor = params.monitor || 0;
  }

  get_frame_rect() {
    return this._rect;
  }

  get_buffer_rect() {
    return this._rect;
  }

  get_work_area_current_monitor() {
    return new Rectangle({ x: 0, y: 0, width: 1920, height: 1080 });
  }

  get_work_area_for_monitor(monitorIndex) {
    // Default implementation, tests can override this
    return new Rectangle({ x: monitorIndex * 1920, y: 0, width: 1920, height: 1080 });
  }

  move_resize_frame(interactive, x, y, width, height) {
    this._rect = new Rectangle({ x, y, width, height });
  }

  move_frame(interactive, x, y) {
    this._rect.x = x;
    this._rect.y = y;
  }

  get_wm_class() {
    return this.wm_class;
  }

  get_title() {
    return this.title;
  }

  get_workspace() {
    return this._workspace;
  }

  get_monitor() {
    return this._monitor;
  }

  is_on_all_workspaces() {
    return false;
  }

  change_workspace(workspace) {
    this._workspace = workspace;
  }

  maximize(directions) {
    this.maximized_horizontally = true;
    this.maximized_vertically = true;
  }

  unmaximize(directions) {
    this.maximized_horizontally = false;
    this.maximized_vertically = false;
  }

  is_fullscreen() {
    return this.fullscreen;
  }

  make_fullscreen() {
    this.fullscreen = true;
  }

  unmake_fullscreen() {
    this.fullscreen = false;
  }

  is_above() {
    return this.above || false;
  }

  make_above() {
    this.above = true;
  }

  unmake_above() {
    this.above = false;
  }

  minimize() {
    this.minimized = true;
  }

  unminimize() {
    this.minimized = false;
  }

  raise() {
    // Mock raise operation
  }

  focus(timestamp) {
    // Mock focus operation
  }

  activate(timestamp) {
    this.focus(timestamp);
  }

  delete(timestamp) {
    // Mock delete operation
  }

  kill() {
    // Mock kill operation
  }

  connect(signal, callback) {
    if (!this._signals[signal]) this._signals[signal] = [];
    const id = Math.random();
    this._signals[signal].push({ id, callback });
    return id;
  }

  disconnect(id) {
    for (const signal in this._signals) {
      this._signals[signal] = this._signals[signal].filter(s => s.id !== id);
    }
  }

  emit(signal, ...args) {
    if (this._signals[signal]) {
      this._signals[signal].forEach(s => s.callback(...args));
    }
  }

  get_window_type() {
    return this._window_type;
  }

  get_transient_for() {
    return this._transient_for;
  }

  allows_resize() {
    return this._allows_resize;
  }

  get_id() {
    return this.id;
  }

  get_compositor_private() {
    // Return a mock actor object
    if (!this._actor) {
      this._actor = {
        border: null,
        splitBorder: null,
        actorSignals: null,
        remove_all_transitions: () => {
          // Mock method for removing window transitions
        },
        connect: (signal, callback) => {
          // Mock signal connection
          return Math.random();
        },
        disconnect: (id) => {
          // Mock signal disconnection
        }
      };
    }
    return this._actor;
  }

  set_unmaximize_flags(flags) {
    // GNOME 49+ method
  }
}

export class Workspace {
  constructor(params = {}) {
    this.index = params.index || 0;
    this._windows = [];
    this._signals = {};
  }

  index() {
    return this.index;
  }

  list_windows() {
    return this._windows;
  }

  add_window(window) {
    if (!this._windows.includes(window)) {
      this._windows.push(window);
      window._workspace = this;
    }
  }

  remove_window(window) {
    const index = this._windows.indexOf(window);
    if (index !== -1) {
      this._windows.splice(index, 1);
      window._workspace = null;
    }
  }

  get_work_area_for_monitor(monitorIndex) {
    // Return default work area for monitor
    return new Rectangle({ x: monitorIndex * 1920, y: 0, width: 1920, height: 1080 });
  }

  activate_with_focus(window, timestamp) {
    // Mock activation
  }

  connect(signal, callback) {
    if (!this._signals[signal]) this._signals[signal] = [];
    const id = Math.random();
    this._signals[signal].push({ id, callback });
    return id;
  }

  disconnect(id) {
    for (const signal in this._signals) {
      this._signals[signal] = this._signals[signal].filter(s => s.id !== id);
    }
  }
}

export class Display {
  constructor() {
    this._workspaces = [];
    this._signals = {};
  }

  get_workspace_manager() {
    return {
      get_n_workspaces: () => this._workspaces.length,
      get_workspace_by_index: (index) => this._workspaces[index] || null,
      get_workspaces: () => this._workspaces
    };
  }

  connect(signal, callback) {
    if (!this._signals[signal]) this._signals[signal] = [];
    const id = Math.random();
    this._signals[signal].push({ id, callback });
    return id;
  }

  disconnect(id) {
    for (const signal in this._signals) {
      this._signals[signal] = this._signals[signal].filter(s => s.id !== id);
    }
  }
}

// Enums and constants
export const WindowType = {
  NORMAL: 0,
  DESKTOP: 1,
  DOCK: 2,
  DIALOG: 3,
  MODAL_DIALOG: 4,
  TOOLBAR: 5,
  MENU: 6,
  UTILITY: 7,
  SPLASHSCREEN: 8,
  DROPDOWN_MENU: 9,
  POPUP_MENU: 10,
  TOOLTIP: 11,
  NOTIFICATION: 12,
  COMBO: 13,
  DND: 14,
  OVERRIDE_OTHER: 15
};

export const DisplayCorner = {
  TOPLEFT: 0,
  TOPRIGHT: 1,
  BOTTOMLEFT: 2,
  BOTTOMRIGHT: 3
};

export const DisplayDirection = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3
};

export const MotionDirection = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
  UP_LEFT: 4,
  UP_RIGHT: 5,
  DOWN_LEFT: 6,
  DOWN_RIGHT: 7
};

export const Side = {
  LEFT: 1 << 0,
  RIGHT: 1 << 1,
  TOP: 1 << 2,
  BOTTOM: 1 << 3
};

export const MaximizeFlags = {
  HORIZONTAL: 1 << 0,
  VERTICAL: 1 << 1,
  BOTH: (1 << 0) | (1 << 1)
};

export const GrabOp = {
  NONE: 0,
  MOVING: 1,
  MOVING_UNCONSTRAINED: 1 | 1024,
  KEYBOARD_MOVING: 19,
  RESIZING_NW: 2,
  RESIZING_N: 3,
  RESIZING_NE: 4,
  RESIZING_E: 5,
  RESIZING_SE: 6,
  RESIZING_S: 7,
  RESIZING_SW: 8,
  RESIZING_W: 9,
  KEYBOARD_RESIZING_UNKNOWN: 10,
  KEYBOARD_RESIZING_N: 11,
  KEYBOARD_RESIZING_S: 12,
  KEYBOARD_RESIZING_E: 13,
  KEYBOARD_RESIZING_W: 14,
  KEYBOARD_RESIZING_NW: 15,
  KEYBOARD_RESIZING_NE: 16,
  KEYBOARD_RESIZING_SE: 17,
  KEYBOARD_RESIZING_SW: 18
};

export default {
  Rectangle,
  Window,
  Workspace,
  Display,
  WindowType,
  DisplayCorner,
  DisplayDirection,
  MotionDirection,
  Side,
  MaximizeFlags,
  GrabOp
};
