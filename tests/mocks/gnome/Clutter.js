// Mock Clutter namespace

export class Actor {
  constructor(params = {}) {
    this.name = params.name || '';
    this.x = params.x || 0;
    this.y = params.y || 0;
    this.width = params.width || 0;
    this.height = params.height || 0;
    this.visible = params.visible !== false;
    this.reactive = params.reactive !== false;
    this._signals = {};
  }

  get_x() {
    return this.x;
  }

  set_x(x) {
    this.x = x;
  }

  get_y() {
    return this.y;
  }

  set_y(y) {
    this.y = y;
  }

  get_width() {
    return this.width;
  }

  set_width(width) {
    this.width = width;
  }

  get_height() {
    return this.height;
  }

  set_height(height) {
    this.height = height;
  }

  set_position(x, y) {
    this.x = x;
    this.y = y;
  }

  set_size(width, height) {
    this.width = width;
    this.height = height;
  }

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  destroy() {
    // Mock destroy
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

export const ActorAlign = {
  FILL: 0,
  START: 1,
  CENTER: 2,
  END: 3
};

export const Orientation = {
  HORIZONTAL: 0,
  VERTICAL: 1
};

export default {
  Actor,
  ActorAlign,
  Orientation
};
