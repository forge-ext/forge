import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowManager, WINDOW_MODES } from '../../../lib/extension/window.js';
import { Tree, NODE_TYPES } from '../../../lib/extension/tree.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { Workspace } from '../../mocks/gnome/Meta.js';

/**
 * WindowManager gap calculations tests
 *
 * Tests for calculateGaps method - pure mathematical calculations
 * that determine window spacing based on settings and window count.
 */
describe('WindowManager - Gap Calculations', () => {
  let windowManager;
  let mockExtension;
  let mockSettings;
  let mockConfigMgr;

  beforeEach(() => {
    // Mock global display and workspace manager
    global.display = {
      get_workspace_manager: vi.fn(),
      get_n_monitors: vi.fn(() => 1),
      get_focus_window: vi.fn(() => null),
      get_current_monitor: vi.fn(() => 0),
      get_current_time: vi.fn(() => 12345),
      get_monitor_geometry: vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 }))
    };

    const workspace0 = new Workspace({ index: 0 });

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

    // Mock settings with default values
    mockSettings = {
      get_boolean: vi.fn((key) => {
        if (key === 'window-gap-hidden-on-single') return false;
        if (key === 'tiling-mode-enabled') return true;
        if (key === 'focus-on-hover-enabled') return false;
        return false;
      }),
      get_uint: vi.fn((key) => {
        if (key === 'window-gap-size') return 4;  // Default gap size
        if (key === 'window-gap-size-increment') return 1;  // Default increment
        return 0;
      }),
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

  describe('Basic Gap Calculation', () => {
    it('should return 0 for null node', () => {
      const gap = windowManager.calculateGaps(null);

      expect(gap).toBe(0);
    });

    it('should return 0 for undefined node', () => {
      const gap = windowManager.calculateGaps(undefined);

      expect(gap).toBe(0);
    });

    it('should calculate gap as gapSize * gapIncrement', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 4;
        if (key === 'window-gap-size-increment') return 3;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(12);  // 4 * 3 = 12
    });

    it('should return 0 when gapSize is 0', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 0;
        if (key === 'window-gap-size-increment') return 5;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(0);  // 0 * 5 = 0
    });

    it('should return 0 when gapIncrement is 0', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 8;
        if (key === 'window-gap-size-increment') return 0;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(0);  // 8 * 0 = 0
    });
  });

  describe('Gap Size Settings', () => {
    it('should handle gapSize = 1', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 1;
        if (key === 'window-gap-size-increment') return 1;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(1);
    });

    it('should handle gapSize = 2', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 2;
        if (key === 'window-gap-size-increment') return 1;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(2);
    });

    it('should handle gapSize = 4', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 4;
        if (key === 'window-gap-size-increment') return 1;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(4);
    });

    it('should handle gapSize = 8', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 8;
        if (key === 'window-gap-size-increment') return 1;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(8);
    });
  });

  describe('Gap Increment Settings', () => {
    it('should handle gapIncrement = 1', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 5;
        if (key === 'window-gap-size-increment') return 1;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(5);  // 5 * 1 = 5
    });

    it('should handle gapIncrement = 2', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 5;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(10);  // 5 * 2 = 10
    });

    it('should handle gapIncrement = 4', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 3;
        if (key === 'window-gap-size-increment') return 4;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(12);  // 3 * 4 = 12
    });

    it('should handle gapIncrement = 8', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 2;
        if (key === 'window-gap-size-increment') return 8;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(16);  // 2 * 8 = 16
    });
  });

  describe('hideGapWhenSingle Setting', () => {
    it('should return 0 when hideGapWhenSingle is enabled with single tiled window', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 4;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'window-gap-hidden-on-single') return true;
        if (key === 'tiling-mode-enabled') return true;
        return false;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(0);  // Single window, hideGapWhenSingle = true
    });

    it('should return gap when hideGapWhenSingle is enabled with multiple tiled windows', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 4;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'window-gap-hidden-on-single') return true;
        if (key === 'tiling-mode-enabled') return true;
        return false;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      // Create first window
      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      nodeWindow1.mode = WINDOW_MODES.TILE;

      // Create second window
      const metaWindow2 = createMockWindow({ id: 2 });
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      nodeWindow2.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow1);

      expect(gap).toBe(8);  // Multiple windows, should return gap (4 * 2 = 8)
    });

    it('should return gap when hideGapWhenSingle is disabled with single window', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 6;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'window-gap-hidden-on-single') return false;
        if (key === 'tiling-mode-enabled') return true;
        return false;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(12);  // hideGapWhenSingle = false, should return gap (6 * 2 = 12)
    });

    it('should exclude minimized windows from count', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 4;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'window-gap-hidden-on-single') return true;
        if (key === 'tiling-mode-enabled') return true;
        return false;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      // Create first window (not minimized)
      const metaWindow1 = createMockWindow({ id: 1, minimized: false });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      nodeWindow1.mode = WINDOW_MODES.TILE;

      // Create second window (minimized, should be excluded)
      const metaWindow2 = createMockWindow({ id: 2, minimized: true });
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      nodeWindow2.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow1);

      // Only one non-minimized window, so gap should be 0
      expect(gap).toBe(0);
    });

    it('should exclude floating windows from count', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 4;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'window-gap-hidden-on-single') return true;
        if (key === 'tiling-mode-enabled') return true;
        return false;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      // Create first window (tiled)
      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      nodeWindow1.mode = WINDOW_MODES.TILE;

      // Create second window (floating, should be excluded)
      const metaWindow2 = createMockWindow({ id: 2 });
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      nodeWindow2.mode = WINDOW_MODES.FLOAT;

      const gap = windowManager.calculateGaps(nodeWindow1);

      // Only one tiled window, so gap should be 0
      expect(gap).toBe(0);
    });

    it('should only count tiled, non-minimized windows', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 5;
        if (key === 'window-gap-size-increment') return 3;
        return 0;
      });
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'window-gap-hidden-on-single') return true;
        if (key === 'tiling-mode-enabled') return true;
        return false;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      // Create first window (tiled, not minimized) - COUNTED
      const metaWindow1 = createMockWindow({ id: 1, minimized: false });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      nodeWindow1.mode = WINDOW_MODES.TILE;

      // Create second window (tiled, not minimized) - COUNTED
      const metaWindow2 = createMockWindow({ id: 2, minimized: false });
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      nodeWindow2.mode = WINDOW_MODES.TILE;

      // Create third window (tiled, minimized) - NOT COUNTED
      const metaWindow3 = createMockWindow({ id: 3, minimized: true });
      const nodeWindow3 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow3);
      nodeWindow3.mode = WINDOW_MODES.TILE;

      // Create fourth window (floating) - NOT COUNTED
      const metaWindow4 = createMockWindow({ id: 4, minimized: false });
      const nodeWindow4 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow4);
      nodeWindow4.mode = WINDOW_MODES.FLOAT;

      const gap = windowManager.calculateGaps(nodeWindow1);

      // Two tiled, non-minimized windows, so gap should be returned (5 * 3 = 15)
      expect(gap).toBe(15);
    });
  });

  describe('Root Node Handling', () => {
    it('should return gap for root node (workspace)', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 10;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const gap = windowManager.calculateGaps(workspace);

      // Root nodes always return the gap (no hideGapWhenSingle logic)
      expect(gap).toBe(20);  // 10 * 2 = 20
    });

    it('should return gap for monitor node', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 3;
        if (key === 'window-gap-size-increment') return 4;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const gap = windowManager.calculateGaps(monitor);

      // Monitor nodes always return the gap (no hideGapWhenSingle logic)
      expect(gap).toBe(12);  // 3 * 4 = 12
    });
  });

  describe('Edge Cases', () => {
    it('should handle container nodes', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 5;
        if (key === 'window-gap-size-increment') return 2;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      // Create a container
      const container = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.CON, null);

      // Create windows in the container
      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      nodeWindow1.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(container);

      // Container should return gap (hideGapWhenSingle is false by default in beforeEach)
      expect(gap).toBe(10);  // 5 * 2 = 10
    });

    it('should handle very large gap values', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 999;
        if (key === 'window-gap-size-increment') return 999;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap = windowManager.calculateGaps(nodeWindow);

      expect(gap).toBe(998001);  // 999 * 999 = 998001
    });

    it('should consistently calculate gap for same settings', () => {
      mockSettings.get_uint.mockImplementation((key) => {
        if (key === 'window-gap-size') return 7;
        if (key === 'window-gap-size-increment') return 3;
        return 0;
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow = createMockWindow();
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      const gap1 = windowManager.calculateGaps(nodeWindow);
      const gap2 = windowManager.calculateGaps(nodeWindow);
      const gap3 = windowManager.calculateGaps(nodeWindow);

      expect(gap1).toBe(21);
      expect(gap2).toBe(21);
      expect(gap3).toBe(21);
    });
  });
});
