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
 * Credits:
 * This file has some code from Dash-To-Panel extension: convenience.js
 * Some code was also adapted from the upstream Gnome Shell source code.
 */

// Gnome imports
import Meta from "gi://Meta";
import St from "gi://St";

// Gnome-shell imports
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";

// App imports
import { ORIENTATION_TYPES, LAYOUT_TYPES, POSITION } from "./tree.js";
import { GRAB_TYPES } from "./window.js";

const [major] = PACKAGE_VERSION.split(".").map((s) => Number(s));

/**
 * A Meta.Window can transiently report get_monitor() === -1 on Wayland while
 * it is being placed or a monitor is changing. Return -1 unless the index maps
 * to a real monitor, so callers have one validity check.
 */
export function getWindowMonitorSafe(metaWindow) {
  if (!metaWindow || typeof metaWindow.get_monitor !== "function") return -1;
  try {
    const monitorIndex = metaWindow.get_monitor();
    const monitorCount = global.display.get_n_monitors();
    if (!Number.isInteger(monitorIndex) || monitorIndex < 0 || monitorIndex >= monitorCount) {
      return -1;
    }
    return monitorIndex;
  } catch (e) {
    return -1;
  }
}

/**
 * Mutter asserts inside get_work_area_current_monitor() when a window has no
 * logical monitor. Wayland can briefly report get_monitor() === -1 while a
 * window is being placed, so validate the monitor before calling into Mutter.
 */
export function getWorkAreaSafe(metaWindow) {
  if (getWindowMonitorSafe(metaWindow) < 0) return null;

  try {
    return metaWindow.get_work_area_current_monitor();
  } catch (e) {
    return null;
  }
}

/**
 * get_work_area_for_monitor() throws, or returns null, for an invalid index or
 * a wrapper that was finalized between the liveness check and this call.
 */
export function getWorkAreaForMonitorSafe(metaWindow, monitorIndex) {
  if (!metaWindow || typeof metaWindow.get_work_area_for_monitor !== "function") return null;
  const monitorCount = global.display.get_n_monitors();
  if (!Number.isInteger(monitorIndex) || monitorIndex < 0 || monitorIndex >= monitorCount) {
    return null;
  }
  try {
    return metaWindow.get_work_area_for_monitor(monitorIndex) || null;
  } catch (e) {
    return null;
  }
}

/**
 * get_monitor_geometry() returns null for an invalid monitor index, and
 * get_current_monitor() can transiently return -1 during monitors-changed /
 * startup. Gate on the index and coerce a null return, so callers get one
 * null-check idiom instead of hand-rolling it at each site.
 */
export function getMonitorGeometrySafe(index) {
  if (index == null || index < 0) return null;
  return global.display.get_monitor_geometry(index) || null;
}

/**
 *
 * Turns an array into an immutable enum-like object
 *
 */
export function createEnum(anArray) {
  const enumObj = {};
  for (const val of anArray) {
    enumObj[val] = val;
  }
  return Object.freeze(enumObj);
}

export function resolveX(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = getWorkAreaSafe(metaWindow);
  let val = metaRect.x;
  if (!monitorRect) return val;
  // Resolve x in work-area coordinates before adding its absolute origin below.
  // Otherwise an omitted or unknown x would add the monitor origin twice.
  val = metaRect.x - monitorRect.x;
  let x = rectRequest.x;
  switch (typeof x) {
    case "string": //center,
      switch (x) {
        case "center":
          val = monitorRect.width * 0.5 - this.resolveWidth(rectRequest, metaWindow) * 0.5;
          break;
        case "left":
          val = 0;
          break;
        case "right":
          val = monitorRect.width - this.resolveWidth(rectRequest, metaWindow);
          break;
        default:
          break;
      }
      break;
    case "number":
      val = x;
      break;
    default:
      break;
  }
  val = monitorRect.x + val;
  return val;
}

export function resolveY(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = getWorkAreaSafe(metaWindow);
  let val = metaRect.y;
  if (!monitorRect) return val;
  // resolveY uses work-area-relative coordinates, then adds the absolute origin.
  // Preserve the current position when y is omitted or unrecognized.
  val = metaRect.y - monitorRect.y;
  let y = rectRequest.y;
  switch (typeof y) {
    case "string": //center,
      switch (y) {
        case "center":
          val = monitorRect.height * 0.5 - this.resolveHeight(rectRequest, metaWindow) * 0.5;
          break;
        case "top":
          val = 0;
          break;
        case "bottom": // inverse of y=0
          val = monitorRect.height - this.resolveHeight(rectRequest, metaWindow);
          break;
        default:
          break;
      }
      break;
    case "number":
      val = y;
      break;
    default:
      break;
  }
  val = monitorRect.y + val;
  return val;
}

