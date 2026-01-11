// Export all GNOME mocks

import * as MetaMock from './Meta.js';
import * as GLibMock from './GLib.js';
import * as GioMock from './Gio.js';
import * as ShellMock from './Shell.js';
import * as StMock from './St.js';
import * as ClutterMock from './Clutter.js';
import * as GObjectMock from './GObject.js';

export const Meta = MetaMock;
export const GLib = GLibMock;
export const Gio = GioMock;
export const Shell = ShellMock;
export const St = StMock;
export const Clutter = ClutterMock;
export const GObject = GObjectMock;

export default {
  Meta,
  GLib,
  Gio,
  Shell,
  St,
  Clutter,
  GObject
};
