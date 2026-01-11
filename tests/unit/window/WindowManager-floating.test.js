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
    it('should float windows matching wmId and wmClass', () => {
      // Note: The implementation requires wmClass to be specified and match
      mockConfigMgr.windowProps.overrides = [
        { wmId: 12345, wmClass: 'TestApp', mode: 'float' }
      ];

      const window = createMockWindow({ id: 12345, wm_class: 'TestApp', title: 'Test', allows_resize: true });

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

    it('should require wmClass to match even when wmId matches', () => {
      // The implementation requires wmClass to match - it's not optional
      mockConfigMgr.windowProps.overrides = [
        { wmId: 12345, wmClass: 'Firefox', wmTitle: 'Private', mode: 'float' }
      ];

      const window = createMockWindow({
        id: 12345,
        wm_class: 'Chrome',  // Different class - won't match
        title: 'Normal',      // Different title
        allows_resize: true
      });

      // wmClass must match, so this returns false
      expect(windowManager.isFloatingExempt(window)).toBe(false);
    });

    it('should handle multiple overrides', () => {
      // Note: wmClass MUST be specified and match for an override to work
      mockConfigMgr.windowProps.overrides = [
        { wmClass: 'Firefox', mode: 'float' },
        { wmClass: 'Chrome', mode: 'float' },
        { wmClass: 'Calculator', wmTitle: 'Calc', mode: 'float' }
      ];

      const window1 = createMockWindow({ wm_class: 'Firefox', title: 'Test', allows_resize: true });
      const window2 = createMockWindow({ wm_class: 'Chrome', title: 'Test', allows_resize: true });
      const window3 = createMockWindow({ wm_class: 'Calculator', title: 'Calc', allows_resize: true });
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

    it('should throw when action is null (action.mode is accessed)', () => {
      // The implementation accesses action.mode without null check
      expect(() => windowManager.toggleFloatingMode(null, metaWindow)).toThrow();
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

  describe('Override Management', () => {
    describe('addFloatOverride', () => {
      it('should add new float override by wmClass', () => {
        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        const initialLength = mockConfigMgr.windowProps.overrides.length;

        windowManager.addFloatOverride(metaWindow, false);

        const overrides = mockConfigMgr.windowProps.overrides;
        expect(overrides.length).toBe(initialLength + 1);
        expect(overrides[overrides.length - 1]).toEqual({
          wmClass: 'TestApp',
          wmId: undefined,
          mode: 'float'
        });
      });

      it('should add new float override with wmId when requested', () => {
        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.addFloatOverride(metaWindow, true);

        const overrides = mockConfigMgr.windowProps.overrides;
        const addedOverride = overrides[overrides.length - 1];
        expect(addedOverride.wmClass).toBe('TestApp');
        expect(addedOverride.wmId).toBe(123);
        expect(addedOverride.mode).toBe('float');
      });

      it('should not add duplicate override for same wmClass without wmId', () => {
        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.addFloatOverride(metaWindow, false);
        const lengthAfterFirst = mockConfigMgr.windowProps.overrides.length;

        windowManager.addFloatOverride(metaWindow, false);
        const lengthAfterSecond = mockConfigMgr.windowProps.overrides.length;

        expect(lengthAfterSecond).toBe(lengthAfterFirst);
      });

      it('should allow multiple instances with different wmIds', () => {
        const metaWindow1 = createMockWindow({ wm_class: 'TestApp', id: 123 });
        const metaWindow2 = createMockWindow({ wm_class: 'TestApp', id: 456 });

        windowManager.addFloatOverride(metaWindow1, true);
        const lengthAfterFirst = mockConfigMgr.windowProps.overrides.length;

        windowManager.addFloatOverride(metaWindow2, true);
        const lengthAfterSecond = mockConfigMgr.windowProps.overrides.length;

        expect(lengthAfterSecond).toBe(lengthAfterFirst + 1);
      });

      it('should not add duplicate when wmId matches existing override', () => {
        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.addFloatOverride(metaWindow, true);
        const lengthAfterFirst = mockConfigMgr.windowProps.overrides.length;

        windowManager.addFloatOverride(metaWindow, true);
        const lengthAfterSecond = mockConfigMgr.windowProps.overrides.length;

        expect(lengthAfterSecond).toBe(lengthAfterFirst);
      });

      it('should ignore overrides with wmTitle when checking duplicates', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'TestApp', wmTitle: 'Something', mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.addFloatOverride(metaWindow, false);

        const overrides = mockConfigMgr.windowProps.overrides;
        expect(overrides.length).toBe(2); // Both should exist
      });

      it('should update windowProps on WindowManager instance', () => {
        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.addFloatOverride(metaWindow, false);

        expect(windowManager.windowProps).toBe(mockConfigMgr.windowProps);
      });
    });

    describe('removeFloatOverride', () => {
      beforeEach(() => {
        // Reset overrides before each test
        mockConfigMgr.windowProps.overrides = [];
      });

      it('should remove float override by wmClass', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'TestApp', mode: 'float' },
          { wmClass: 'OtherApp', mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.removeFloatOverride(metaWindow, false);

        const overrides = mockConfigMgr.windowProps.overrides;
        expect(overrides.length).toBe(1);
        expect(overrides[0].wmClass).toBe('OtherApp');
      });

      it('should remove float override by wmClass and wmId when requested', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'TestApp', wmId: 123, mode: 'float' },
          { wmClass: 'TestApp', wmId: 456, mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.removeFloatOverride(metaWindow, true);

        const overrides = mockConfigMgr.windowProps.overrides;
        expect(overrides.length).toBe(1);
        expect(overrides[0].wmId).toBe(456);
      });

      it('should not remove overrides with wmTitle (user-defined)', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'TestApp', wmTitle: 'UserRule', mode: 'float' },
          { wmClass: 'TestApp', mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.removeFloatOverride(metaWindow, false);

        const overrides = mockConfigMgr.windowProps.overrides;
        expect(overrides.length).toBe(1);
        expect(overrides[0].wmTitle).toBe('UserRule');
      });

      it('should handle non-existent override gracefully', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'OtherApp', mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        expect(() => {
          windowManager.removeFloatOverride(metaWindow, false);
        }).not.toThrow();

        expect(mockConfigMgr.windowProps.overrides.length).toBe(1);
      });

      it('should remove all matching overrides without wmId filter', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'TestApp', mode: 'float' },
          { wmClass: 'TestApp', wmId: 123, mode: 'float' },
          { wmClass: 'TestApp', wmId: 456, mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.removeFloatOverride(metaWindow, false);

        const overrides = mockConfigMgr.windowProps.overrides;
        expect(overrides.length).toBe(0);
      });

      it('should only remove matching wmId when wmId filter enabled', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'TestApp', mode: 'float' },
          { wmClass: 'TestApp', wmId: 123, mode: 'float' },
          { wmClass: 'TestApp', wmId: 456, mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.removeFloatOverride(metaWindow, true);

        const overrides = mockConfigMgr.windowProps.overrides;
        expect(overrides.length).toBe(2);
        expect(overrides.some(o => o.wmId === 123)).toBe(false);
      });

      it('should update windowProps on WindowManager instance', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'TestApp', mode: 'float' }
        ];

        const metaWindow = createMockWindow({ wm_class: 'TestApp', id: 123 });

        windowManager.removeFloatOverride(metaWindow, false);

        expect(windowManager.windowProps).toBe(mockConfigMgr.windowProps);
      });
    });

    describe('reloadWindowOverrides', () => {
      it('should reload overrides from ConfigManager', () => {
        const newOverrides = [
          { wmClass: 'App1', mode: 'float' },
          { wmClass: 'App2', mode: 'tile' }
        ];

        mockConfigMgr.windowProps.overrides = newOverrides;

        windowManager.reloadWindowOverrides();

        expect(windowManager.windowProps.overrides.length).toBe(2);
      });

      it('should filter out wmId-based overrides', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'App1', mode: 'float' },
          { wmClass: 'App2', wmId: 123, mode: 'float' },
          { wmClass: 'App3', mode: 'tile' }
        ];

        windowManager.reloadWindowOverrides();

        const overrides = windowManager.windowProps.overrides;
        expect(overrides.length).toBe(2);
        expect(overrides.some(o => o.wmId !== undefined)).toBe(false);
      });

      it('should preserve wmTitle-based overrides', () => {
        mockConfigMgr.windowProps.overrides = [
          { wmClass: 'App1', wmTitle: 'Test', mode: 'float' },
          { wmClass: 'App2', wmId: 123, mode: 'float' }
        ];

        windowManager.reloadWindowOverrides();

        const overrides = windowManager.windowProps.overrides;
        expect(overrides.length).toBe(1);
        expect(overrides[0].wmTitle).toBe('Test');
      });

      it('should handle null windowProps gracefully', () => {
        mockConfigMgr.windowProps = null;

        expect(() => {
          windowManager.reloadWindowOverrides();
        }).not.toThrow();
      });

      it('should handle undefined windowProps gracefully', () => {
        mockConfigMgr.windowProps = undefined;

        expect(() => {
          windowManager.reloadWindowOverrides();
        }).not.toThrow();
      });

      it('should handle empty overrides array', () => {
        mockConfigMgr.windowProps.overrides = [];

        windowManager.reloadWindowOverrides();

        expect(windowManager.windowProps.overrides.length).toBe(0);
      });

      it('should update windowProps reference', () => {
        const freshProps = { overrides: [{ wmClass: 'Test', mode: 'float' }] };
        mockConfigMgr.windowProps = freshProps;

        windowManager.reloadWindowOverrides();

        expect(windowManager.windowProps).toBe(freshProps);
      });
    });
  });
});
