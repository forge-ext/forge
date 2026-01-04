// Mock GObject namespace

export function signal_connect(object, signal, callback) {
  if (!object._signals) object._signals = {};
  if (!object._signals[signal]) object._signals[signal] = [];
  const id = Math.random();
  object._signals[signal].push({ id, callback });
  return id;
}

export function signal_disconnect(object, id) {
  if (!object._signals) return;
  for (const signal in object._signals) {
    object._signals[signal] = object._signals[signal].filter(s => s.id !== id);
  }
}

export function signal_emit(object, signal, ...args) {
  if (!object._signals || !object._signals[signal]) return;
  object._signals[signal].forEach(s => s.callback(...args));
}

export const SignalFlags = {
  RUN_FIRST: 1 << 0,
  RUN_LAST: 1 << 1,
  RUN_CLEANUP: 1 << 2,
  NO_RECURSE: 1 << 3,
  DETAILED: 1 << 4,
  ACTION: 1 << 5,
  NO_HOOKS: 1 << 6
};

class GObjectBase {
  constructor() {
    this._signals = {};
  }

  connect(signal, callback) {
    return signal_connect(this, signal, callback);
  }

  disconnect(id) {
    signal_disconnect(this, id);
  }

  emit(signal, ...args) {
    signal_emit(this, signal, ...args);
  }
}

export { GObjectBase as Object };

// Mock for GObject.registerClass
export function registerClass(klass) {
  // In real GObject, this would register the class with the type system
  // For testing, we just return the class unchanged
  return klass;
}

export default {
  signal_connect,
  signal_disconnect,
  signal_emit,
  SignalFlags,
  Object: GObjectBase,
  registerClass
};
