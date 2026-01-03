// Register global mocks before tests run
import { vi } from 'vitest';
import * as GnomeMocks from './mocks/gnome/index.js';

// Mock the gi:// import scheme used by GNOME Shell ESM
// The extension uses: import Meta from "gi://Meta"
vi.mock('gi://Meta', () => GnomeMocks.Meta);
vi.mock('gi://Gio', () => GnomeMocks.Gio);
vi.mock('gi://GLib', () => GnomeMocks.GLib);
vi.mock('gi://Shell', () => GnomeMocks.Shell);
vi.mock('gi://St', () => GnomeMocks.St);
vi.mock('gi://Clutter', () => GnomeMocks.Clutter);
vi.mock('gi://GObject', () => GnomeMocks.GObject);

// Mock GNOME Shell resources
vi.mock('resource:///org/gnome/shell/misc/config.js', () => ({
  PACKAGE_VERSION: '47.0'
}));

// Mock Extension class for extension.js
global.Extension = class Extension {
  constructor() {
    this.metadata = {};
    this.dir = { get_path: () => '/mock/path' };
  }
  getSettings() { return GnomeMocks.Gio.Settings.new(); }
};