export function resolveWidth(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = getWorkAreaSafe(metaWindow);
  let val = metaRect.width;
  if (!monitorRect) return val;
  let width = rectRequest.width;
  switch (typeof width) {
    case "number":
      if (Number.isInteger(width) && width != 1) {
        val = width;
      } else {
        let monitorWidth = monitorRect.width;
        val = monitorWidth * width;
      }
      break;
    default:
      break;
  }
  return val;
}

export function resolveHeight(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = getWorkAreaSafe(metaWindow);
  let val = metaRect.height;
  if (!monitorRect) return val;
  let height = rectRequest.height;
  switch (typeof height) {
    case "number":
      if (Number.isInteger(height) && height != 1) {
        val = height;
      } else {
        let monitorHeight = monitorRect.height;
        val = monitorHeight * height;
      }
      break;
    default:
      break;
  }
  return val;
}

export function orientationFromDirection(direction) {
  return direction === Meta.MotionDirection.LEFT || direction === Meta.MotionDirection.RIGHT
    ? ORIENTATION_TYPES.HORIZONTAL
    : ORIENTATION_TYPES.VERTICAL;
}

export function orientationFromLayout(layout) {
  switch (layout) {
    case LAYOUT_TYPES.HSPLIT:
    case LAYOUT_TYPES.TABBED:
      return ORIENTATION_TYPES.HORIZONTAL;
    case LAYOUT_TYPES.VSPLIT:
    case LAYOUT_TYPES.STACKED:
      return ORIENTATION_TYPES.VERTICAL;
    default:
      break;
  }
}

export function positionFromDirection(direction) {
  return direction === Meta.MotionDirection.LEFT || direction === Meta.MotionDirection.UP
    ? POSITION.BEFORE
    : POSITION.AFTER;
}

export function resolveDirection(directionString) {
  if (directionString) {
    directionString = directionString.toUpperCase();

    if (directionString === "LEFT") {
      return Meta.MotionDirection.LEFT;
    }

    if (directionString === "RIGHT") {
      return Meta.MotionDirection.RIGHT;
    }

    if (directionString === "UP") {
      return Meta.MotionDirection.UP;
    }

    if (directionString === "DOWN") {
      return Meta.MotionDirection.DOWN;
    }
  }

  return null;
}

export function directionFrom(position, orientation) {
  if (position === POSITION.AFTER) {
    if (orientation === ORIENTATION_TYPES.HORIZONTAL) {
      return Meta.DisplayDirection.RIGHT;
    } else {
      return Meta.DisplayDirection.DOWN;
    }
  } else if (position === POSITION.BEFORE) {
    if (orientation === ORIENTATION_TYPES.HORIZONTAL) {
      return Meta.DisplayDirection.LEFT;
    } else {
      return Meta.DisplayDirection.UP;
    }
  }
}

export function rectContainsPoint(rect, pointP) {
  if (!(rect && pointP)) return false;
  return (
    rect.x <= pointP[0] &&
    pointP[0] <= rect.x + rect.width &&
    rect.y <= pointP[1] &&
    pointP[1] <= rect.y + rect.height
  );
}

export function orientationFromGrab(grabOp) {
  if (
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S
  ) {
    return ORIENTATION_TYPES.VERTICAL;
  } else if (
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W
  ) {
    return ORIENTATION_TYPES.HORIZONTAL;
  }
  return ORIENTATION_TYPES.NONE;
}

export function positionFromGrabOp(grabOp) {
  if (
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N
  ) {
    return POSITION.BEFORE;
  } else if (
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S
  ) {
    return POSITION.AFTER;
  }
  return POSITION.UNKNOWN;
}

export function allowResizeGrabOp(grabOp) {
  grabOp &= ~1024; // ignore META_GRAB_OP_WINDOW_FLAG_UNCONSTRAINED
  return (
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.RESIZING_NE ||
    grabOp === Meta.GrabOp.RESIZING_NW ||
    grabOp === Meta.GrabOp.RESIZING_SE ||
    grabOp === Meta.GrabOp.RESIZING_SW ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN
  );
}

export function grabMode(grabOp) {
  grabOp &= ~1024; // ignore META_GRAB_OP_WINDOW_FLAG_UNCONSTRAINED
  if (
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.RESIZING_NE ||
    grabOp === Meta.GrabOp.RESIZING_NW ||
    grabOp === Meta.GrabOp.RESIZING_SE ||
    grabOp === Meta.GrabOp.RESIZING_SW ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN
  ) {
    return GRAB_TYPES.RESIZING;
  } else if (
    grabOp === Meta.GrabOp.KEYBOARD_MOVING ||
    grabOp === Meta.GrabOp.MOVING ||
    grabOp === Meta.GrabOp.MOVING_UNCONSTRAINED
  ) {
    return GRAB_TYPES.MOVING;
  }
  return GRAB_TYPES.UNKNOWN;
}

