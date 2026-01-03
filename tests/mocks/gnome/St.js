// Mock St (Shell Toolkit) namespace

export class Widget {
  constructor(params = {}) {
    this.name = params.name || '';
    this.style_class = params.style_class || '';
    this.visible = params.visible !== false;
    this._signals = {};
  }

  get_style_class_name() {
    return this.style_class;
  }

  set_style_class_name(name) {
    this.style_class = name;
  }

  add_style_class_name(name) {
    if (!this.style_class.includes(name)) {
      this.style_class += ` ${name}`;
    }
  }

  remove_style_class_name(name) {
    this.style_class = this.style_class.replace(name, '').trim();
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

export class Bin extends Widget {
  constructor(params = {}) {
    super(params);
    this.child = params.child || null;
  }

  set_child(child) {
    this.child = child;
  }

  get_child() {
    return this.child;
  }
}

export class BoxLayout extends Widget {
  constructor(params = {}) {
    super(params);
    this.children = [];
    this.vertical = params.vertical || false;
  }

  add_child(child) {
    this.children.push(child);
  }

  remove_child(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }
}

export class Label extends Widget {
  constructor(params = {}) {
    super(params);
    this.text = params.text || '';
  }

  get_text() {
    return this.text;
  }

  set_text(text) {
    this.text = text;
  }
}

export class Button extends Widget {
  constructor(params = {}) {
    super(params);
    this.label = params.label || '';
  }
}

export default {
  Widget,
  Bin,
  BoxLayout,
  Label,
  Button
};
