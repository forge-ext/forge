import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowManager, WINDOW_MODES } from '../../../lib/extension/window.js';
import { Tree, NODE_TYPES } from '../../../lib/extension/tree.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { WindowType, Workspace } from '../../mocks/gnome/Meta.js';

/**
 * WindowManager floating mode tests
 *
 * Tests for isFloatingExempt and toggleFloatingMode
 */
describe('WindowManager - Floating Mode', () => {
  let windowManager;
  let mockExtension;
  let mockSettings;
  let mockConfigMgr;

  beforeEach(() => {
    // Mock global
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
        if (key === 'focus-on-hover-enabled') return false;
        if (key === 'tiling-mode-enabled') return true;
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

  describe('_validWindow', () => {
    it('should accept NORMAL windows', () => {
      const window = createMockWindow({ window_type: WindowType.NORMAL });

      expect(windowManager._validWindow(window)).toBe(true);
    });

    it('should accept MODAL_DIALOG windows', () => {
      const window = createMockWindow({ window_type: WindowType.MODAL_DIALOG });

      expect(windowManager._validWindow(window)).toBe(true);
    });

    it('should accept DIALOG windows', () => {
      const window = createMockWindow({ window_type: WindowType.DIALOG });

      expect(windowManager._validWindow(window)).toBe(true);
    });

    it('should reject MENU windows', () => {
      const window = createMockWindow({ window_type: WindowType.MENU });

      expect(windowManager._validWindow(window)).toBe(false);
    });

    it('should reject DROPDOWN_MENU windows', () => {
      const window = createMockWindow({ window_type: WindowType.DROPDOWN_MENU });

      expect(windowManager._validWindow(window)).toBe(false);
    });

    it('should reject POPUP_MENU windows', () => {
      const window = createMockWindow({ window_type: WindowType.POPUP_MENU });

      expect(windowManager._validWindow(window)).toBe(false);
    });
  });

  describe('isFloatingExempt - Type-based', () => {
    it('should float DIALOG windows', () => {
      const window = createMockWindow({ window_type: WindowType.DIALOG });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should float MODAL_DIALOG windows', () => {
      const window = createMockWindow({ window_type: WindowType.MODAL_DIALOG });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should NOT float NORMAL windows by type alone', () => {
      const window = createMockWindow({
        window_type: WindowType.NORMAL,
        wm_class: 'TestApp',
        title: 'Test Window',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window)).toBe(false);
    });

    it('should float windows with transient parent', () => {
      const parentWindow = createMockWindow();
      const childWindow = createMockWindow({
        transient_for: parentWindow
      });

      expect(windowManager.isFloatingExempt(childWindow)).toBe(true);
    });

    it('should float windows without wm_class', () => {
      const window = createMockWindow({ wm_class: null });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should float windows without title', () => {
      const window = createMockWindow({ title: null });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should float windows with empty title', () => {
      const window = createMockWindow({ title: '' });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should float windows that do not allow resize', () => {
      const window = createMockWindow({ allows_resize: false });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should return true for null window', () => {
      expect(windowManager.isFloatingExempt(null)).toBe(true);
    });
  });

  describe('isFloatingExempt - Override by wmClass', () => {
    it('should float windows matching wmClass override', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', mode: 'float' }
      ];

      const window = createMockWindow({ wm_class: 'Firefox', title: 'Test', allows_resize: true });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should NOT float windows not matching wmClass override', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', mode: 'float' }
      ];

      const window = createMockWindow({ wm_class: 'Chrome', title: 'Test', allows_resize: true });

      expect(windowManager.isFloatingExempt(window)).toBe(false);
    });

    it('should ignore tile mode overrides when checking float', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', mode: 'tile' }
      ];

      const window = createMockWindow({ wm_class: 'Firefox', title: 'Test', allows_resize: true });

      expect(windowManager.isFloatingExempt(window)).toBe(false);
    });
  });

  describe('isFloatingExempt - Override by wmTitle', () => {
    it('should float windows matching wmTitle substring', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', wmTitle: 'Private', mode: 'float' }
      ];

      const window = createMockWindow({
        wm_class: 'Firefox',
        title: 'Mozilla Firefox Private Browsing',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should NOT float windows not matching wmTitle', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', wmTitle: 'Private', mode: 'float' }
      ];

      const window = createMockWindow({
        wm_class: 'Firefox',
        title: 'Mozilla Firefox',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window)).toBe(false);
    });

    it('should handle multiple titles in wmTitle (comma-separated)', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Code', wmTitle: 'Settings,Preferences', mode: 'float' }
      ];

      const window1 = createMockWindow({
        wm_class: 'Code',
        title: 'VS Code Settings',
        allows_resize: true
      });

      const window2 = createMockWindow({
        wm_class: 'Code',
        title: 'VS Code Preferences',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window1)).toBe(true);
      expect(windowManager.isFloatingExempt(window2)).toBe(true);
    });

    it('should handle negated title matching (!prefix)', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Terminal', wmTitle: '!root', mode: 'float' }
      ];

      const window1 = createMockWindow({
        wm_class: 'Terminal',
        title: 'user@host',
        allows_resize: true
      });

      const window2 = createMockWindow({
        wm_class: 'Terminal',
        title: 'root@host',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window1)).toBe(true);
      expect(windowManager.isFloatingExempt(window2)).toBe(false);
    });

    it('should match exact single space title', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Test', wmTitle: ' ', mode: 'float' }
      ];

      const window1 = createMockWindow({
        wm_class: 'Test',
        title: ' ',
        allows_resize: true
      });

      const window2 = createMockWindow({
        wm_class: 'Test',
        title: '  ',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window1)).toBe(true);
      expect(windowManager.isFloatingExempt(window2)).toBe(false);
    });
  });

  describe('isFloatingExempt - Override by wmId', () => {
    it('should float windows matching wmId', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmId: 12345, mode: 'float' }
      ];

      const window = createMockWindow({ id: 12345, title: 'Test', allows_resize: true });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should NOT float windows not matching wmId', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmId: 12345, mode: 'float' }
      ];

      const window = createMockWindow({ id: 67890, title: 'Test', allows_resize: true });

      expect(windowManager.isFloatingExempt(window)).toBe(false);
    });
  });

  describe('isFloatingExempt - Combined Overrides', () => {
    it('should match when wmClass AND wmTitle both match', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', wmTitle: 'Private', mode: 'float' }
      ];

      const window = createMockWindow({
        wm_class: 'Firefox',
        title: 'Private Browsing',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should NOT match when only wmClass matches', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', wmTitle: 'Private', mode: 'float' }
      ];

      const window = createMockWindow({
        wm_class: 'Firefox',
        title: 'Normal Browsing',
        allows_resize: true
      });

      expect(windowManager.isFloatingExempt(window)).toBe(false);
    });

    it('should match when wmId matches (wmClass/wmTitle optional)', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmId: 12345, wmClass: 'Firefox', wmTitle: 'Private', mode: 'float' }
      ];

      const window = createMockWindow({
        id: 12345,
        wm_class: 'Chrome',  // Different class
        title: 'Normal',      // Different title
        allows_resize: true
      });

      // wmId match is sufficient
      expect(windowManager.isFloatingExempt(window)).toBe(true);
    });

    it('should handle multiple overrides', () => {
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', mode: 'float' },
        { wmClass: 'Chrome', mode: 'float' },
        { wmTitle: 'Calculator', mode: 'float' }
      ];

      const window1 = createMockWindow({ wm_class: 'Firefox', title: 'Test', allows_resize: true });
      const window2 = createMockWindow({ wm_class: 'Chrome', title: 'Test', allows_resize: true });
      const window3 = createMockWindow({ wm_class: 'Other', title: 'Calculator', allows_resize: true });
      const window4 = createMockWindow({ wm_class: 'Other', title: 'Other', allows_resize: true });

      expect(windowManager.isFloatingExempt(window1)).toBe(true);
      expect(windowManager.isFloatingExempt(window2)).toBe(true);
      expect(windowManager.isFloatingExempt(window3)).toBe(true);
      expect(windowManager.isFloatingExempt(window4)).toBe(false);
    });
  });

  describe('toggleFloatingMode', () => {
    let metaWindow;
    let nodeWindow;

    beforeEach(() => {
      metaWindow = createMockWindow({
        wm_class: 'TestApp',
        title: 'Test Window',
        allows_resize: true
      });

      // Add window to tree
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);
      nodeWindow.mode = WINDOW_MODES.TILE;

      global.display.get_focus_window.mockReturnValue(metaWindow);
    });

    it('should toggle from tile to float', () => {
      const action = { name: 'FloatToggle', mode: WINDOW_MODES.FLOAT };

      windowManager.toggleFloatingMode(action, metaWindow);

      expect(nodeWindow.mode).toBe(WINDOW_MODES.FLOAT);
    });

    it('should add float override when toggling to float', () => {
      const action = { name: 'FloatToggle', mode: WINDOW_MODES.FLOAT };
      const addSpy = vi.spyOn(windowManager, 'addFloatOverride');

      windowManager.toggleFloatingMode(action, metaWindow);

      expect(addSpy).toHaveBeenCalledWith(metaWindow, true);
    });

    it('should toggle from float to tile when override exists', () => {
      nodeWindow.mode = WINDOW_MODES.FLOAT;
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'TestApp', mode: 'float' }
      ];

      const action = { name: 'FloatToggle', mode: WINDOW_MODES.TILE };

      windowManager.toggleFloatingMode(action, metaWindow);

      expect(nodeWindow.mode).toBe(WINDOW_MODES.TILE);
    });

    it('should remove float override when toggling from float', () => {
      nodeWindow.mode = WINDOW_MODES.FLOAT;
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'TestApp', mode: 'float' }
      ];

      const action = { name: 'FloatToggle', mode: WINDOW_MODES.TILE };
      const removeSpy = vi.spyOn(windowManager, 'removeFloatOverride');

      windowManager.toggleFloatingMode(action, metaWindow);

      expect(removeSpy).toHaveBeenCalledWith(metaWindow, true);
    });

    it('should handle FloatClassToggle action', () => {
      const action = { name: 'FloatClassToggle', mode: WINDOW_MODES.FLOAT };
      const addSpy = vi.spyOn(windowManager, 'addFloatOverride');

      windowManager.toggleFloatingMode(action, metaWindow);

      expect(addSpy).toHaveBeenCalledWith(metaWindow, false);
    });

    it('should handle null action gracefully', () => {
      expect(() => windowManager.toggleFloatingMode(null, metaWindow)).not.toThrow();
    });

    it('should handle null metaWindow gracefully', () => {
      const action = { name: 'FloatToggle', mode: WINDOW_MODES.FLOAT };

      expect(() => windowManager.toggleFloatingMode(action, null)).not.toThrow();
    });

    it('should not toggle non-window nodes', () => {
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const action = { name: 'FloatToggle', mode: WINDOW_MODES.FLOAT };

      const modeBefore = monitor.mode;
      windowManager.toggleFloatingMode(action, monitor.nodeValue);

      // Should not change
      expect(monitor.mode).toBe(modeBefore);
    });
  });

  describe('findNodeWindow', () => {
    it('should find window in tree', () => {
      const metaWindow = createMockWindow();
      const workspace = windowManager.tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const nodeWindow = windowManager.tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, metaWindow);

      const found = windowManager.findNodeWindow(metaWindow);

      expect(found).toBe(nodeWindow);
    });

    it('should return null for window not in tree', () => {
      const metaWindow = createMockWindow();

      const found = windowManager.findNodeWindow(metaWindow);

      expect(found).toBeNull();
    });
  });

  describe('Getters', () => {
    it('should get focusMetaWindow from display', () => {
      const metaWindow = createMockWindow();
      global.display.get_focus_window.mockReturnValue(metaWindow);

      expect(windowManager.focusMetaWindow).toBe(metaWindow);
    });

    it('should get tree instance', () => {
      expect(windowManager.tree).toBeInstanceOf(Tree);
    });

    it('should return same tree instance on multiple accesses', () => {
      const tree1 = windowManager.tree;
      const tree2 = windowManager.tree;

      expect(tree1).toBe(tree2);
    });
  });
});
