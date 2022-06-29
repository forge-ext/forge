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

"use strict";

// Gnome imports
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

// Gnome-shell imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Logger = Me.imports.logger;
const Settings = Me.imports.settings;
const Tree = Me.imports.tree;
const Window = Me.imports.window;

/**
 *
 * Turns an array into an immutable enum-like object
 *
 */
function createEnum(anArray) {
  const enumObj = {};
  for (const val of anArray) {
    enumObj[val] = val;
  }
  return Object.freeze(enumObj);
}

function resolveX(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = metaWindow.get_work_area_current_monitor();
  let val = metaRect.x;
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

function resolveY(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = metaWindow.get_work_area_current_monitor();
  let val = metaRect.y;
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

function resolveWidth(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = metaWindow.get_work_area_current_monitor();
  let val = metaRect.width;
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

function resolveHeight(rectRequest, metaWindow) {
  let metaRect = metaWindow.get_frame_rect();
  let monitorRect = metaWindow.get_work_area_current_monitor();
  let val = metaRect.height;
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

function orientationFromDirection(direction) {
  return direction === Meta.MotionDirection.LEFT || direction === Meta.MotionDirection.RIGHT
    ? Tree.ORIENTATION_TYPES.HORIZONTAL
    : Tree.ORIENTATION_TYPES.VERTICAL;
}

function orientationFromLayout(layout) {
  switch (layout) {
    case Tree.LAYOUT_TYPES.HSPLIT:
    case Tree.LAYOUT_TYPES.TABBED:
      return Tree.ORIENTATION_TYPES.HORIZONTAL;
    case Tree.LAYOUT_TYPES.VSPLIT:
    case Tree.LAYOUT_TYPES.STACKED:
      return Tree.ORIENTATION_TYPES.VERTICAL;
    default:
      break;
  }
}

function positionFromDirection(direction) {
  return direction === Meta.MotionDirection.LEFT || direction === Meta.MotionDirection.UP
    ? Tree.POSITION.BEFORE
    : Tree.POSITION.AFTER;
}

function resolveDirection(directionString) {
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

function directionFrom(position, orientaton) {
  if (position === Tree.POSITION.AFTER) {
    if (orientaton === Tree.ORIENTATION_TYPES.HORIZONTAL) {
      return Meta.DisplayDirection.RIGHT;
    } else {
      return Meta.DisplayDirection.DOWN;
    }
  } else if (position === Tree.POSITION.BEFORE) {
    if (orientaton === Tree.ORIENTATION_TYPES.HORIZONTAL) {
      return Meta.DisplayDirection.LEFT;
    } else {
      return Meta.DisplayDirection.UP;
    }
  }
}

function rectContainsPoint(rect, pointP) {
  if (!(rect && pointP)) return false;
  return (
    rect.x <= pointP[0] &&
    pointP[0] <= rect.x + rect.width &&
    rect.y <= pointP[1] &&
    pointP[1] <= rect.y + rect.height
  );
}

function orientationFromGrab(grabOp) {
  if (
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S
  ) {
    return Tree.ORIENTATION_TYPES.VERTICAL;
  } else if (
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W
  ) {
    return Tree.ORIENTATION_TYPES.HORIZONTAL;
  }
  return Tree.ORIENTATION_TYPES.NONE;
}

function positionFromGrabOp(grabOp) {
  if (
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N
  ) {
    return Tree.POSITION.BEFORE;
  } else if (
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S
  ) {
    return Tree.POSITION.AFTER;
  }
  return Tree.POSITION.UNKNOWN;
}

function allowResizeGrabOp(grabOp) {
  return (
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN
  );
}

function grabMode(grabOp) {
  if (
    grabOp === Meta.GrabOp.RESIZING_N ||
    grabOp === Meta.GrabOp.RESIZING_E ||
    grabOp === Meta.GrabOp.RESIZING_W ||
    grabOp === Meta.GrabOp.RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_N ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_E ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_W ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_S ||
    grabOp === Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN
  ) {
    return Window.GRAB_TYPES.RESIZING;
  } else if (grabOp === Meta.GrabOp.KEYBOARD_MOVING || grabOp === Meta.GrabOp.MOVING) {
    return Window.GRAB_TYPES.MOVING;
  }
  return Window.GRAB_TYPES.UNKNOWN;
}

function directionFromGrab(grabOp) {
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

function removeGapOnRect(rectWithGap, gap) {
  rectWithGap.x = rectWithGap.x -= gap;
  rectWithGap.y = rectWithGap.y -= gap;
  rectWithGap.width = rectWithGap.width += gap * 2;
  rectWithGap.height = rectWithGap.height += gap * 2;
  return rectWithGap;
}

// Credits: PopShell
function findWindowWith(title) {
  let display = global.display;
  let type = Meta.TabList.NORMAL_ALL;
  let workspaceMgr = display.get_workspace_manager();
  let workspaces = workspaceMgr.get_n_workspaces();

  for (let wsId = 1; wsId <= workspaces; wsId++) {
    let workspace = workspaceMgr.get_workspace_by_index(wsId);
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

function oppositeDirectionOf(direction) {
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

function monitorIndex(monitorValue) {
  if (!monitorValue) return -1;
  let wsIndex = monitorValue.indexOf("ws");
  let indexVal = monitorValue.slice(0, wsIndex);
  indexVal = indexVal.replace("mo", "");
  return parseInt(indexVal);
}

function translateModifierType(name) {
  if (name === "Super" || name === "<Super>") {
    return Gdk.ModifierType.MOD4_MASK;
  }
  if (name === "Ctrl" || name === "<Ctrl>") {
    return Gdk.ModifierType.CONTROL_MASK;
  }
  if (name === "Alt" || name === "<Alt>") {
    return Gdk.ModifierType.MOD1_MASK;
  }
  if (name === "Shift" || name === "<Shift>") {
    return Gdk.ModifierType.SHIFT_MASK;
  }
}

function _disableDecorations() {
  let decos = global.window_group.get_children().filter((a) => a.type != null);
  decos.forEach((d) => {
    global.window_group.remove_child(d);
    d.destroy();
  });
}

function dpi() {
  return St.ThemeContext.get_for_stage(global.stage).scale_factor;
}
