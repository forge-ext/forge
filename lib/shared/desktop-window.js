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

/**
 * Desktop Icons NG (DING) draws the desktop as an ordinary window on Wayland
 * and only later calls set_type(DESKTOP), so the window type alone is not
 * enough at creation time. Tiling extensions treat it as a tile, unmaximize it,
 * and DING re-maximizes itself and raises the desktop above every window
 * (pop-os/shell#1658).
 *
 * DING titles the window `Desktop Icons <monitor+1>` (hardcoded in
 * desktopManager.js, not translated) on current releases, and older/other
 * builds encode the position as `@!<x>,<y>;BDHF`.
 *
 * Kept free of gi:// imports so the matching rules can be unit tested.
 */
export const DING_DESKTOP_TITLE = /^(?:Desktop Icons \d+$|@!-?\d+,-?\d+;BDH)/;

/**
 * True when a window title identifies a desktop surface drawn by DING.
 */
export function isDesktopWindowTitle(title) {
  return typeof title === "string" && DING_DESKTOP_TITLE.test(title);
}
