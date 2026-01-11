// Mock Gio namespace

export class File {
  constructor(path) {
    this.path = path;
  }

  static new_for_path(path) {
    return new File(path);
  }

  get_path() {
    return this.path;
  }

  get_parent() {
    const parts = this.path.split('/');
    parts.pop();
    return new File(parts.join('/'));
  }

  get_child(name) {
    return new File(`${this.path}/${name}`);
  }

  query_exists(cancellable) {
    // Mock - assume files exist
    return true;
  }

  make_directory_with_parents(cancellable) {
    // Mock directory creation
    return true;
  }

  load_contents(cancellable) {
    // Mock file loading - return empty content
    return [true, '', null];
  }

  replace_contents(contents, etag, make_backup, flags, cancellable) {
    // Mock file writing
    return [true, null];
  }

  copy(destination, flags, cancellable, progressCallback) {
    // Mock file copy
    return true;
  }

  create(flags, cancellable) {
    // Mock file creation - return a mock output stream
    return {
      write_all: (contents, cancellable) => {
        // Mock write operation
        return [true, contents.length];
      },
      close: (cancellable) => true
    };
  }
}

export class Settings {
  constructor(schema_id) {
    this.schema_id = schema_id;
    this._settings = new Map();
    this._signals = {};
  }

  static new(schema_id) {
    return new Settings(schema_id);
  }

  get_boolean(key) {
    return this._settings.get(key) || false;
  }

  set_boolean(key, value) {
    this._settings.set(key, value);
  }

  get_int(key) {
    return this._settings.get(key) || 0;
  }

  set_int(key, value) {
    this._settings.set(key, value);
  }

  get_string(key) {
    return this._settings.get(key) || '';
  }

  set_string(key, value) {
    this._settings.set(key, value);
  }

  get_strv(key) {
    return this._settings.get(key) || [];
  }

  set_strv(key, value) {
    this._settings.set(key, value);
  }

  get_uint(key) {
    return this._settings.get(key) || 0;
  }

  set_uint(key, value) {
    this._settings.set(key, value);
  }

  get_value(key) {
    return this._settings.get(key);
  }

  set_value(key, value) {
    this._settings.set(key, value);
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

export const FileCreateFlags = {
  NONE: 0,
  PRIVATE: 1 << 0,
  REPLACE_DESTINATION: 1 << 1
};

export const FileCopyFlags = {
  NONE: 0,
  OVERWRITE: 1 << 0,
  BACKUP: 1 << 1,
  NOFOLLOW_SYMLINKS: 1 << 2,
  ALL_METADATA: 1 << 3,
  NO_FALLBACK_FOR_MOVE: 1 << 4,
  TARGET_DEFAULT_PERMS: 1 << 5
};

export default {
  File,
  Settings,
  FileCreateFlags,
  FileCopyFlags
};
