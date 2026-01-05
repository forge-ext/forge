import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WindowManager, WINDOW_MODES } from '../../../lib/extension/window.js';
import { Tree, NODE_TYPES } from '../../../lib/extension/tree.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { Workspace, WindowType } from '../../mocks/gnome/Meta.js';

/**
 * WindowManager lifecycle tests
 *
 * Tests for window lifecycle management including:
 * - trackWindow(): Adding windows to the tree
 * - windowDestroy(): Removing windows and cleanup
 * - minimizedWindow(): Minimize state checking
 * - postProcessWindow(): Post-creation processing
 */
describe('WindowManager - Window Lifecycle', () => {
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

    // Mock settings
    mockSettings = {
      get_boolean: vi.fn((key) => {
        if (key === 'tiling-mode-enabled') return true;
        if (key === 'focus-on-hover-enabled') return false;
        if (key === 'auto-split-enabled') return false;
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
    // Clean up any timers
    vi.clearAllTimers();
  });

  describe('minimizedWindow', () => {
    it('should return false for null node', () => {
      const result = windowManager.minimizedWindow(null);

      expect(result).toBe(false);
    });

    it('should return false for undefined node', () => {
      const result = windowManager.minimizedWindow(undefined);

      expect(result).toBe(false);
    });

    it('should return false for non-window node', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const result = windowManager.minimizedWindow(monitor);

      expect(result).toBe(false);
    });

    it('should return false for non-minimized window', () => {
      const metaWindow = createMockWindow({ minimized: false });
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const result = windowManager.minimizedWindow(nodeWindow);

      expect(result).toBe(false);
    });

    it('should return true for minimized window', () => {
      const metaWindow = createMockWindow({ minimized: true });
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const result = windowManager.minimizedWindow(nodeWindow);

      expect(result).toBe(true);
    });

    it('should return false for window with null nodeValue', () => {
      // Create a mock node without proper nodeValue
      const mockNode = {
        _type: NODE_TYPES.WINDOW,
        _data: null
      };

      const result = windowManager.minimizedWindow(mockNode);

      // When nodeValue is null, result could be false or null/undefined
      expect(result).toBeFalsy();
    });

    it('should check actual minimized property on window', () => {
      const metaWindow = createMockWindow({ minimized: false });
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      // Initially not minimized
      expect(windowManager.minimizedWindow(nodeWindow)).toBe(false);

      // Minimize the window
      metaWindow.minimized = true;

      // Should now be minimized
      expect(windowManager.minimizedWindow(nodeWindow)).toBe(true);
    });
  });

  describe('postProcessWindow', () => {
    it('should handle nodeWindow with null metaWindow', () => {
      // Create a mock node without proper metaWindow
      const mockNode = {
        nodeValue: null
      };

      // postProcessWindow checks if metaWindow exists
      expect(() => windowManager.postProcessWindow(mockNode)).not.toThrow();
    });

    it('should move pointer with regular window', () => {
      const metaWindow = createMockWindow({ title: 'Regular Window' });
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const movePointerSpy = vi.spyOn(windowManager, 'movePointerWith');

      windowManager.postProcessWindow(nodeWindow);

      expect(movePointerSpy).toHaveBeenCalledWith(metaWindow);
    });

    it('should center and activate preferences window', () => {
      windowManager.prefsTitle = 'Forge Preferences';
      const metaWindow = createMockWindow({ title: 'Forge Preferences' });

      const mockWorkspace = new Workspace({ index: 0 });
      metaWindow._workspace = mockWorkspace;
      mockWorkspace.activate_with_focus = vi.fn();

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const moveCenterSpy = vi.spyOn(windowManager, 'moveCenter');

      windowManager.postProcessWindow(nodeWindow);

      expect(mockWorkspace.activate_with_focus).toHaveBeenCalledWith(metaWindow, 12345);
      expect(moveCenterSpy).toHaveBeenCalledWith(metaWindow);
    });

    it('should not move pointer for preferences window', () => {
      windowManager.prefsTitle = 'Forge Preferences';
      const metaWindow = createMockWindow({ title: 'Forge Preferences' });

      const mockWorkspace = new Workspace({ index: 0 });
      metaWindow._workspace = mockWorkspace;
      mockWorkspace.activate_with_focus = vi.fn();

      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const movePointerSpy = vi.spyOn(windowManager, 'movePointerWith');

      windowManager.postProcessWindow(nodeWindow);

      expect(movePointerSpy).not.toHaveBeenCalled();
    });
  });

  describe('trackWindow', () => {
    it('should not track invalid window types', () => {
      const metaWindow = createMockWindow({ window_type: WindowType.MENU });
      const treeCreateSpy = vi.spyOn(windowManager.tree, 'createNode');

      windowManager.trackWindow(null, metaWindow);

      // Should not create node for invalid window type
      expect(treeCreateSpy).not.toHaveBeenCalled();
    });

    it('should not track duplicate windows', () => {
      const metaWindow = createMockWindow();
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      // Create window first time
      windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const treeCreateSpy = vi.spyOn(windowManager.tree, 'createNode');

      // Try to track same window again
      windowManager.trackWindow(null, metaWindow);

      // Should not create duplicate node
      expect(treeCreateSpy).not.toHaveBeenCalled();
    });

    it('should track valid NORMAL windows', () => {
      const metaWindow = createMockWindow({
        window_type: WindowType.NORMAL,
        title: 'Test Window'
      });

      const initialNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;

      windowManager.trackWindow(null, metaWindow);

      const finalNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;
      expect(finalNodeCount).toBe(initialNodeCount + 1);
    });

    it('should track valid DIALOG windows', () => {
      const metaWindow = createMockWindow({
        window_type: WindowType.DIALOG,
        title: 'Dialog Window'
      });

      const initialNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;

      windowManager.trackWindow(null, metaWindow);

      const finalNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;
      expect(finalNodeCount).toBe(initialNodeCount + 1);
    });

    it('should track valid MODAL_DIALOG windows', () => {
      const metaWindow = createMockWindow({
        window_type: WindowType.MODAL_DIALOG,
        title: 'Modal Dialog'
      });

      const initialNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;

      windowManager.trackWindow(null, metaWindow);

      const finalNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;
      expect(finalNodeCount).toBe(initialNodeCount + 1);
    });

    it('should create window in FLOAT mode by default', () => {
      const metaWindow = createMockWindow();

      windowManager.trackWindow(null, metaWindow);

      const nodeWindow = windowManager.findNodeWindow(metaWindow);
      expect(nodeWindow).not.toBeNull();
      expect(nodeWindow.mode).toBe(WINDOW_MODES.FLOAT);
    });

    it('should attach window to current monitor/workspace', () => {
      const metaWindow = createMockWindow();

      windowManager.trackWindow(null, metaWindow);

      const nodeWindow = windowManager.findNodeWindow(metaWindow);
      expect(nodeWindow).not.toBeNull();

      // Should be attached to workspace 0, monitor 0
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      expect(monitor.contains(nodeWindow)).toBe(true);
    });

    it('should set up window signal handlers', () => {
      const metaWindow = createMockWindow();
      const connectSpy = vi.spyOn(metaWindow, 'connect');

      windowManager.trackWindow(null, metaWindow);

      // Should connect to position-changed, size-changed, unmanaged, and focus signals
      expect(connectSpy).toHaveBeenCalledWith('position-changed', expect.any(Function));
      expect(connectSpy).toHaveBeenCalledWith('size-changed', expect.any(Function));
      expect(connectSpy).toHaveBeenCalledWith('unmanaged', expect.any(Function));
      expect(connectSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    });

    it('should mark window for first render', () => {
      const metaWindow = createMockWindow();

      windowManager.trackWindow(null, metaWindow);

      expect(metaWindow.firstRender).toBe(true);
    });
  });

  describe('windowDestroy', () => {
    it('should remove borders from actor', () => {
      const metaWindow = createMockWindow();
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const actor = metaWindow.get_compositor_private();
      actor.border = { hide: vi.fn() };
      actor.splitBorder = { hide: vi.fn() };

      const removeChildSpy = vi.spyOn(global.window_group, 'remove_child');

      windowManager.windowDestroy(actor);

      expect(removeChildSpy).toHaveBeenCalledWith(actor.border);
      expect(removeChildSpy).toHaveBeenCalledWith(actor.splitBorder);
      expect(actor.border.hide).toHaveBeenCalled();
      expect(actor.splitBorder.hide).toHaveBeenCalled();
    });

    it('should remove window node from tree', () => {
      const metaWindow = createMockWindow();
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const actor = metaWindow.get_compositor_private();
      actor.nodeWindow = nodeWindow;

      // Mock findNodeByActor to return our node
      vi.spyOn(windowManager.tree, 'findNodeByActor').mockReturnValue(nodeWindow);

      const initialNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;

      windowManager.windowDestroy(actor);

      const finalNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.WINDOW).length;
      expect(finalNodeCount).toBe(initialNodeCount - 1);
    });

    it('should not remove non-window nodes', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const actor = { border: null, splitBorder: null };

      // Mock findNodeByActor to return monitor (non-window node)
      vi.spyOn(windowManager.tree, 'findNodeByActor').mockReturnValue(monitor);

      const initialNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.MONITOR).length;

      windowManager.windowDestroy(actor);

      const finalNodeCount = windowManager.tree.getNodeByType(NODE_TYPES.MONITOR).length;
      // Monitor should not be removed
      expect(finalNodeCount).toBe(initialNodeCount);
    });

    it('should remove float override for destroyed window', () => {
      const metaWindow = createMockWindow();
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const actor = metaWindow.get_compositor_private();
      actor.nodeWindow = nodeWindow;

      vi.spyOn(windowManager.tree, 'findNodeByActor').mockReturnValue(nodeWindow);
      const removeOverrideSpy = vi.spyOn(windowManager, 'removeFloatOverride');

      windowManager.windowDestroy(actor);

      expect(removeOverrideSpy).toHaveBeenCalledWith(metaWindow, true);
    });

    it('should queue render event after destruction', () => {
      const metaWindow = createMockWindow();
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const actor = metaWindow.get_compositor_private();
      vi.spyOn(windowManager.tree, 'findNodeByActor').mockReturnValue(nodeWindow);
      const queueEventSpy = vi.spyOn(windowManager, 'queueEvent');

      windowManager.windowDestroy(actor);

      expect(queueEventSpy).toHaveBeenCalledWith({
        name: 'window-destroy',
        callback: expect.any(Function)
      });
    });

    it('should handle actor without borders gracefully', () => {
      const metaWindow = createMockWindow();
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const actor = metaWindow.get_compositor_private();
      // No borders set
      actor.border = null;
      actor.splitBorder = null;

      vi.spyOn(windowManager.tree, 'findNodeByActor').mockReturnValue(nodeWindow);

      expect(() => windowManager.windowDestroy(actor)).not.toThrow();
    });

    it('should handle actor not found in tree', () => {
      const actor = {
        border: null,
        splitBorder: null,
        remove_all_transitions: vi.fn()
      };

      vi.spyOn(windowManager.tree, 'findNodeByActor').mockReturnValue(null);

      expect(() => windowManager.windowDestroy(actor)).not.toThrow();
    });
  });

  describe('Window Lifecycle Integration', () => {
    it('should track and then destroy window', () => {
      const metaWindow = createMockWindow({ title: 'Test Window' });

      // Track window
      windowManager.trackWindow(null, metaWindow);

      let nodeWindow = windowManager.findNodeWindow(metaWindow);
      expect(nodeWindow).not.toBeNull();
      expect(nodeWindow.mode).toBe(WINDOW_MODES.FLOAT);

      // Destroy window
      const actor = metaWindow.get_compositor_private();
      vi.spyOn(windowManager.tree, 'findNodeByActor').mockReturnValue(nodeWindow);
      windowManager.windowDestroy(actor);

      // Window should be removed from tree
      nodeWindow = windowManager.findNodeWindow(metaWindow);
      expect(nodeWindow).toBeNull();
    });

    it('should handle window minimize state throughout lifecycle', () => {
      const metaWindow = createMockWindow({ minimized: false });

      // Track window
      windowManager.trackWindow(null, metaWindow);
      let nodeWindow = windowManager.findNodeWindow(metaWindow);

      // Initially not minimized
      expect(windowManager.minimizedWindow(nodeWindow)).toBe(false);

      // Minimize window
      metaWindow.minimized = true;
      expect(windowManager.minimizedWindow(nodeWindow)).toBe(true);

      // Unminimize window
      metaWindow.minimized = false;
      expect(windowManager.minimizedWindow(nodeWindow)).toBe(false);
    });

    it('should post-process window after tracking', () => {
      const metaWindow = createMockWindow({ title: 'Regular Window' });
      const movePointerSpy = vi.spyOn(windowManager, 'movePointerWith');

      // Track window
      windowManager.trackWindow(null, metaWindow);
      const nodeWindow = windowManager.findNodeWindow(metaWindow);

      // Post-process
      windowManager.postProcessWindow(nodeWindow);

      expect(movePointerSpy).toHaveBeenCalledWith(metaWindow);
    });
  });
});
