import { describe, it, expect } from 'vitest';
import {
  createEnum,
  rectContainsPoint,
  resolveWidth,
  resolveHeight,
  orientationFromGrab,
  positionFromGrabOp,
  grabMode,
  decomposeGrabOp,
  directionFromGrab,
  removeGapOnRect,
  allowResizeGrabOp
} from '../../../lib/extension/utils.js';
import { ORIENTATION_TYPES, POSITION } from '../../../lib/extension/tree.js';
import { GRAB_TYPES } from '../../../lib/extension/window.js';
import { GrabOp, MotionDirection } from '../../mocks/gnome/Meta.js';

describe('Utility Functions', () => {
  describe('createEnum', () => {
    it('should create frozen enum object', () => {
      const Colors = createEnum(['RED', 'GREEN', 'BLUE']);
      expect(Colors.RED).toBe('RED');
      expect(Colors.GREEN).toBe('GREEN');
      expect(Colors.BLUE).toBe('BLUE');
      expect(Object.isFrozen(Colors)).toBe(true);
    });

    it('should prevent modifications', () => {
      const Colors = createEnum(['RED']);
      expect(() => {
        'use strict';
        Colors.YELLOW = 'YELLOW';
      }).toThrow();
    });

    it('should handle empty array', () => {
      const Empty = createEnum([]);
      expect(Object.keys(Empty).length).toBe(0);
      expect(Object.isFrozen(Empty)).toBe(true);
    });

    it('should handle single value', () => {
      const Single = createEnum(['ONLY']);
      expect(Single.ONLY).toBe('ONLY');
      expect(Object.keys(Single).length).toBe(1);
    });
  });

  describe('rectContainsPoint', () => {
    it('should return true for point inside rect', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      expect(rectContainsPoint(rect, [50, 50])).toBe(true);
    });

    it('should return true for point at top-left corner', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      expect(rectContainsPoint(rect, [0, 0])).toBe(true);
    });

    it('should return true for point at bottom-right corner', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      expect(rectContainsPoint(rect, [100, 100])).toBe(true);
    });

    it('should return false for point outside rect', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      expect(rectContainsPoint(rect, [150, 150])).toBe(false);
    });

    it('should return false for point outside to the left', () => {
      const rect = { x: 10, y: 10, width: 100, height: 100 };
      expect(rectContainsPoint(rect, [5, 50])).toBe(false);
    });

    it('should return false for point outside above', () => {
      const rect = { x: 10, y: 10, width: 100, height: 100 };
      expect(rectContainsPoint(rect, [50, 5])).toBe(false);
    });

    it('should handle negative coordinates', () => {
      const rect = { x: -50, y: -50, width: 100, height: 100 };
      expect(rectContainsPoint(rect, [0, 0])).toBe(true);
      expect(rectContainsPoint(rect, [-100, 0])).toBe(false);
    });

    it('should return false for null rect', () => {
      expect(rectContainsPoint(null, [50, 50])).toBe(false);
    });

    it('should return false for null point', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      expect(rectContainsPoint(rect, null)).toBe(false);
    });
  });

  describe('resolveWidth', () => {
    const mockWindow = {
      get_frame_rect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      get_work_area_current_monitor: () => ({ x: 0, y: 0, width: 1920, height: 1080 })
    };

    it('should resolve absolute pixel values', () => {
      const result = resolveWidth({ width: 500 }, mockWindow);
      expect(result).toBe(500);
    });

    it('should resolve fractional values as percentage', () => {
      const result = resolveWidth({ width: 0.5 }, mockWindow);
      expect(result).toBe(960); // 1920 * 0.5
    });

    it('should resolve value of 1 as percentage', () => {
      const result = resolveWidth({ width: 1 }, mockWindow);
      expect(result).toBe(1920); // 1920 * 1
    });

    it('should return current width for undefined', () => {
      const result = resolveWidth({}, mockWindow);
      expect(result).toBe(800); // Current window width
    });
  });

  describe('resolveHeight', () => {
    const mockWindow = {
      get_frame_rect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      get_work_area_current_monitor: () => ({ x: 0, y: 0, width: 1920, height: 1080 })
    };

    it('should resolve absolute pixel values', () => {
      const result = resolveHeight({ height: 400 }, mockWindow);
      expect(result).toBe(400);
    });

    it('should resolve fractional values as percentage', () => {
      const result = resolveHeight({ height: 0.5 }, mockWindow);
      expect(result).toBe(540); // 1080 * 0.5
    });

    it('should return current height for undefined', () => {
      const result = resolveHeight({}, mockWindow);
      expect(result).toBe(600); // Current window height
    });
  });

  describe('orientationFromGrab', () => {
    it('should return VERTICAL for north resize', () => {
      const result = orientationFromGrab(GrabOp.RESIZING_N);
      expect(result).toBe(ORIENTATION_TYPES.VERTICAL);
    });

    it('should return VERTICAL for south resize', () => {
      const result = orientationFromGrab(GrabOp.RESIZING_S);
      expect(result).toBe(ORIENTATION_TYPES.VERTICAL);
    });

    it('should return HORIZONTAL for east resize', () => {
      const result = orientationFromGrab(GrabOp.RESIZING_E);
      expect(result).toBe(ORIENTATION_TYPES.HORIZONTAL);
    });

    it('should return HORIZONTAL for west resize', () => {
      const result = orientationFromGrab(GrabOp.RESIZING_W);
      expect(result).toBe(ORIENTATION_TYPES.HORIZONTAL);
    });

    it('should return NONE for moving operation', () => {
      const result = orientationFromGrab(GrabOp.MOVING);
      expect(result).toBe(ORIENTATION_TYPES.NONE);
    });

    it('should return NONE for no operation', () => {
      const result = orientationFromGrab(GrabOp.NONE);
      expect(result).toBe(ORIENTATION_TYPES.NONE);
    });
  });

  describe('positionFromGrabOp', () => {
    it('should return BEFORE for west resize', () => {
      const result = positionFromGrabOp(GrabOp.RESIZING_W);
      expect(result).toBe(POSITION.BEFORE);
    });

    it('should return BEFORE for north resize', () => {
      const result = positionFromGrabOp(GrabOp.RESIZING_N);
      expect(result).toBe(POSITION.BEFORE);
    });

    it('should return AFTER for east resize', () => {
      const result = positionFromGrabOp(GrabOp.RESIZING_E);
      expect(result).toBe(POSITION.AFTER);
    });

    it('should return AFTER for south resize', () => {
      const result = positionFromGrabOp(GrabOp.RESIZING_S);
      expect(result).toBe(POSITION.AFTER);
    });

    it('should return UNKNOWN for moving operation', () => {
      const result = positionFromGrabOp(GrabOp.MOVING);
      expect(result).toBe(POSITION.UNKNOWN);
    });
  });

  describe('grabMode', () => {
    it('should return RESIZING for resize operations', () => {
      expect(grabMode(GrabOp.RESIZING_N)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.RESIZING_S)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.RESIZING_E)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.RESIZING_W)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.RESIZING_NE)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.RESIZING_NW)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.RESIZING_SE)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.RESIZING_SW)).toBe(GRAB_TYPES.RESIZING);
    });

    it('should return RESIZING for keyboard resize operations', () => {
      expect(grabMode(GrabOp.KEYBOARD_RESIZING_N)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.KEYBOARD_RESIZING_S)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.KEYBOARD_RESIZING_E)).toBe(GRAB_TYPES.RESIZING);
      expect(grabMode(GrabOp.KEYBOARD_RESIZING_W)).toBe(GRAB_TYPES.RESIZING);
    });

    it('should return MOVING for move operations', () => {
      expect(grabMode(GrabOp.MOVING)).toBe(GRAB_TYPES.MOVING);
      expect(grabMode(GrabOp.KEYBOARD_MOVING)).toBe(GRAB_TYPES.MOVING);
      expect(grabMode(GrabOp.MOVING_UNCONSTRAINED)).toBe(GRAB_TYPES.MOVING);
    });

    it('should return UNKNOWN for no operation', () => {
      expect(grabMode(GrabOp.NONE)).toBe(GRAB_TYPES.UNKNOWN);
    });

    it('should ignore META_GRAB_OP_WINDOW_FLAG_UNCONSTRAINED flag', () => {
      // The function masks off the 1024 bit before checking
      const flaggedOp = GrabOp.MOVING | 1024;
      expect(grabMode(flaggedOp)).toBe(GRAB_TYPES.MOVING);
    });
  });

  describe('decomposeGrabOp', () => {
    it('should decompose NE corner resize into N and E', () => {
      const result = decomposeGrabOp(GrabOp.RESIZING_NE);
      expect(result).toEqual([GrabOp.RESIZING_N, GrabOp.RESIZING_E]);
    });

    it('should decompose NW corner resize into N and W', () => {
      const result = decomposeGrabOp(GrabOp.RESIZING_NW);
      expect(result).toEqual([GrabOp.RESIZING_N, GrabOp.RESIZING_W]);
    });

    it('should decompose SE corner resize into S and E', () => {
      const result = decomposeGrabOp(GrabOp.RESIZING_SE);
      expect(result).toEqual([GrabOp.RESIZING_S, GrabOp.RESIZING_E]);
    });

    it('should decompose SW corner resize into S and W', () => {
      const result = decomposeGrabOp(GrabOp.RESIZING_SW);
      expect(result).toEqual([GrabOp.RESIZING_S, GrabOp.RESIZING_W]);
    });

    it('should return single operation for non-corner resizes', () => {
      expect(decomposeGrabOp(GrabOp.RESIZING_N)).toEqual([GrabOp.RESIZING_N]);
      expect(decomposeGrabOp(GrabOp.RESIZING_S)).toEqual([GrabOp.RESIZING_S]);
      expect(decomposeGrabOp(GrabOp.RESIZING_E)).toEqual([GrabOp.RESIZING_E]);
      expect(decomposeGrabOp(GrabOp.RESIZING_W)).toEqual([GrabOp.RESIZING_W]);
    });

    it('should return single operation for moving', () => {
      expect(decomposeGrabOp(GrabOp.MOVING)).toEqual([GrabOp.MOVING]);
    });
  });

  describe('directionFromGrab', () => {
    it('should return RIGHT for east resize', () => {
      expect(directionFromGrab(GrabOp.RESIZING_E)).toBe(MotionDirection.RIGHT);
      expect(directionFromGrab(GrabOp.KEYBOARD_RESIZING_E)).toBe(MotionDirection.RIGHT);
    });

    it('should return LEFT for west resize', () => {
      expect(directionFromGrab(GrabOp.RESIZING_W)).toBe(MotionDirection.LEFT);
      expect(directionFromGrab(GrabOp.KEYBOARD_RESIZING_W)).toBe(MotionDirection.LEFT);
    });

    it('should return UP for north resize', () => {
      expect(directionFromGrab(GrabOp.RESIZING_N)).toBe(MotionDirection.UP);
      expect(directionFromGrab(GrabOp.KEYBOARD_RESIZING_N)).toBe(MotionDirection.UP);
    });

    it('should return DOWN for south resize', () => {
      expect(directionFromGrab(GrabOp.RESIZING_S)).toBe(MotionDirection.DOWN);
      expect(directionFromGrab(GrabOp.KEYBOARD_RESIZING_S)).toBe(MotionDirection.DOWN);
    });

    it('should return undefined for moving operations', () => {
      expect(directionFromGrab(GrabOp.MOVING)).toBeUndefined();
    });
  });

  describe('removeGapOnRect', () => {
    it('should expand rect by removing gap on all sides', () => {
      const rect = { x: 10, y: 10, width: 80, height: 80 };
      const gap = 5;
      const result = removeGapOnRect(rect, gap);

      expect(result.x).toBe(5);
      expect(result.y).toBe(5);
      expect(result.width).toBe(90);
      expect(result.height).toBe(90);
    });

    it('should handle zero gap', () => {
      const rect = { x: 10, y: 10, width: 80, height: 80 };
      const result = removeGapOnRect(rect, 0);

      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
      expect(result.width).toBe(80);
      expect(result.height).toBe(80);
    });

    it('should mutate original rect', () => {
      const rect = { x: 10, y: 10, width: 80, height: 80 };
      const result = removeGapOnRect(rect, 5);

      // Should be same object reference
      expect(result).toBe(rect);
    });

    it('should handle negative coordinates', () => {
      const rect = { x: -10, y: -10, width: 100, height: 100 };
      const gap = 10;
      const result = removeGapOnRect(rect, gap);

      expect(result.x).toBe(-20);
      expect(result.y).toBe(-20);
      expect(result.width).toBe(120);
      expect(result.height).toBe(120);
    });
  });

  describe('allowResizeGrabOp', () => {
    it('should return true for all resize operations', () => {
      expect(allowResizeGrabOp(GrabOp.RESIZING_N)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.RESIZING_S)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.RESIZING_E)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.RESIZING_W)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.RESIZING_NE)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.RESIZING_NW)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.RESIZING_SE)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.RESIZING_SW)).toBe(true);
    });

    it('should return true for keyboard resize operations', () => {
      expect(allowResizeGrabOp(GrabOp.KEYBOARD_RESIZING_N)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.KEYBOARD_RESIZING_S)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.KEYBOARD_RESIZING_E)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.KEYBOARD_RESIZING_W)).toBe(true);
      expect(allowResizeGrabOp(GrabOp.KEYBOARD_RESIZING_UNKNOWN)).toBe(true);
    });

    it('should return false for moving operations', () => {
      expect(allowResizeGrabOp(GrabOp.MOVING)).toBe(false);
      expect(allowResizeGrabOp(GrabOp.KEYBOARD_MOVING)).toBe(false);
    });

    it('should return false for no operation', () => {
      expect(allowResizeGrabOp(GrabOp.NONE)).toBe(false);
    });
  });
});