export function decomposeGrabOp(grabOp) {
  grabOp &= ~1024; // ignore META_GRAB_OP_WINDOW_FLAG_UNCONSTRAINED
  switch (grabOp) {
    case Meta.GrabOp.RESIZING_NE:
      return [Meta.GrabOp.RESIZING_N, Meta.GrabOp.RESIZING_E];
    case Meta.GrabOp.RESIZING_NW:
      return [Meta.GrabOp.RESIZING_N, Meta.GrabOp.RESIZING_W];
    case Meta.GrabOp.RESIZING_SE:
      return [Meta.GrabOp.RESIZING_S, Meta.GrabOp.RESIZING_E];
    case Meta.GrabOp.RESIZING_SW:
      return [Meta.GrabOp.RESIZING_S, Meta.GrabOp.RESIZING_W];
    default:
      return [grabOp];
  }
}

export function directionFromGrab(grabOp) {
  if (grabOp === Meta.GrabOp.RESIZING_E || grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E) {
    return Meta.MotionDirection.RIGHT;
  } else if (grabOp === Meta.GrabOp.RESIZING_W || grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W) {
    return Meta.MotionDirection.LEFT;
  } else if (grabOp === Meta.GrabOp.RESIZING_N || grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N) {
    return Meta.MotionDirection.UP;
  } else if (grabOp === Meta.GrabOp.RESIZING_S || grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S) {
    return Meta.MotionDirection.DOWN;
  }
}

export function removeGapOnRect(rectWithGap, gap) {
  rectWithGap.x = rectWithGap.x -= gap;
  rectWithGap.y = rectWithGap.y -= gap;
  rectWithGap.width = rectWithGap.width += gap * 2;
  rectWithGap.height = rectWithGap.height += gap * 2;
  return rectWithGap;
}

// Credits: PopShell
export function findWindowWith(title) {
  let display = global.display;
  let type = Meta.TabList.NORMAL_ALL;
  let workspaceMgr = display.get_workspace_manager();
  let workspaces = workspaceMgr.get_n_workspaces();

  for (let wsId = 0; wsId < workspaces; wsId++) {
    let workspace = workspaceMgr.get_workspace_by_index(wsId);
    if (!workspace) continue;
    for (const metaWindow of display.get_tab_list(type, workspace)) {
      if (
        metaWindow.title &&
        title &&
        (metaWindow.title === title || metaWindow.title.includes(title))
      ) {
        return metaWindow;
      }
    }
  }

  return undefined;
}

export function oppositeDirectionOf(direction) {
  if (direction === Meta.MotionDirection.LEFT) {
    return Meta.MotionDirection.RIGHT;
  } else if (direction === Meta.MotionDirection.RIGHT) {
    return Meta.MotionDirection.LEFT;
  } else if (direction === Meta.MotionDirection.UP) {
    return Meta.MotionDirection.DOWN;
  } else if (direction === Meta.MotionDirection.DOWN) {
    return Meta.MotionDirection.UP;
  }
}

export function monitorIndex(monitorValue) {
  if (!monitorValue) return -1;
  let wsIndex = monitorValue.indexOf("ws");
  let indexVal = monitorValue.slice(0, wsIndex);
  indexVal = indexVal.replace("mo", "");
  return parseInt(indexVal);
}

export function createMonitorWorkspaceId(monitorIndex, workspaceIndex) {
  return `mo${monitorIndex}ws${workspaceIndex}`;
}

export function _disableDecorations() {
  let decos = global.window_group.get_children().filter((a) => a.type != null);
  decos.forEach((d) => {
    global.window_group.remove_child(d);
    d.destroy();
  });
}

export function dpi() {
  return St.ThemeContext.get_for_stage(global.stage).scale_factor;
}

export function isGnome(majorVersion) {
  return major == majorVersion;
}

export function isGnomeGTE(majorVersion) {
  return major >= majorVersion;
}

/**
 * True while Mutter still manages the window. A wrapper can remain alive
 * after its compositor actor has gone away; raise/focus/activate on it then
 * hit Mutter assertions during close and swap races.
 */
export function isWindowManaged(metaWindow) {
  if (!metaWindow || metaWindow._forgeDead) return false;
  try {
    return Boolean(metaWindow.get_compositor_private());
  } catch (e) {
    return false;
  }
}

export function safeRaise(metaWindow) {
  if (isWindowManaged(metaWindow)) metaWindow.raise();
}

export function safeFocus(metaWindow, time) {
  if (isWindowManaged(metaWindow)) metaWindow.focus(time);
}

export function safeActivate(metaWindow, time) {
  if (isWindowManaged(metaWindow)) metaWindow.activate(time);
}
