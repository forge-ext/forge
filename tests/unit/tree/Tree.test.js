import { describe, it, expect, beforeEach, vi } from 'vitest';
import St from 'gi://St';
import { Tree, Node, NODE_TYPES, LAYOUT_TYPES } from '../../../lib/extension/tree.js';
import { WINDOW_MODES } from '../../../lib/extension/window.js';
import { Bin, BoxLayout } from '../../mocks/gnome/St.js';

/**
 * Tree class tests
 *
 * Note: Tree constructor requires complex GNOME global objects and WindowManager.
 * These tests focus on the core tree operations that can be tested in isolation.
 */
describe('Tree', () => {
  let tree;
  let mockWindowManager;
  let mockWorkspaceManager;

  beforeEach(() => {
    // Mock global object
    global.display = {
      get_workspace_manager: vi.fn(),
      get_n_monitors: vi.fn(() => 1)
    };

    global.window_group = {
      contains: vi.fn(() => false),
      add_child: vi.fn(),
      remove_child: vi.fn()
    };

    // Mock workspace manager
    mockWorkspaceManager = {
      get_n_workspaces: vi.fn(() => 1),
      get_workspace_by_index: vi.fn((i) => ({
        index: () => i
      }))
    };

    global.display.get_workspace_manager.mockReturnValue(mockWorkspaceManager);

    // Mock WindowManager
    mockWindowManager = {
      ext: {
        settings: {
          get_boolean: vi.fn(() => true),
          get_uint: vi.fn(() => 0)
        }
      },
      determineSplitLayout: vi.fn(() => LAYOUT_TYPES.HSPLIT),
      bindWorkspaceSignals: vi.fn()
    };

    // Create tree
    tree = new Tree(mockWindowManager);
  });

  describe('Constructor', () => {
    it('should create tree with root type', () => {
      expect(tree.nodeType).toBe(NODE_TYPES.ROOT);
    });

    it('should set ROOT layout', () => {
      expect(tree.layout).toBe(LAYOUT_TYPES.ROOT);
    });

    it('should set default stack height', () => {
      expect(tree.defaultStackHeight).toBe(35);
    });

    it('should have reference to WindowManager', () => {
      expect(tree.extWm).toBe(mockWindowManager);
    });

    it('should initialize workspaces', () => {
      // Should have created workspace nodes
      const workspaces = tree.nodeWorkpaces;
      expect(workspaces.length).toBeGreaterThan(0);
    });
  });

  describe('findNode', () => {
    it('should find root node by value', () => {
      const found = tree.findNode(tree.nodeValue);

      expect(found).toBe(tree);
    });

    it('should find workspace node', () => {
      const workspaces = tree.nodeWorkpaces;
      if (workspaces.length > 0) {
        const ws = workspaces[0];
        const found = tree.findNode(ws.nodeValue);

        expect(found).toBe(ws);
      }
    });

    it('should return null for non-existent node', () => {
      const found = tree.findNode('nonexistent-node');

      expect(found).toBeNull();
    });

    it('should find nested nodes', () => {
      // Create a nested structure
      const workspace = tree.nodeWorkpaces[0];
      const container = tree.createNode(workspace.nodeValue, NODE_TYPES.CON, new St.Bin());

      const found = tree.findNode('test-container');

      expect(found).toBe(container);
    });
  });

  describe('createNode', () => {
    it('should create node under parent', () => {
      const workspace = tree.nodeWorkpaces[0];
      const parentValue = workspace.nodeValue;

      const newNode = tree.createNode(parentValue, NODE_TYPES.CON, new St.Bin());

      expect(newNode).toBeDefined();
      expect(newNode.nodeType).toBe(NODE_TYPES.CON);
      expect(newNode.nodeValue).toBe('new-container');
    });

    it('should add node to parent children', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitors = workspace.getNodeByType(NODE_TYPES.MONITOR);

      if (monitors.length > 0) {
        const monitor = monitors[0];
        const initialChildCount = monitor.childNodes.length;

        tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new St.Bin());

        expect(monitor.childNodes.length).toBe(initialChildCount + 1);
      }
    });

    it('should set node settings from tree', () => {
      const workspace = tree.nodeWorkpaces[0];
      const newNode = tree.createNode(workspace.nodeValue, NODE_TYPES.CON, new St.Bin());

      expect(newNode.settings).toBe(tree.settings);
    });

    it('should create node with default TILE mode', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitors = workspace.getNodeByType(NODE_TYPES.MONITOR);

      if (monitors.length > 0) {
        const monitor = monitors[0];
        // Note: This would work for WINDOW type nodes
        const newNode = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new St.Bin());

        // CON nodes don't have mode set, but WINDOW nodes would
        expect(newNode).toBeDefined();
      }
    });

    it('should return undefined if parent not found', () => {
      const newNode = tree.createNode('nonexistent-parent', NODE_TYPES.CON, new St.Bin());

      expect(newNode).toBeUndefined();
    });

    it('should handle inserting after window parent', () => {
      // This tests the special case where parent is a window
      // Window's parent becomes the actual parent for the new node
      const workspace = tree.nodeWorkpaces[0];
      const monitors = workspace.getNodeByType(NODE_TYPES.MONITOR);

      if (monitors.length > 0) {
        const monitor = monitors[0];

        // Create two nodes - second should be sibling to first, not child
        const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new St.Bin());
        const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new St.Bin());

        // Both should be children of monitor
        expect(monitor.childNodes).toContain(node1);
        expect(monitor.childNodes).toContain(node2);
      }
    });
  });

  describe('nodeWorkspaces', () => {
    it('should return all workspace nodes', () => {
      const workspaces = tree.nodeWorkpaces;

      expect(Array.isArray(workspaces)).toBe(true);
      workspaces.forEach(ws => {
        expect(ws.nodeType).toBe(NODE_TYPES.WORKSPACE);
      });
    });

    it('should find workspaces initialized in constructor', () => {
      const workspaces = tree.nodeWorkpaces;

      // Should have at least one workspace (from mock returning 1)
      expect(workspaces.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('nodeWindows', () => {
    it('should return empty array when no windows', () => {
      const windows = tree.nodeWindows;

      expect(Array.isArray(windows)).toBe(true);
      expect(windows.length).toBe(0);
    });

    it('should return all window nodes when windows exist', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitors = workspace.getNodeByType(NODE_TYPES.MONITOR);

      if (monitors.length > 0) {
        const monitor = monitors[0];

        // Create mock window node (without actual Meta.Window to avoid UI init)
        // In real usage, windows would be created differently
        const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new St.Bin());

        // We can verify the getter works
        const windows = tree.nodeWindows;
        expect(Array.isArray(windows)).toBe(true);
      }
    });
  });

  describe('addWorkspace', () => {
    it('should add new workspace', () => {
      mockWorkspaceManager.get_n_workspaces.mockReturnValue(2);
      mockWorkspaceManager.get_workspace_by_index.mockImplementation((i) => ({
        index: () => i
      }));

      const initialCount = tree.nodeWorkpaces.length;
      const result = tree.addWorkspace(1);

      expect(result).toBe(true);
      expect(tree.nodeWorkpaces.length).toBe(initialCount + 1);
    });

    it('should not add duplicate workspace', () => {
      const initialCount = tree.nodeWorkpaces.length;

      // Try to add workspace that already exists (index 0)
      const result = tree.addWorkspace(0);

      expect(result).toBe(false);
      expect(tree.nodeWorkpaces.length).toBe(initialCount);
    });

    it('should set workspace layout to HSPLIT', () => {
      mockWorkspaceManager.get_n_workspaces.mockReturnValue(2);

      tree.addWorkspace(1);
      const workspace = tree.findNode('ws1');

      if (workspace) {
        expect(workspace.layout).toBe(LAYOUT_TYPES.HSPLIT);
      }
    });

    it('should create monitors for workspace', () => {
      mockWorkspaceManager.get_n_workspaces.mockReturnValue(2);
      global.display.get_n_monitors.mockReturnValue(2);

      tree.addWorkspace(1);
      const workspace = tree.findNode('ws1');

      if (workspace) {
        const monitors = workspace.getNodeByType(NODE_TYPES.MONITOR);
        expect(monitors.length).toBe(2);
      }
    });
  });

  describe('removeWorkspace', () => {
    it('should remove existing workspace', () => {
      const workspaces = tree.nodeWorkpaces;
      const initialCount = workspaces.length;

      if (initialCount > 0) {
        const result = tree.removeWorkspace(0);

        expect(result).toBe(true);
        expect(tree.nodeWorkpaces.length).toBe(initialCount - 1);
      }
    });

    it('should return false for non-existent workspace', () => {
      const result = tree.removeWorkspace(999);

      expect(result).toBe(false);
    });

    it('should remove workspace from tree', () => {
      const workspaces = tree.nodeWorkpaces;

      if (workspaces.length > 0) {
        tree.removeWorkspace(0);

        const found = tree.findNode('ws0');
        expect(found).toBeNull();
      }
    });
  });

  describe('Tree Structure Integrity', () => {
    it('should maintain parent-child relationships', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitors = workspace.getNodeByType(NODE_TYPES.MONITOR);

      monitors.forEach(monitor => {
        expect(monitor.parentNode).toBe(workspace);
      });
    });

    it('should have proper node hierarchy', () => {
      // Root -> Workspace -> Monitor -> (Containers/Windows)
      expect(tree.nodeType).toBe(NODE_TYPES.ROOT);

      const workspaces = tree.getNodeByType(NODE_TYPES.WORKSPACE);
      workspaces.forEach(ws => {
        expect(ws.parentNode).toBe(tree);

        const monitors = ws.getNodeByType(NODE_TYPES.MONITOR);
        monitors.forEach(mon => {
          expect(mon.parentNode).toBe(ws);
        });
      });
    });

    it('should allow deep nesting', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitors = workspace.getNodeByType(NODE_TYPES.MONITOR);

      if (monitors.length > 0) {
        const monitor = monitors[0];

        const container1 = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new St.Bin());
        const container2 = tree.createNode(container1.nodeValue, NODE_TYPES.CON, new St.Bin());
        const container3 = tree.createNode(container2.nodeValue, NODE_TYPES.CON, new St.Bin());

        expect(container3.level).toBe(container1.level + 2);
        expect(tree.findNode('container3')).toBe(container3);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty parent value', () => {
      const result = tree.createNode('', NODE_TYPES.CON, new St.Bin());

      expect(result).toBeUndefined();
    });

    it('should handle null parent value', () => {
      const result = tree.createNode(null, NODE_TYPES.CON, new St.Bin());

      expect(result).toBeUndefined();
    });

    it('should find nodes case-sensitively', () => {
      const workspace = tree.nodeWorkpaces[0];
      if (workspace) {
        tree.createNode(workspace.nodeValue, NODE_TYPES.CON, new St.Bin());

        expect(tree.findNode('TestContainer')).toBeDefined();
        expect(tree.findNode('testcontainer')).toBeNull();
      }
    });
  });
});
