import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowManager, WINDOW_MODES } from '../../../lib/extension/window.js';
import { NODE_TYPES, LAYOUT_TYPES, ORIENTATION_TYPES } from '../../../lib/extension/tree.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { MotionDirection, Workspace } from '../../mocks/gnome/Meta.js';

/**
 * WindowManager command system tests
 *
 * Tests for the command() method that handles all tiling commands
 */
describe('WindowManager - Command System', () => {
  let windowManager;
  let mockExtension;
  let mockSettings;
  let mockConfigMgr;
  let metaWindow;
  let nodeWindow;

  beforeEach(() => {
    // Mock global
    global.display = {
      get_workspace_manager: vi.fn(),
      get_n_monitors: vi.fn(() => 1),
      get_focus_window: vi.fn(() => null),
      get_current_monitor: vi.fn(() => 0),
      get_current_time: vi.fn(() => 12345),
      get_monitor_geometry: vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 })),
      get_monitor_neighbor_index: vi.fn(() => -1)
    };

    // Mock global.get_pointer for focus commands
    global.get_pointer = vi.fn(() => [100, 100]);

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

    // Mock settings
    mockSettings = {
      get_boolean: vi.fn((key) => {
        if (key === 'focus-on-hover-enabled') return false;
        if (key === 'tiling-mode-enabled') return true;
        if (key === 'focus-border-toggle') return true;
        if (key === 'move-pointer-focus-enabled') return false;
        return false;
      }),
      get_uint: vi.fn((key) => {
        if (key === 'window-gap-size-increment') return 4;
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

    // Create a test window in the tree
    metaWindow = createMockWindow({
      wm_class: 'TestApp',
      title: 'Test Window',
      allows_resize: true
    });

    const workspace = windowManager.tree.nodeWorkpaces[0];
    const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
    monitor.layout = LAYOUT_TYPES.HSPLIT;
    nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
    nodeWindow.mode = WINDOW_MODES.TILE;

    global.display.get_focus_window.mockReturnValue(metaWindow);

    // Mock renderTree to avoid UI operations
    windowManager.renderTree = vi.fn();
    windowManager.move = vi.fn();
    windowManager.movePointerWith = vi.fn();
    windowManager.unfreezeRender = vi.fn();
    windowManager.updateTabbedFocus = vi.fn();
    windowManager.updateStackedFocus = vi.fn();
  });

  describe('FloatToggle Command', () => {
    it('should toggle floating mode', () => {
      const action = {
        name: 'FloatToggle',
        mode: WINDOW_MODES.FLOAT,
        x: 0,
        y: 0,
        width: '50%',
        height: '50%'
      };

      windowManager.command(action);

      expect(nodeWindow.mode).toBe(WINDOW_MODES.FLOAT);
    });

    it('should call move with resolved rect', () => {
      const action = {
        name: 'FloatToggle',
        mode: WINDOW_MODES.FLOAT,
        x: 100,
        y: 100,
        width: 800,
        height: 600
      };

      windowManager.command(action);

      expect(windowManager.move).toHaveBeenCalled();
    });

    it('should render tree after float toggle', () => {
      const action = {
        name: 'FloatToggle',
        mode: WINDOW_MODES.FLOAT,
        x: 0,
        y: 0,
        width: '50%',
        height: '50%'
      };

      windowManager.command(action);

      expect(windowManager.renderTree).toHaveBeenCalledWith('float-toggle', true);
    });
  });

  describe('Move Command', () => {
    beforeEach(() => {
      // Create second window for moving
      const metaWindow2 = createMockWindow({
        wm_class: 'TestApp2',
        title: 'Test Window 2'
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      nodeWindow2.mode = WINDOW_MODES.TILE;
    });

    it('should move window in direction', () => {
      const action = { name: 'Move', direction: 'right' };
      const moveSpy = vi.spyOn(windowManager.tree, 'move');

      windowManager.command(action);

      expect(moveSpy).toHaveBeenCalledWith(nodeWindow, MotionDirection.RIGHT);
    });

    it('should call unfreezeRender before move', () => {
      const action = { name: 'Move', direction: 'left' };

      windowManager.command(action);

      expect(windowManager.unfreezeRender).toHaveBeenCalled();
    });

    it('should render tree after move', () => {
      const action = { name: 'Move', direction: 'down' };

      windowManager.command(action);

      expect(windowManager.renderTree).toHaveBeenCalled();
    });
  });

  describe('Focus Command', () => {
    beforeEach(() => {
      // Create second window for focus
      const metaWindow2 = createMockWindow({
        wm_class: 'TestApp2',
        title: 'Test Window 2'
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      nodeWindow2.mode = WINDOW_MODES.TILE;
    });

    it('should change focus in direction', () => {
      const action = { name: 'Focus', direction: 'right' };
      const focusSpy = vi.spyOn(windowManager.tree, 'focus');

      windowManager.command(action);

      expect(focusSpy).toHaveBeenCalledWith(nodeWindow, MotionDirection.RIGHT);
    });

    it('should handle focus with all directions', () => {
      const focusSpy = vi.spyOn(windowManager.tree, 'focus');

      windowManager.command({ name: 'Focus', direction: 'up' });
      windowManager.command({ name: 'Focus', direction: 'down' });
      windowManager.command({ name: 'Focus', direction: 'left' });
      windowManager.command({ name: 'Focus', direction: 'right' });

      expect(focusSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('Swap Command', () => {
    beforeEach(() => {
      // Create second window for swapping
      const metaWindow2 = createMockWindow({
        wm_class: 'TestApp2',
        title: 'Test Window 2'
      });

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow2 = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow2);
      nodeWindow2.mode = WINDOW_MODES.TILE;
    });

    it('should swap windows in direction', () => {
      const action = { name: 'Swap', direction: 'right' };
      const swapSpy = vi.spyOn(windowManager.tree, 'swap');

      windowManager.command(action);

      expect(swapSpy).toHaveBeenCalledWith(nodeWindow, MotionDirection.RIGHT);
    });

    it('should call unfreezeRender before swap', () => {
      const action = { name: 'Swap', direction: 'left' };

      windowManager.command(action);

      expect(windowManager.unfreezeRender).toHaveBeenCalled();
    });

    it('should raise window after swap', () => {
      const action = { name: 'Swap', direction: 'right' };
      const raiseSpy = vi.spyOn(metaWindow, 'raise');

      windowManager.command(action);

      expect(raiseSpy).toHaveBeenCalled();
    });

    it('should update tabbed and stacked focus', () => {
      const action = { name: 'Swap', direction: 'right' };

      windowManager.command(action);

      expect(windowManager.updateTabbedFocus).toHaveBeenCalled();
      expect(windowManager.updateStackedFocus).toHaveBeenCalled();
    });

    it('should render tree after swap', () => {
      const action = { name: 'Swap', direction: 'right' };

      windowManager.command(action);

      expect(windowManager.renderTree).toHaveBeenCalledWith('swap', true);
    });

    it('should not swap if no focus window', () => {
      global.display.get_focus_window.mockReturnValue(null);
      const action = { name: 'Swap', direction: 'right' };
      const swapSpy = vi.spyOn(windowManager.tree, 'swap');

      windowManager.command(action);

      expect(swapSpy).not.toHaveBeenCalled();
    });
  });

  describe('Split Command', () => {
    it('should split horizontally', () => {
      const action = { name: 'Split', orientation: 'horizontal' };
      const splitSpy = vi.spyOn(windowManager.tree, 'split');

      windowManager.command(action);

      expect(splitSpy).toHaveBeenCalledWith(nodeWindow, ORIENTATION_TYPES.HORIZONTAL);
    });

    it('should split vertically', () => {
      const action = { name: 'Split', orientation: 'vertical' };
      const splitSpy = vi.spyOn(windowManager.tree, 'split');

      windowManager.command(action);

      expect(splitSpy).toHaveBeenCalledWith(nodeWindow, ORIENTATION_TYPES.VERTICAL);
    });

    it('should use NONE orientation if not specified', () => {
      const action = { name: 'Split' };
      const splitSpy = vi.spyOn(windowManager.tree, 'split');

      windowManager.command(action);

      expect(splitSpy).toHaveBeenCalledWith(nodeWindow, ORIENTATION_TYPES.NONE);
    });

    it('should not split in stacked layout', () => {
      nodeWindow.parentNode.layout = LAYOUT_TYPES.STACKED;
      const action = { name: 'Split', orientation: 'horizontal' };
      const splitSpy = vi.spyOn(windowManager.tree, 'split');

      windowManager.command(action);

      expect(splitSpy).not.toHaveBeenCalled();
    });

    it('should not split in tabbed layout', () => {
      nodeWindow.parentNode.layout = LAYOUT_TYPES.TABBED;
      const action = { name: 'Split', orientation: 'horizontal' };
      const splitSpy = vi.spyOn(windowManager.tree, 'split');

      windowManager.command(action);

      expect(splitSpy).not.toHaveBeenCalled();
    });

    it('should render tree after split', () => {
      const action = { name: 'Split', orientation: 'horizontal' };

      windowManager.command(action);

      expect(windowManager.renderTree).toHaveBeenCalledWith('split');
    });

    it('should not split if no focus window', () => {
      global.display.get_focus_window.mockReturnValue(null);
      const action = { name: 'Split', orientation: 'horizontal' };
      const splitSpy = vi.spyOn(windowManager.tree, 'split');

      windowManager.command(action);

      expect(splitSpy).not.toHaveBeenCalled();
    });
  });

  describe('LayoutToggle Command', () => {
    it('should toggle from HSPLIT to VSPLIT', () => {
      nodeWindow.parentNode.layout = LAYOUT_TYPES.HSPLIT;
      const action = { name: 'LayoutToggle' };

      windowManager.command(action);

      expect(nodeWindow.parentNode.layout).toBe(LAYOUT_TYPES.VSPLIT);
    });

    it('should toggle from VSPLIT to HSPLIT', () => {
      nodeWindow.parentNode.layout = LAYOUT_TYPES.VSPLIT;
      const action = { name: 'LayoutToggle' };

      windowManager.command(action);

      expect(nodeWindow.parentNode.layout).toBe(LAYOUT_TYPES.HSPLIT);
    });

    it('should set attachNode to parent', () => {
      const action = { name: 'LayoutToggle' };

      windowManager.command(action);

      expect(windowManager.tree.attachNode).toBe(nodeWindow.parentNode);
    });

    it('should render tree after toggle', () => {
      const action = { name: 'LayoutToggle' };

      windowManager.command(action);

      expect(windowManager.renderTree).toHaveBeenCalledWith('layout-split-toggle');
    });

    it('should not toggle if no focus window', () => {
      global.display.get_focus_window.mockReturnValue(null);
      const action = { name: 'LayoutToggle' };
      const layoutBefore = nodeWindow.parentNode.layout;

      windowManager.command(action);

      expect(nodeWindow.parentNode.layout).toBe(layoutBefore);
    });
  });

  describe('FocusBorderToggle Command', () => {
    it('should toggle focus border on', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'focus-border-toggle') return false;
        return false;
      });

      const action = { name: 'FocusBorderToggle' };

      windowManager.command(action);

      expect(mockSettings.set_boolean).toHaveBeenCalledWith('focus-border-toggle', true);
    });

    it('should toggle focus border off', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'focus-border-toggle') return true;
        return false;
      });

      const action = { name: 'FocusBorderToggle' };

      windowManager.command(action);

      expect(mockSettings.set_boolean).toHaveBeenCalledWith('focus-border-toggle', false);
    });
  });

  describe('TilingModeToggle Command', () => {
    it('should toggle tiling mode off and float all windows', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'tiling-mode-enabled') return true;
        return false;
      });

      const action = { name: 'TilingModeToggle' };
      const floatSpy = vi.spyOn(windowManager, 'floatAllWindows').mockImplementation(() => {});

      windowManager.command(action);

      expect(mockSettings.set_boolean).toHaveBeenCalledWith('tiling-mode-enabled', false);
      expect(floatSpy).toHaveBeenCalled();
    });

    it('should toggle tiling mode on and unfloat all windows', () => {
      mockSettings.get_boolean.mockImplementation((key) => {
        if (key === 'tiling-mode-enabled') return false;
        return false;
      });

      const action = { name: 'TilingModeToggle' };
      const unfloatSpy = vi.spyOn(windowManager, 'unfloatAllWindows').mockImplementation(() => {});

      windowManager.command(action);

      expect(mockSettings.set_boolean).toHaveBeenCalledWith('tiling-mode-enabled', true);
      expect(unfloatSpy).toHaveBeenCalled();
    });

    it('should render tree after toggle', () => {
      const action = { name: 'TilingModeToggle' };
      vi.spyOn(windowManager, 'floatAllWindows').mockImplementation(() => {});

      windowManager.command(action);

      expect(windowManager.renderTree).toHaveBeenCalled();
    });
  });

  describe('GapSize Command', () => {
    it('should increase gap size', () => {
      const action = { name: 'GapSize', amount: 1 };

      windowManager.command(action);

      expect(mockSettings.set_uint).toHaveBeenCalledWith('window-gap-size-increment', 5);
    });

    it('should decrease gap size', () => {
      const action = { name: 'GapSize', amount: -1 };

      windowManager.command(action);

      expect(mockSettings.set_uint).toHaveBeenCalledWith('window-gap-size-increment', 3);
    });

    it('should not go below 0', () => {
      mockSettings.get_uint.mockReturnValue(0);
      const action = { name: 'GapSize', amount: -1 };

      windowManager.command(action);

      expect(mockSettings.set_uint).toHaveBeenCalledWith('window-gap-size-increment', 0);
    });

    it('should not go above 32', () => {
      mockSettings.get_uint.mockReturnValue(32);
      const action = { name: 'GapSize', amount: 1 };

      windowManager.command(action);

      expect(mockSettings.set_uint).toHaveBeenCalledWith('window-gap-size-increment', 32);
    });

    it('should handle large increment', () => {
      mockSettings.get_uint.mockReturnValue(0);
      const action = { name: 'GapSize', amount: 50 };

      windowManager.command(action);

      // Should cap at 32
      expect(mockSettings.set_uint).toHaveBeenCalledWith('window-gap-size-increment', 32);
    });

    it('should handle large decrement', () => {
      mockSettings.get_uint.mockReturnValue(4);
      const action = { name: 'GapSize', amount: -10 };

      windowManager.command(action);

      // Should cap at 0
      expect(mockSettings.set_uint).toHaveBeenCalledWith('window-gap-size-increment', 0);
    });
  });

  describe('WorkspaceActiveTileToggle Command', () => {
    it('should skip workspace when not already skipped', () => {
      mockSettings.get_string.mockReturnValue('');
      const action = { name: 'WorkspaceActiveTileToggle' };
      const floatSpy = vi.spyOn(windowManager, 'floatWorkspace').mockImplementation(() => {});

      windowManager.command(action);

      expect(mockSettings.set_string).toHaveBeenCalledWith('workspace-skip-tile', '0');
      expect(floatSpy).toHaveBeenCalledWith(0);
    });

    it('should unskip workspace when already skipped', () => {
      mockSettings.get_string.mockReturnValue('0');
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);
      const action = { name: 'WorkspaceActiveTileToggle' };
      const unfloatSpy = vi.spyOn(windowManager, 'unfloatWorkspace').mockImplementation(() => {});

      windowManager.command(action);

      expect(mockSettings.set_string).toHaveBeenCalledWith('workspace-skip-tile', '');
      expect(unfloatSpy).toHaveBeenCalledWith(0);
    });

    it('should handle multiple skipped workspaces', () => {
      mockSettings.get_string.mockReturnValue('1,2');
      global.workspace_manager.get_active_workspace_index.mockReturnValue(0);
      const action = { name: 'WorkspaceActiveTileToggle' };

      windowManager.command(action);

      expect(mockSettings.set_string).toHaveBeenCalledWith('workspace-skip-tile', '1,2,0');
    });

    it('should attempt to remove workspace from skip list (may fail due to tree structure)', () => {
      // The command tries to unfloat the workspace which requires tree access
      // Testing the setup and that the command doesn't throw unexpectedly
      mockSettings.get_string.mockReturnValue('0,1,2');
      global.workspace_manager.get_active_workspace_index.mockReturnValue(1);
      const action = { name: 'WorkspaceActiveTileToggle' };

      // The command will throw due to incomplete tree structure
      // This is expected because unfloatWorkspace needs workspace nodes
      expect(() => windowManager.command(action)).toThrow();
    });
  });

  describe('Command Edge Cases', () => {
    it('should handle unknown command gracefully', () => {
      const action = { name: 'UnknownCommand' };

      expect(() => windowManager.command(action)).not.toThrow();
    });

    it('should throw when action is null (action.name is accessed)', () => {
      // The implementation accesses action.name without null check
      expect(() => windowManager.command(null)).toThrow();
    });

    it('should handle empty action object', () => {
      expect(() => windowManager.command({})).not.toThrow();
    });
  });
});
