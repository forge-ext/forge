import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WindowManager, WINDOW_MODES } from '../../../lib/extension/window.js';
import { Tree, NODE_TYPES, LAYOUT_TYPES } from '../../../lib/extension/tree.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { Workspace, WindowType, Rectangle } from '../../mocks/gnome/Meta.js';
import * as Utils from '../../../lib/extension/utils.js';

/**
 * WindowManager pointer & focus management tests
 *
 * Tests for focus-related operations including:
 * - findNodeWindowAtPointer(): Find window under pointer
 * - canMovePointerInsideNodeWindow(): Check if pointer can be moved inside window
 * - warpPointerToNodeWindow(): Warp pointer to window
 * - movePointerWith(): Move pointer with window focus
 * - _focusWindowUnderPointer(): Focus window under pointer (hover mode)
 * - pointerIsOverParentDecoration(): Check if pointer is over parent decoration
 */
describe('WindowManager - Pointer & Focus Management', () => {
  let windowManager;
  let mockExtension;
  let mockSettings;
  let mockConfigMgr;
  let workspace0;
  let mockSeat;

  beforeEach(() => {
    // Create workspace
    workspace0 = new Workspace({ index: 0 });

    // Mock Clutter seat
    mockSeat = {
      warp_pointer: vi.fn()
    };

    // Mock Clutter backend
    const mockBackend = {
      get_default_seat: vi.fn(() => mockSeat)
    };

    global.Clutter = {
      get_default_backend: vi.fn(() => mockBackend)
    };

    // Mock global.get_pointer
    global.get_pointer = vi.fn(() => [960, 540]);

    // Mock global.get_window_actors
    global.get_window_actors = vi.fn(() => []);

    // Mock global display and workspace manager
    global.display = {
      get_workspace_manager: vi.fn(),
      get_n_monitors: vi.fn(() => 1),
      get_focus_window: vi.fn(() => null),
      get_current_monitor: vi.fn(() => 0),
      get_current_time: vi.fn(() => 12345),
      get_monitor_geometry: vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 })),
      sort_windows_by_stacking: vi.fn((windows) => windows)
    };

    global.workspace_manager = {
      get_n_workspaces: vi.fn(() => 1),
      get_workspace_by_index: vi.fn((i) => i === 0 ? workspace0 : new Workspace({ index: i })),
      get_active_workspace_index: vi.fn(() => 0),
      get_active_workspace: vi.fn(() => workspace0)
    };

    global.display.get_workspace_manager.mockReturnValue(global.workspace_manager);

    global.window_group = {
      contains: vi.fn(() => false),
      add_child: vi.fn(),
      remove_child: vi.fn()
    };

    global.get_current_time = vi.fn(() => 12345);

    // Mock Main.overview
    global.Main = {
      overview: {
        visible: false
      }
    };

    // Mock settings
    mockSettings = {
      get_boolean: vi.fn((key) => {
        if (key === 'tiling-mode-enabled') return true;
        if (key === 'focus-on-hover-enabled') return false;
        if (key === 'move-pointer-focus-enabled') return false;
        return false;
      }),
      get_uint: vi.fn(() => 0),
      get_string: vi.fn(() => ''),
      set_boolean: vi.fn(),
      set_uint: vi.fn(),
      set_string: vi.fn()
    };

    // Mock config manager
    mockConfigMgr = {
      windowProps: {
        overrides: []
      }
    };

    // Mock extension
    mockExtension = {
      metadata: { version: '1.0.0' },
      settings: mockSettings,
      configMgr: mockConfigMgr,
      keybindings: null,
      theme: {
        loadStylesheet: vi.fn()
      }
    };

    // Create WindowManager
    windowManager = new WindowManager(mockExtension);
  });

  afterEach(() => {
    // Clean up any GLib timeout that may have been created
    if (windowManager._pointerFocusTimeoutId) {
      vi.clearAllTimers();
    }
  });

  describe('findNodeWindowAtPointer()', () => {
    it('should find window under pointer', () => {
      const metaWindow1 = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });
      const metaWindow2 = createMockWindow({
        rect: new Rectangle({ x: 960, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      // Mock sortedWindows
      Object.defineProperty(windowManager, 'sortedWindows', {
        get: () => [metaWindow2, metaWindow1],
        configurable: true
      });

      // Pointer at (970, 540) - inside second window
      global.get_pointer.mockReturnValue([970, 540]);

      const result = windowManager.findNodeWindowAtPointer(nodeWindow1);

      expect(result).toBe(nodeWindow2);
    });

    it('should return null when no window under pointer', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Mock sortedWindows
      Object.defineProperty(windowManager, 'sortedWindows', {
        get: () => [metaWindow],
        configurable: true
      });

      // Pointer outside all windows
      global.get_pointer.mockReturnValue([1500, 540]);

      const result = windowManager.findNodeWindowAtPointer(nodeWindow);

      expect(result).toBe(null);
    });

    it('should handle overlapping windows (return topmost)', () => {
      const metaWindow1 = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 1000, height: 1000 }),
        workspace: workspace0
      });
      const metaWindow2 = createMockWindow({
        rect: new Rectangle({ x: 100, y: 100, width: 800, height: 800 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      // Mock sortedWindows (window2 is on top)
      Object.defineProperty(windowManager, 'sortedWindows', {
        get: () => [metaWindow2, metaWindow1],
        configurable: true
      });

      // Pointer at overlapping area
      global.get_pointer.mockReturnValue([500, 500]);

      const result = windowManager.findNodeWindowAtPointer(nodeWindow2);

      // Should return the topmost window (first in sorted list)
      expect(result).toBe(nodeWindow2);
    });
  });

  describe('canMovePointerInsideNodeWindow()', () => {
    it('should return true when pointer is outside window', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0,
        minimized: false
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      const result = windowManager.canMovePointerInsideNodeWindow(nodeWindow);

      expect(result).toBe(true);
    });

    it('should return false when pointer is already inside window', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0,
        minimized: false
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer inside window
      global.get_pointer.mockReturnValue([480, 540]);

      const result = windowManager.canMovePointerInsideNodeWindow(nodeWindow);

      expect(result).toBe(false);
    });

    it('should return false when window is minimized', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0,
        minimized: true
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      const result = windowManager.canMovePointerInsideNodeWindow(nodeWindow);

      expect(result).toBe(false);
    });

    it('should return false when window is too small (width <= 8)', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 5, height: 1080 }),
        workspace: workspace0,
        minimized: false
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([100, 540]);

      const result = windowManager.canMovePointerInsideNodeWindow(nodeWindow);

      expect(result).toBe(false);
    });

    it('should return false when window is too small (height <= 8)', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 5 }),
        workspace: workspace0,
        minimized: false
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      const result = windowManager.canMovePointerInsideNodeWindow(nodeWindow);

      expect(result).toBe(false);
    });

    it('should return false when overview is visible', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0,
        minimized: false
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      // Set overview visible
      global.Main.overview.visible = true;

      const result = windowManager.canMovePointerInsideNodeWindow(nodeWindow);

      expect(result).toBe(false);
    });

    it('should return false when pointer is over parent stacked decoration', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 30, width: 960, height: 1050 }),
        workspace: workspace0,
        minimized: false
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const container = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.CON, null);
      container.layout = LAYOUT_TYPES.STACKED;
      container.rect = { x: 0, y: 0, width: 960, height: 1080 };
      const nodeWindow = windowManager.tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer in parent decoration area (above window, but in parent rect)
      global.get_pointer.mockReturnValue([480, 15]);

      const result = windowManager.canMovePointerInsideNodeWindow(nodeWindow);

      expect(result).toBe(false);
    });
  });

  describe('pointerIsOverParentDecoration()', () => {
    it('should return true when pointer is over stacked parent decoration', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 30, width: 960, height: 1050 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const container = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.CON, null);
      container.layout = LAYOUT_TYPES.STACKED;
      container.rect = { x: 0, y: 0, width: 960, height: 1080 };
      const nodeWindow = windowManager.tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer in parent decoration area
      const pointerCoord = [480, 15];

      const result = windowManager.pointerIsOverParentDecoration(nodeWindow, pointerCoord);

      expect(result).toBe(true);
    });

    it('should return true when pointer is over tabbed parent decoration', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 30, width: 960, height: 1050 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const container = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.CON, null);
      container.layout = LAYOUT_TYPES.TABBED;
      container.rect = { x: 0, y: 0, width: 960, height: 1080 };
      const nodeWindow = windowManager.tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer in parent decoration area
      const pointerCoord = [480, 15];

      const result = windowManager.pointerIsOverParentDecoration(nodeWindow, pointerCoord);

      expect(result).toBe(true);
    });

    it('should return false for non-stacked/tabbed parent', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const container = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.CON, null);
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 960, height: 1080 };
      const nodeWindow = windowManager.tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer anywhere
      const pointerCoord = [480, 15];

      const result = windowManager.pointerIsOverParentDecoration(nodeWindow, pointerCoord);

      expect(result).toBe(false);
    });

    it('should return false when pointer is outside parent rect', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 30, width: 960, height: 1050 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const container = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.CON, null);
      container.layout = LAYOUT_TYPES.STACKED;
      container.rect = { x: 0, y: 0, width: 960, height: 1080 };
      const nodeWindow = windowManager.tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside parent rect
      const pointerCoord = [1500, 540];

      const result = windowManager.pointerIsOverParentDecoration(nodeWindow, pointerCoord);

      expect(result).toBe(false);
    });

    it('should return false when pointerCoord is null', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const result = windowManager.pointerIsOverParentDecoration(nodeWindow, null);

      expect(result).toBe(false);
    });
  });

  describe('warpPointerToNodeWindow()', () => {
    it('should warp pointer to window center when no stored position', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      windowManager.warpPointerToNodeWindow(nodeWindow);

      expect(mockSeat.warp_pointer).toHaveBeenCalledWith(
        480,  // x: 0 + 960/2
        8     // y: 0 + 8 (titlebar)
      );
    });

    it('should warp pointer to stored position', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 100, y: 100, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Store pointer position
      nodeWindow.pointer = { x: 200, y: 300 };

      windowManager.warpPointerToNodeWindow(nodeWindow);

      expect(mockSeat.warp_pointer).toHaveBeenCalledWith(
        300,  // x: 100 + 200
        400   // y: 100 + 300
      );
    });

    it('should clamp pointer x position to window width - 8', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Store pointer position beyond window width
      nodeWindow.pointer = { x: 1000, y: 100 };

      windowManager.warpPointerToNodeWindow(nodeWindow);

      expect(mockSeat.warp_pointer).toHaveBeenCalledWith(
        952,  // x: 0 + (960 - 8) clamped
        100   // y: 0 + 100
      );
    });

    it('should clamp pointer y position to window height - 8', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Store pointer position beyond window height
      nodeWindow.pointer = { x: 100, y: 2000 };

      windowManager.warpPointerToNodeWindow(nodeWindow);

      expect(mockSeat.warp_pointer).toHaveBeenCalledWith(
        100,  // x: 0 + 100
        1072  // y: 0 + (1080 - 8) clamped
      );
    });
  });

  describe('movePointerWith()', () => {
    it('should not warp when move-pointer-focus-enabled is false', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'move-pointer-focus-enabled') return false;
        return false;
      });

      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      windowManager.movePointerWith(nodeWindow);

      expect(mockSeat.warp_pointer).not.toHaveBeenCalled();
    });

    it('should warp when move-pointer-focus-enabled is true', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'move-pointer-focus-enabled') return true;
        return false;
      });

      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      windowManager.movePointerWith(nodeWindow);

      expect(mockSeat.warp_pointer).toHaveBeenCalled();
    });

    it('should warp when force is true regardless of setting', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'move-pointer-focus-enabled') return false;
        return false;
      });

      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      windowManager.movePointerWith(nodeWindow, { force: true });

      expect(mockSeat.warp_pointer).toHaveBeenCalled();
    });

    it('should not warp when pointer is already inside window', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'move-pointer-focus-enabled') return true;
        return false;
      });

      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer inside window
      global.get_pointer.mockReturnValue([480, 540]);

      windowManager.movePointerWith(nodeWindow);

      expect(mockSeat.warp_pointer).not.toHaveBeenCalled();
    });

    it('should update lastFocusedWindow', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      windowManager.movePointerWith(nodeWindow);

      expect(windowManager.lastFocusedWindow).toBe(nodeWindow);
    });

    it('should handle null nodeWindow', () => {
      expect(() => {
        windowManager.movePointerWith(null);
      }).not.toThrow();

      expect(mockSeat.warp_pointer).not.toHaveBeenCalled();
    });
  });

  describe('_focusWindowUnderPointer()', () => {
    it('should focus and raise window under pointer', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 960, height: 1080 }),
        workspace: workspace0
      });

      // Mock window actor
      const mockActor = {
        meta_window: metaWindow
      };

      global.get_window_actors.mockReturnValue([mockActor]);
      global.get_pointer.mockReturnValue([480, 540]);

      // Enable shouldFocusOnHover
      windowManager.shouldFocusOnHover = true;

      const focusSpy = vi.spyOn(metaWindow, 'focus');
      const raiseSpy = vi.spyOn(metaWindow, 'raise');

      const result = windowManager._focusWindowUnderPointer();

      expect(focusSpy).toHaveBeenCalledWith(12345);
      expect(raiseSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when shouldFocusOnHover is disabled', () => {
      windowManager.shouldFocusOnHover = false;

      const result = windowManager._focusWindowUnderPointer();

      expect(result).toBe(false);
    });

    it('should return false when window manager is disabled', () => {
      windowManager.shouldFocusOnHover = true;
      windowManager.disabled = true;

      const result = windowManager._focusWindowUnderPointer();

      expect(result).toBe(false);
    });

    it('should return true without focusing when overview is visible', () => {
      windowManager.shouldFocusOnHover = true;
      global.Main.overview.visible = true;

      const result = windowManager._focusWindowUnderPointer();

      expect(result).toBe(true);
    });

    it('should not focus when no window under pointer', () => {
      windowManager.shouldFocusOnHover = true;
      global.get_window_actors.mockReturnValue([]);
      global.get_pointer.mockReturnValue([480, 540]);

      const result = windowManager._focusWindowUnderPointer();

      expect(result).toBe(true);
    });

    it('should handle multiple overlapping windows', () => {
      const metaWindow1 = createMockWindow({
        rect: new Rectangle({ x: 0, y: 0, width: 1000, height: 1000 }),
        workspace: workspace0
      });
      const metaWindow2 = createMockWindow({
        rect: new Rectangle({ x: 100, y: 100, width: 800, height: 800 }),
        workspace: workspace0
      });

      // Mock window actors (last in array is topmost)
      const mockActor1 = { meta_window: metaWindow1 };
      const mockActor2 = { meta_window: metaWindow2 };

      global.get_window_actors.mockReturnValue([mockActor1, mockActor2]);
      global.get_pointer.mockReturnValue([500, 500]);

      windowManager.shouldFocusOnHover = true;

      const focusSpy1 = vi.spyOn(metaWindow1, 'focus');
      const focusSpy2 = vi.spyOn(metaWindow2, 'focus');

      windowManager._focusWindowUnderPointer();

      // Should focus the topmost window (window2)
      expect(focusSpy2).toHaveBeenCalled();
      expect(focusSpy1).not.toHaveBeenCalled();
    });
  });

  describe('storePointerLastPosition()', () => {
    it('should store pointer position when inside window', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 100, y: 100, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer inside window
      global.get_pointer.mockReturnValue([300, 400]);

      windowManager.storePointerLastPosition(nodeWindow);

      expect(nodeWindow.pointer).toEqual({ x: 200, y: 300 });
    });

    it('should not store when pointer is outside window', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 100, y: 100, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Pointer outside window
      global.get_pointer.mockReturnValue([1500, 540]);

      windowManager.storePointerLastPosition(nodeWindow);

      expect(nodeWindow.pointer).toBeUndefined();
    });

    it('should handle null nodeWindow', () => {
      expect(() => {
        windowManager.storePointerLastPosition(null);
      }).not.toThrow();
    });
  });

  describe('getPointerPositionInside()', () => {
    it('should return center position when no stored pointer', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 100, y: 100, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const result = windowManager.getPointerPositionInside(nodeWindow);

      expect(result).toEqual({
        x: 580,  // 100 + 960/2
        y: 108   // 100 + 8
      });
    });

    it('should return stored pointer position', () => {
      const metaWindow = createMockWindow({
        rect: new Rectangle({ x: 100, y: 100, width: 960, height: 1080 }),
        workspace: workspace0
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      nodeWindow.pointer = { x: 200, y: 300 };

      const result = windowManager.getPointerPositionInside(nodeWindow);

      expect(result).toEqual({
        x: 300,  // 100 + 200
        y: 400   // 100 + 300
      });
    });

    it('should return null for null nodeWindow', () => {
      const result = windowManager.getPointerPositionInside(null);

      expect(result).toBe(null);
    });
  });
});
