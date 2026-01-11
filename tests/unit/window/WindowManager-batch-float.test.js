import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowManager, WINDOW_MODES } from '../../../lib/extension/window.js';
import { Tree, NODE_TYPES } from '../../../lib/extension/tree.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { Workspace } from '../../mocks/gnome/Meta.js';

/**
 * WindowManager batch float/unfloat operations tests
 *
 * Tests for batch operations including:
 * - floatAllWindows(): Float all windows in the tree
 * - unfloatAllWindows(): Unfloat all windows (restore previous state)
 * - floatWorkspace(wsIndex): Float all windows on a specific workspace
 * - unfloatWorkspace(wsIndex): Unfloat all windows on a specific workspace
 * - cleanupAlwaysFloat(): Remove always-on-top from floating windows
 * - restoreAlwaysFloat(): Restore always-on-top for floating windows
 */
describe('WindowManager - Batch Float Operations', () => {
  let windowManager;
  let mockExtension;
  let mockSettings;
  let mockConfigMgr;
  let workspace0;
  let workspace1;

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

    workspace0 = new Workspace({ index: 0 });
    workspace1 = new Workspace({ index: 1 });

    global.workspace_manager = {
      get_n_workspaces: vi.fn(() => 2),
      get_workspace_by_index: vi.fn((i) => {
        if (i === 0) return workspace0;
        if (i === 1) return workspace1;
        return new Workspace({ index: i });
      }),
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

    // Mock settings
    mockSettings = {
      get_boolean: vi.fn((key) => {
        if (key === 'tiling-mode-enabled') return true;
        if (key === 'focus-on-hover-enabled') return false;
        if (key === 'float-always-on-top-enabled') return true;
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

  describe('floatAllWindows()', () => {
    it('should float all windows in the tree', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });
      const metaWindow3 = createMockWindow({ id: 3 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      const nodeWindow3 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow3);

      nodeWindow1.mode = WINDOW_MODES.TILE;
      nodeWindow2.mode = WINDOW_MODES.TILE;
      nodeWindow3.mode = WINDOW_MODES.TILE;

      windowManager.floatAllWindows();

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow3.mode).toBe(WINDOW_MODES.FLOAT);
    });

    it('should mark already-floating windows with prevFloat', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT; // Already floating
      nodeWindow2.mode = WINDOW_MODES.TILE;

      windowManager.floatAllWindows();

      expect(nodeWindow1.prevFloat).toBe(true);
      expect(nodeWindow2.prevFloat).toBeUndefined();
    });

    it('should handle empty tree gracefully', () => {
      expect(() => {
        windowManager.floatAllWindows();
      }).not.toThrow();
    });

    it('should float windows across multiple workspaces', () => {
      const workspace0 = windowManager.tree.nodeWorkpaces[0];
      const workspace1 = windowManager.tree.nodeWorkpaces[1];
      const monitor0 = workspace0.getNodeByType(NODE_TYPES.MONITOR)[0];
      const monitor1 = workspace1.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace1 });

      const nodeWindow1 = windowManager.tree.createNode(monitor0.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor1.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.TILE;
      nodeWindow2.mode = WINDOW_MODES.TILE;

      windowManager.floatAllWindows();

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.FLOAT);
    });
  });

  describe('unfloatAllWindows()', () => {
    it('should unfloat all windows that were not previously floating', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.TILE;
      nodeWindow2.mode = WINDOW_MODES.TILE;

      // Float all
      windowManager.floatAllWindows();

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.FLOAT);

      // Unfloat all
      windowManager.unfloatAllWindows();

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.TILE);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.TILE);
    });

    it('should keep previously-floating windows as floating', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT; // Already floating
      nodeWindow2.mode = WINDOW_MODES.TILE;

      // Float all (marks nodeWindow1 with prevFloat)
      windowManager.floatAllWindows();

      expect(nodeWindow1.prevFloat).toBe(true);
      expect(nodeWindow2.prevFloat).toBeUndefined();

      // Unfloat all
      windowManager.unfloatAllWindows();

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT); // Still floating
      expect(nodeWindow1.prevFloat).toBe(false); // Marker reset
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.TILE);
    });

    it('should handle empty tree gracefully', () => {
      expect(() => {
        windowManager.unfloatAllWindows();
      }).not.toThrow();
    });

    it('should unfloat windows across multiple workspaces', () => {
      const workspace0 = windowManager.tree.nodeWorkpaces[0];
      const workspace1 = windowManager.tree.nodeWorkpaces[1];
      const monitor0 = workspace0.getNodeByType(NODE_TYPES.MONITOR)[0];
      const monitor1 = workspace1.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace1 });

      const nodeWindow1 = windowManager.tree.createNode(monitor0.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor1.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.TILE;
      nodeWindow2.mode = WINDOW_MODES.TILE;

      windowManager.floatAllWindows();
      windowManager.unfloatAllWindows();

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.TILE);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.TILE);
    });
  });

  describe('floatWorkspace()', () => {
    it('should float all windows on specified workspace', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace0 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.TILE;
      nodeWindow2.mode = WINDOW_MODES.TILE;

      // Mock getWindowsOnWorkspace to return our test windows
      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue([nodeWindow1, nodeWindow2]);

      windowManager.floatWorkspace(0);

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.FLOAT);
    });

    it('should not affect windows on other workspaces', () => {
      const workspace0 = windowManager.tree.nodeWorkpaces[0];
      const workspace1 = windowManager.tree.nodeWorkpaces[1];
      const monitor0 = workspace0.getNodeByType(NODE_TYPES.MONITOR)[0];
      const monitor1 = workspace1.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace1 });

      const nodeWindow1 = windowManager.tree.createNode(monitor0.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor1.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.TILE;
      nodeWindow2.mode = WINDOW_MODES.TILE;

      // Mock getWindowsOnWorkspace
      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockImplementation((wsIndex) => {
        if (wsIndex === 0) return [nodeWindow1];
        if (wsIndex === 1) return [nodeWindow2];
        return [];
      });

      windowManager.floatWorkspace(0);

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.TILE); // Unchanged
    });

    it('should handle empty workspace gracefully', () => {
      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue([]);

      expect(() => {
        windowManager.floatWorkspace(0);
      }).not.toThrow();
    });

    it('should handle null workspace gracefully', () => {
      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue(null);

      expect(() => {
        windowManager.floatWorkspace(999);
      }).not.toThrow();
    });

    it('should enable always-on-top for floated windows when setting enabled', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      nodeWindow1.mode = WINDOW_MODES.TILE;

      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'float-always-on-top-enabled') return true;
        return false;
      });

      const makeAboveSpy = vi.spyOn(metaWindow1, 'make_above');

      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue([nodeWindow1]);

      windowManager.floatWorkspace(0);

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(makeAboveSpy).toHaveBeenCalled();
    });
  });

  describe('unfloatWorkspace()', () => {
    it('should unfloat all windows on specified workspace', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace0 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      nodeWindow2.mode = WINDOW_MODES.FLOAT;

      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue([nodeWindow1, nodeWindow2]);

      windowManager.unfloatWorkspace(0);

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.TILE);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.TILE);
    });

    it('should not affect windows on other workspaces', () => {
      const workspace0 = windowManager.tree.nodeWorkpaces[0];
      const workspace1 = windowManager.tree.nodeWorkpaces[1];
      const monitor0 = workspace0.getNodeByType(NODE_TYPES.MONITOR)[0];
      const monitor1 = workspace1.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace1 });

      const nodeWindow1 = windowManager.tree.createNode(monitor0.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor1.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      nodeWindow2.mode = WINDOW_MODES.FLOAT;

      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockImplementation((wsIndex) => {
        if (wsIndex === 0) return [nodeWindow1];
        if (wsIndex === 1) return [nodeWindow2];
        return [];
      });

      windowManager.unfloatWorkspace(0);

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.TILE);
      expect(nodeWindow2.mode).toBe(WINDOW_MODES.FLOAT); // Unchanged
    });

    it('should handle empty workspace gracefully', () => {
      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue([]);

      expect(() => {
        windowManager.unfloatWorkspace(0);
      }).not.toThrow();
    });

    it('should handle null workspace gracefully', () => {
      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue(null);

      expect(() => {
        windowManager.unfloatWorkspace(999);
      }).not.toThrow();
    });

    it('should change mode to TILE when unfloating', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      nodeWindow1.mode = WINDOW_MODES.FLOAT;

      vi.spyOn(windowManager, 'getWindowsOnWorkspace').mockReturnValue([nodeWindow1]);

      windowManager.unfloatWorkspace(0);

      expect(nodeWindow1.mode).toBe(WINDOW_MODES.TILE);
    });
  });

  describe('cleanupAlwaysFloat()', () => {
    it('should remove always-on-top from floating windows', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      nodeWindow2.mode = WINDOW_MODES.TILE;

      metaWindow1.above = true;

      const unmakeAbove1 = vi.spyOn(metaWindow1, 'unmake_above');
      const unmakeAbove2 = vi.spyOn(metaWindow2, 'unmake_above');

      windowManager.cleanupAlwaysFloat();

      expect(unmakeAbove1).toHaveBeenCalled();
      expect(unmakeAbove2).not.toHaveBeenCalled();
    });

    it('should not unmake_above if window is not above', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      metaWindow1.above = false;

      const unmakeAboveSpy = vi.spyOn(metaWindow1, 'unmake_above');

      windowManager.cleanupAlwaysFloat();

      expect(unmakeAboveSpy).not.toHaveBeenCalled();
    });

    it('should handle empty tree gracefully', () => {
      expect(() => {
        windowManager.cleanupAlwaysFloat();
      }).not.toThrow();
    });

    it('should process all floating windows across workspaces', () => {
      const workspace0 = windowManager.tree.nodeWorkpaces[0];
      const workspace1 = windowManager.tree.nodeWorkpaces[1];
      const monitor0 = workspace0.getNodeByType(NODE_TYPES.MONITOR)[0];
      const monitor1 = workspace1.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });

      const nodeWindow1 = windowManager.tree.createNode(monitor0.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor1.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      nodeWindow2.mode = WINDOW_MODES.FLOAT;

      metaWindow1.above = true;
      metaWindow2.above = true;

      const unmakeAbove1 = vi.spyOn(metaWindow1, 'unmake_above');
      const unmakeAbove2 = vi.spyOn(metaWindow2, 'unmake_above');

      windowManager.cleanupAlwaysFloat();

      expect(unmakeAbove1).toHaveBeenCalled();
      expect(unmakeAbove2).toHaveBeenCalled();
    });
  });

  describe('restoreAlwaysFloat()', () => {
    it('should restore always-on-top for floating windows', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });

      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      nodeWindow2.mode = WINDOW_MODES.TILE;

      metaWindow1.above = false;

      const makeAbove1 = vi.spyOn(metaWindow1, 'make_above');
      const makeAbove2 = vi.spyOn(metaWindow2, 'make_above');

      windowManager.restoreAlwaysFloat();

      expect(makeAbove1).toHaveBeenCalled();
      expect(makeAbove2).not.toHaveBeenCalled();
    });

    it('should not make_above if window is already above', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      metaWindow1.above = true;

      const makeAboveSpy = vi.spyOn(metaWindow1, 'make_above');

      windowManager.restoreAlwaysFloat();

      expect(makeAboveSpy).not.toHaveBeenCalled();
    });

    it('should handle empty tree gracefully', () => {
      expect(() => {
        windowManager.restoreAlwaysFloat();
      }).not.toThrow();
    });

    it('should process all floating windows across workspaces', () => {
      const workspace0 = windowManager.tree.nodeWorkpaces[0];
      const workspace1 = windowManager.tree.nodeWorkpaces[1];
      const monitor0 = workspace0.getNodeByType(NODE_TYPES.MONITOR)[0];
      const monitor1 = workspace1.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const metaWindow2 = createMockWindow({ id: 2 });

      const nodeWindow1 = windowManager.tree.createNode(monitor0.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      const nodeWindow2 = windowManager.tree.createNode(monitor1.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      nodeWindow2.mode = WINDOW_MODES.FLOAT;

      metaWindow1.above = false;
      metaWindow2.above = false;

      const makeAbove1 = vi.spyOn(metaWindow1, 'make_above');
      const makeAbove2 = vi.spyOn(metaWindow2, 'make_above');

      windowManager.restoreAlwaysFloat();

      expect(makeAbove1).toHaveBeenCalled();
      expect(makeAbove2).toHaveBeenCalled();
    });

    it('should work correctly after cleanupAlwaysFloat', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);

      nodeWindow1.mode = WINDOW_MODES.FLOAT;
      metaWindow1.above = true;

      const unmakeAboveSpy = vi.spyOn(metaWindow1, 'unmake_above');
      const makeAboveSpy = vi.spyOn(metaWindow1, 'make_above');

      // Cleanup removes above
      windowManager.cleanupAlwaysFloat();
      expect(unmakeAboveSpy).toHaveBeenCalled();

      // Restore adds it back
      windowManager.restoreAlwaysFloat();
      expect(makeAboveSpy).toHaveBeenCalled();
    });
  });

  describe('Integration: Float/Unfloat Cycle', () => {
    it('should correctly handle float -> unfloat -> float cycle', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);

      // Start as tiled
      nodeWindow1.mode = WINDOW_MODES.TILE;

      // Float all
      windowManager.floatAllWindows();
      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow1.prevFloat).toBeUndefined();

      // Unfloat all
      windowManager.unfloatAllWindows();
      expect(nodeWindow1.mode).toBe(WINDOW_MODES.TILE);

      // Float again
      windowManager.floatAllWindows();
      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow1.prevFloat).toBeUndefined(); // Was not floating before
    });

    it('should preserve original floating state through cycle', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1 });
      const nodeWindow1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);

      // Start as floating
      nodeWindow1.mode = WINDOW_MODES.FLOAT;

      // Float all (should mark as prevFloat)
      windowManager.floatAllWindows();
      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow1.prevFloat).toBe(true);

      // Unfloat all (should keep as floating because of prevFloat)
      windowManager.unfloatAllWindows();
      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow1.prevFloat).toBe(false); // Marker reset

      // Float again
      windowManager.floatAllWindows();
      expect(nodeWindow1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(nodeWindow1.prevFloat).toBe(true); // Marked again
    });
  });
});
