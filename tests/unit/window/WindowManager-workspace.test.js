import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowManager, WINDOW_MODES } from '../../../lib/extension/window.js';
import { Tree, NODE_TYPES } from '../../../lib/extension/tree.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { Workspace, WindowType } from '../../mocks/gnome/Meta.js';

/**
 * WindowManager workspace management tests
 *
 * Tests for workspace-related operations including:
 * - getWindowsOnWorkspace(): Get windows on a specific workspace
 * - isActiveWindowWorkspaceTiled(): Check if window's workspace allows tiling
 * - isCurrentWorkspaceTiled(): Check if current workspace allows tiling
 * - trackCurrentMonWs(): Track current monitor/workspace
 * - trackCurrentWindows(): Sync tree with current windows
 */
describe('WindowManager - Workspace Management', () => {
  let windowManager;
  let mockExtension;
  let mockSettings;
  let mockConfigMgr;
  let workspace0;
  let workspace1;
  let workspace2;

  beforeEach(() => {
    // Create workspaces
    workspace0 = new Workspace({ index: 0 });
    workspace1 = new Workspace({ index: 1 });
    workspace2 = new Workspace({ index: 2 });

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
      get_n_workspaces: vi.fn(() => 3),
      get_workspace_by_index: vi.fn((i) => {
        if (i === 0) return workspace0;
        if (i === 1) return workspace1;
        if (i === 2) return workspace2;
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
        return false;
      }),
      get_uint: vi.fn(() => 0),
      get_string: vi.fn((key) => {
        if (key === 'workspace-skip-tile') return '';
        return '';
      }),
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

  describe('getWindowsOnWorkspace', () => {
    it('should return windows on specified workspace', () => {
      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace0 });

      const wsNode = windowManager.tree.nodeWorkpaces[0];
      const monitor = wsNode.getNodeByType(NODE_TYPES.MONITOR)[0];

      windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      const windows = windowManager.getWindowsOnWorkspace(0);

      expect(windows).toHaveLength(2);
      expect(windows[0].nodeValue).toBe(metaWindow1);
      expect(windows[1].nodeValue).toBe(metaWindow2);
    });

    it('should return empty array for workspace with no windows', () => {
      const windows = windowManager.getWindowsOnWorkspace(0);

      expect(windows).toHaveLength(0);
    });

    it('should return windows only from specified workspace', () => {
      // Add window to workspace 0
      const wsNode0 = windowManager.tree.nodeWorkpaces[0];
      const monitor0 = wsNode0.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow1 = createMockWindow({ id: 1, workspace: workspace0 });
      windowManager.tree.createNode(monitor0.nodeValue, NODE_TYPES.WINDOW, metaWindow1);

      // Add window to workspace 1
      const wsNode1 = windowManager.tree.nodeWorkpaces[1];
      const monitor1 = wsNode1.getNodeByType(NODE_TYPES.MONITOR)[0];
      const metaWindow2 = createMockWindow({ id: 2, workspace: workspace1 });
      windowManager.tree.createNode(monitor1.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      const windows0 = windowManager.getWindowsOnWorkspace(0);
      const windows1 = windowManager.getWindowsOnWorkspace(1);

      expect(windows0).toHaveLength(1);
      expect(windows1).toHaveLength(1);
      expect(windows0[0].nodeValue).toBe(metaWindow1);
      expect(windows1[0].nodeValue).toBe(metaWindow2);
    });

    it('should include all window types on workspace', () => {
      const wsNode = windowManager.tree.nodeWorkpaces[0];
      const monitor = wsNode.getNodeByType(NODE_TYPES.MONITOR)[0];

      const normalWindow = createMockWindow({ id: 1, window_type: WindowType.NORMAL });
      const dialogWindow = createMockWindow({ id: 2, window_type: WindowType.DIALOG });

      const node1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, normalWindow);
      const node2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, dialogWindow);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.FLOAT;

      const windows = windowManager.getWindowsOnWorkspace(0);

      expect(windows).toHaveLength(2);
    });

    it('should include minimized windows', () => {
      const wsNode = windowManager.tree.nodeWorkpaces[0];
      const monitor = wsNode.getNodeByType(NODE_TYPES.MONITOR)[0];

      const metaWindow1 = createMockWindow({ id: 1, minimized: false });
      const metaWindow2 = createMockWindow({ id: 2, minimized: true });

      windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow1);
      windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);

      const windows = windowManager.getWindowsOnWorkspace(0);

      expect(windows).toHaveLength(2);
    });
  });

  describe('isActiveWindowWorkspaceTiled', () => {
    it('should return true when window workspace is not skipped', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '1,2';
        return '';
      });

      const metaWindow = createMockWindow({ workspace: workspace0 });

      const result = windowManager.isActiveWindowWorkspaceTiled(metaWindow);

      expect(result).toBe(true);
    });

    it('should return false when window workspace is skipped', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '0,2';
        return '';
      });

      const metaWindow = createMockWindow({ workspace: workspace0 });

      const result = windowManager.isActiveWindowWorkspaceTiled(metaWindow);

      expect(result).toBe(false);
    });

    it('should return true for null metaWindow', () => {
      const result = windowManager.isActiveWindowWorkspaceTiled(null);

      expect(result).toBe(true);
    });

    it('should return true for undefined metaWindow', () => {
      const result = windowManager.isActiveWindowWorkspaceTiled(undefined);

      expect(result).toBe(true);
    });

    it('should handle empty skip list', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '';
        return '';
      });

      const metaWindow = createMockWindow({ workspace: workspace0 });

      const result = windowManager.isActiveWindowWorkspaceTiled(metaWindow);

      expect(result).toBe(true);
    });

    it('should handle single workspace in skip list', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '1';
        return '';
      });

      const metaWindow0 = createMockWindow({ workspace: workspace0 });
      const metaWindow1 = createMockWindow({ workspace: workspace1 });

      expect(windowManager.isActiveWindowWorkspaceTiled(metaWindow0)).toBe(true);
      expect(windowManager.isActiveWindowWorkspaceTiled(metaWindow1)).toBe(false);
    });

    it('should handle multiple workspaces in skip list', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '0,1,2';
        return '';
      });

      const metaWindow0 = createMockWindow({ workspace: workspace0 });
      const metaWindow1 = createMockWindow({ workspace: workspace1 });
      const metaWindow2 = createMockWindow({ workspace: workspace2 });

      expect(windowManager.isActiveWindowWorkspaceTiled(metaWindow0)).toBe(false);
      expect(windowManager.isActiveWindowWorkspaceTiled(metaWindow1)).toBe(false);
      expect(windowManager.isActiveWindowWorkspaceTiled(metaWindow2)).toBe(false);
    });

    it('should handle whitespace in skip list', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return ' 0 , 1 , 2 ';
        return '';
      });

      const metaWindow = createMockWindow({ workspace: workspace0 });

      const result = windowManager.isActiveWindowWorkspaceTiled(metaWindow);

      expect(result).toBe(false);
    });

    it('should return true for window without workspace', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '0';
        return '';
      });

      const metaWindow = createMockWindow({ workspace: null });

      const result = windowManager.isActiveWindowWorkspaceTiled(metaWindow);

      // Window without workspace is not restricted
      expect(result).toBe(true);
    });
  });

  describe('isCurrentWorkspaceTiled', () => {
    it('should return true when current workspace is not skipped', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '1,2';
        return '';
      });
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);

      const result = windowManager.isCurrentWorkspaceTiled();

      expect(result).toBe(true);
    });

    it('should return false when current workspace is skipped', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '0,2';
        return '';
      });
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);

      const result = windowManager.isCurrentWorkspaceTiled();

      expect(result).toBe(false);
    });

    it('should handle empty skip list', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '';
        return '';
      });

      const result = windowManager.isCurrentWorkspaceTiled();

      expect(result).toBe(true);
    });

    it('should check different workspaces correctly', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '1';
        return '';
      });

      // Workspace 0
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);
      expect(windowManager.isCurrentWorkspaceTiled()).toBe(true);

      // Workspace 1 (skipped)
      global.workspace_manager.get_active_workspace_index.mockReturnValue(1);
      expect(windowManager.isCurrentWorkspaceTiled()).toBe(false);

      // Workspace 2
      global.workspace_manager.get_active_workspace_index.mockReturnValue(2);
      expect(windowManager.isCurrentWorkspaceTiled()).toBe(true);
    });

    it('should handle whitespace in skip list', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return ' 0 , 2 ';
        return '';
      });
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);

      const result = windowManager.isCurrentWorkspaceTiled();

      expect(result).toBe(false);
    });
  });

  describe('trackCurrentMonWs', () => {
    it('should handle no focused window', () => {
      global.display.get_focus_window.mockReturnValue(null);

      expect(() => windowManager.trackCurrentMonWs()).not.toThrow();
    });

    it('should track monitor and workspace for focused window', () => {
      const metaWindow = createMockWindow({ workspace: workspace0, monitor: 0 });
      global.display.get_focus_window.mockReturnValue(metaWindow);
      global.display.get_current_monitor.mockReturnValue(0);

      expect(() => windowManager.trackCurrentMonWs()).not.toThrow();
    });

    it('should handle window on different workspace', () => {
      const metaWindow = createMockWindow({ workspace: workspace1, monitor: 0 });
      metaWindow._monitor = 0;

      global.display.get_focus_window.mockReturnValue(metaWindow);
      global.display.get_current_monitor.mockReturnValue(0);
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);

      expect(() => windowManager.trackCurrentMonWs()).not.toThrow();
    });

    it('should return early if workspace node not found', () => {
      const metaWindow = createMockWindow({ workspace: workspace0 });
      global.display.get_focus_window.mockReturnValue(metaWindow);

      // Mock findNode to return null
      vi.spyOn(windowManager.tree, 'findNode').mockReturnValue(null);

      expect(() => windowManager.trackCurrentMonWs()).not.toThrow();
    });
  });

  describe('trackCurrentWindows', () => {
    it('should track all windows across workspaces', () => {
      // Create windows on different workspaces
      const window1 = createMockWindow({ id: 1, workspace: workspace0 });
      const window2 = createMockWindow({ id: 2, workspace: workspace1 });

      // Mock windowsAllWorkspaces getter
      Object.defineProperty(windowManager, 'windowsAllWorkspaces', {
        get: vi.fn(() => [window1, window2]),
        configurable: true
      });

      const trackSpy = vi.spyOn(windowManager, 'trackWindow');

      windowManager.trackCurrentWindows();

      // Should track both windows
      expect(trackSpy).toHaveBeenCalledTimes(2);
      expect(trackSpy).toHaveBeenCalledWith(global.display, window1);
      expect(trackSpy).toHaveBeenCalledWith(global.display, window2);
    });

    it('should reset attach node before tracking', () => {
      Object.defineProperty(windowManager, 'windowsAllWorkspaces', {
        get: vi.fn(() => []),
        configurable: true
      });

      windowManager.tree.attachNode = { some: 'node' };

      windowManager.trackCurrentWindows();

      expect(windowManager.tree.attachNode).toBeNull();
    });

    it('should handle empty window list', () => {
      Object.defineProperty(windowManager, 'windowsAllWorkspaces', {
        get: vi.fn(() => []),
        configurable: true
      });

      expect(() => windowManager.trackCurrentWindows()).not.toThrow();
    });

    it('should call updateMetaWorkspaceMonitor for each window', () => {
      const window1 = createMockWindow({ id: 1, monitor: 0 });

      Object.defineProperty(windowManager, 'windowsAllWorkspaces', {
        get: vi.fn(() => [window1]),
        configurable: true
      });

      const updateSpy = vi.spyOn(windowManager, 'updateMetaWorkspaceMonitor');

      windowManager.trackCurrentWindows();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith('track-current-windows', 0, window1);
    });

    it('should update decoration layout after tracking', () => {
      Object.defineProperty(windowManager, 'windowsAllWorkspaces', {
        get: vi.fn(() => []),
        configurable: true
      });

      const updateDecoSpy = vi.spyOn(windowManager, 'updateDecorationLayout');

      windowManager.trackCurrentWindows();

      expect(updateDecoSpy).toHaveBeenCalled();
    });
  });

  describe('Workspace Integration', () => {
    it('should correctly identify tiled vs skipped workspaces', () => {
      mockSettings.get_string.mockImplementation((key) => {
        if (key === 'workspace-skip-tile') return '1';
        return '';
      });

      // Workspace 0 should be tiled
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);
      expect(windowManager.isCurrentWorkspaceTiled()).toBe(true);

      // Workspace 1 should be skipped (floating)
      global.workspace_manager.get_active_workspace_index.mockReturnValue(1);
      expect(windowManager.isCurrentWorkspaceTiled()).toBe(false);
    });

    it('should handle workspace with mixed window modes', () => {
      const wsNode = windowManager.tree.nodeWorkpaces[0];
      const monitor = wsNode.getNodeByType(NODE_TYPES.MONITOR)[0];

      const tiledWindow = createMockWindow({ id: 1 });
      const floatWindow = createMockWindow({ id: 2 });

      const node1 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, tiledWindow);
      const node2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, floatWindow);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.FLOAT;

      const windows = windowManager.getWindowsOnWorkspace(0);

      // Should return all windows regardless of mode
      expect(windows).toHaveLength(2);
    });

    it('should track windows across multiple monitors', () => {
      global.display.get_n_monitors.mockReturnValue(2);

      const window1 = createMockWindow({ id: 1, monitor: 0, workspace: workspace0 });
      const window2 = createMockWindow({ id: 2, monitor: 1, workspace: workspace0 });

      Object.defineProperty(windowManager, 'windowsAllWorkspaces', {
        get: vi.fn(() => [window1, window2]),
        configurable: true
      });

      const trackSpy = vi.spyOn(windowManager, 'trackWindow');

      windowManager.trackCurrentWindows();

      // Should track windows on both monitors
      expect(trackSpy).toHaveBeenCalledTimes(2);
    });
  });
});
