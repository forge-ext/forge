import { describe, it, expect, beforeEach } from 'vitest';
import { createMockWindow, createMockWindowArray } from '../mocks/helpers/mockWindow.js';
import { Rectangle } from '../mocks/gnome/Meta.js';

/**
 * Integration tests demonstrating how to test window operations
 * using the mocked GNOME APIs without requiring a real GNOME Shell environment.
 *
 * These tests show realistic scenarios that would occur in the extension.
 */
describe('Window Operations Integration', () => {
  describe('Window Creation and Manipulation', () => {
    it('should create window with custom properties', () => {
      const window = createMockWindow({
        wm_class: 'Firefox',
        title: 'Mozilla Firefox',
        rect: { x: 100, y: 100, width: 800, height: 600 }
      });

      expect(window.get_wm_class()).toBe('Firefox');
      expect(window.get_title()).toBe('Mozilla Firefox');

      const rect = window.get_frame_rect();
      expect(rect.x).toBe(100);
      expect(rect.y).toBe(100);
      expect(rect.width).toBe(800);
      expect(rect.height).toBe(600);
    });

    it('should resize and move window', () => {
      const window = createMockWindow({
        rect: { x: 0, y: 0, width: 400, height: 300 }
      });

      // Resize and move
      window.move_resize_frame(false, 50, 50, 600, 450);

      const newRect = window.get_frame_rect();
      expect(newRect.x).toBe(50);
      expect(newRect.y).toBe(50);
      expect(newRect.width).toBe(600);
      expect(newRect.height).toBe(450);
    });

    it('should maximize and unmaximize window', () => {
      const window = createMockWindow();

      expect(window.maximized_horizontally).toBe(false);
      expect(window.maximized_vertically).toBe(false);

      window.maximize();

      expect(window.maximized_horizontally).toBe(true);
      expect(window.maximized_vertically).toBe(true);

      window.unmaximize();

      expect(window.maximized_horizontally).toBe(false);
      expect(window.maximized_vertically).toBe(false);
    });

    it('should handle fullscreen toggling', () => {
      const window = createMockWindow();

      expect(window.is_fullscreen()).toBe(false);

      window.make_fullscreen();
      expect(window.is_fullscreen()).toBe(true);

      window.unmake_fullscreen();
      expect(window.is_fullscreen()).toBe(false);
    });

    it('should minimize and unminimize window', () => {
      const window = createMockWindow();

      expect(window.minimized).toBe(false);

      window.minimize();
      expect(window.minimized).toBe(true);

      window.unminimize();
      expect(window.minimized).toBe(false);
    });
  });

  describe('Window Signals', () => {
    it('should connect and trigger signal handlers', () => {
      const window = createMockWindow();
      let callbackCalled = false;
      let callbackArg = null;

      const signalId = window.connect('size-changed', (arg) => {
        callbackCalled = true;
        callbackArg = arg;
      });

      expect(signalId).toBeDefined();

      // Emit the signal
      window.emit('size-changed', 'test-arg');

      expect(callbackCalled).toBe(true);
      expect(callbackArg).toBe('test-arg');
    });

    it('should disconnect signal handlers', () => {
      const window = createMockWindow();
      let callCount = 0;

      const signalId = window.connect('size-changed', () => {
        callCount++;
      });

      window.emit('size-changed');
      expect(callCount).toBe(1);

      window.disconnect(signalId);

      window.emit('size-changed');
      expect(callCount).toBe(1); // Should not increment
    });

    it('should handle multiple signals on same window', () => {
      const window = createMockWindow();
      let sizeChanges = 0;
      let focusChanges = 0;

      window.connect('size-changed', () => sizeChanges++);
      window.connect('focus', () => focusChanges++);

      window.emit('size-changed');
      window.emit('focus');
      window.emit('size-changed');

      expect(sizeChanges).toBe(2);
      expect(focusChanges).toBe(1);
    });
  });

  describe('Rectangle Operations', () => {
    it('should check if rectangles are equal', () => {
      const rect1 = new Rectangle({ x: 0, y: 0, width: 100, height: 100 });
      const rect2 = new Rectangle({ x: 0, y: 0, width: 100, height: 100 });
      const rect3 = new Rectangle({ x: 10, y: 10, width: 100, height: 100 });

      expect(rect1.equal(rect2)).toBe(true);
      expect(rect1.equal(rect3)).toBe(false);
    });

    it('should check if rectangle contains another', () => {
      const outer = new Rectangle({ x: 0, y: 0, width: 200, height: 200 });
      const inner = new Rectangle({ x: 50, y: 50, width: 50, height: 50 });
      const outside = new Rectangle({ x: 250, y: 250, width: 50, height: 50 });

      expect(outer.contains_rect(inner)).toBe(true);
      expect(outer.contains_rect(outside)).toBe(false);
    });

    it('should check if rectangles overlap', () => {
      const rect1 = new Rectangle({ x: 0, y: 0, width: 100, height: 100 });
      const rect2 = new Rectangle({ x: 50, y: 50, width: 100, height: 100 });
      const rect3 = new Rectangle({ x: 200, y: 200, width: 100, height: 100 });

      expect(rect1.overlap(rect2)).toBe(true);
      expect(rect1.overlap(rect3)).toBe(false);
    });

    it('should copy rectangle', () => {
      const original = new Rectangle({ x: 10, y: 20, width: 100, height: 200 });
      const copy = original.copy();

      expect(copy.equal(original)).toBe(true);
      expect(copy).not.toBe(original); // Different object

      // Modifying copy shouldn't affect original
      copy.x = 50;
      expect(original.x).toBe(10);
    });
  });

  describe('Multiple Windows Scenario', () => {
    it('should manage multiple windows independently', () => {
      const windows = createMockWindowArray(3, {
        rect: { x: 0, y: 0, width: 640, height: 480 }
      });

      expect(windows).toHaveLength(3);

      // Each window should have unique ID
      const ids = windows.map(w => w.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      // Each window should have same initial rect
      windows.forEach(w => {
        const rect = w.get_frame_rect();
        expect(rect.width).toBe(640);
        expect(rect.height).toBe(480);
      });

      // Modify one window
      windows[0].move_resize_frame(false, 100, 100, 800, 600);

      // Others should remain unchanged
      expect(windows[1].get_frame_rect().width).toBe(640);
      expect(windows[2].get_frame_rect().width).toBe(640);
      expect(windows[0].get_frame_rect().width).toBe(800);
    });

    it('should track window states independently', () => {
      const windows = createMockWindowArray(2);

      windows[0].maximize();
      windows[1].minimize();

      expect(windows[0].maximized_horizontally).toBe(true);
      expect(windows[0].minimized).toBe(false);

      expect(windows[1].maximized_horizontally).toBe(false);
      expect(windows[1].minimized).toBe(true);
    });
  });

  describe('Realistic Tiling Scenario', () => {
    it('should tile two windows side by side', () => {
      const monitor = new Rectangle({ x: 0, y: 0, width: 1920, height: 1080 });

      const window1 = createMockWindow({ wm_class: 'Terminal' });
      const window2 = createMockWindow({ wm_class: 'Browser' });

      // Tile left half
      window1.move_resize_frame(
        false,
        monitor.x,
        monitor.y,
        monitor.width / 2,
        monitor.height
      );

      // Tile right half
      window2.move_resize_frame(
        false,
        monitor.x + monitor.width / 2,
        monitor.y,
        monitor.width / 2,
        monitor.height
      );

      const rect1 = window1.get_frame_rect();
      const rect2 = window2.get_frame_rect();

      // Check left window
      expect(rect1.x).toBe(0);
      expect(rect1.width).toBe(960);
      expect(rect1.height).toBe(1080);

      // Check right window
      expect(rect2.x).toBe(960);
      expect(rect2.width).toBe(960);
      expect(rect2.height).toBe(1080);

      // Windows should not overlap
      expect(rect1.overlap(rect2)).toBe(false);
    });

    it('should tile four windows in a grid', () => {
      const monitor = new Rectangle({ x: 0, y: 0, width: 1920, height: 1080 });
      const windows = createMockWindowArray(4);

      const halfWidth = monitor.width / 2;
      const halfHeight = monitor.height / 2;

      // Top-left
      windows[0].move_resize_frame(false, 0, 0, halfWidth, halfHeight);

      // Top-right
      windows[1].move_resize_frame(false, halfWidth, 0, halfWidth, halfHeight);

      // Bottom-left
      windows[2].move_resize_frame(false, 0, halfHeight, halfWidth, halfHeight);

      // Bottom-right
      windows[3].move_resize_frame(false, halfWidth, halfHeight, halfWidth, halfHeight);

      // Verify each window occupies exactly 1/4 of the screen
      windows.forEach(window => {
        const rect = window.get_frame_rect();
        expect(rect.width).toBe(960);
        expect(rect.height).toBe(540);
      });

      // Verify total coverage
      const totalArea = windows.reduce((sum, window) => {
        const rect = window.get_frame_rect();
        return sum + (rect.width * rect.height);
      }, 0);

      const monitorArea = monitor.width * monitor.height;
      expect(totalArea).toBe(monitorArea);
    });
  });

  describe('Window Work Area Calculations', () => {
    it('should get work area for current monitor', () => {
      const window = createMockWindow();
      const workArea = window.get_work_area_current_monitor();

      expect(workArea.width).toBe(1920);
      expect(workArea.height).toBe(1080);
    });

    it('should calculate window position relative to monitor', () => {
      const window = createMockWindow({
        rect: { x: 100, y: 50, width: 800, height: 600 }
      });

      const workArea = window.get_work_area_current_monitor();
      const windowRect = window.get_frame_rect();

      // Window should be within work area bounds
      expect(windowRect.x).toBeLessThan(workArea.width);
      expect(windowRect.y).toBeLessThan(workArea.height);
      expect(windowRect.x + windowRect.width).toBeLessThanOrEqual(workArea.width + windowRect.x);
    });
  });
});
