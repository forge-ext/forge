import { describe, it, expect, beforeEach, vi } from 'vitest';
import St from 'gi://St';
import { Tree, Node, NODE_TYPES, LAYOUT_TYPES, ORIENTATION_TYPES } from '../../../lib/extension/tree.js';
import { WINDOW_MODES } from '../../../lib/extension/window.js';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { Bin } from '../../mocks/gnome/St.js';
import { MotionDirection } from '../../mocks/gnome/Meta.js';

/**
 * Tree manipulation operations tests
 *
 * Tests for move, swap, split, and navigation operations
 */
describe('Tree Operations', () => {
  let tree;
  let mockWindowManager;
  let mockWorkspaceManager;

  beforeEach(() => {
    // Mock global object
    global.display = {
      get_workspace_manager: vi.fn(),
      get_n_monitors: vi.fn(() => 1),
      get_monitor_neighbor_index: vi.fn(() => -1),
      get_current_time: vi.fn(() => 12345)
    };

    global.window_group = {
      contains: vi.fn(() => false),
      add_child: vi.fn(),
      remove_child: vi.fn()
    };

    global.get_current_time = vi.fn(() => 12345);

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
          get_boolean: vi.fn(() => false),
          get_uint: vi.fn(() => 0)
        }
      },
      determineSplitLayout: vi.fn(() => LAYOUT_TYPES.HSPLIT),
      bindWorkspaceSignals: vi.fn(),
      move: vi.fn(),
      movePointerWith: vi.fn(),
      getPointer: vi.fn(() => [100, 100]),
      focusMetaWindow: null,
      currentMonWsNode: null,
      rectForMonitor: vi.fn((node, monitorIndex) => ({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      })),
      sameParentMonitor: vi.fn(() => true),
      floatingWindow: vi.fn(() => false)
    };

    // Create tree
    tree = new Tree(mockWindowManager);

    // Setup currentMonWsNode for tests
    mockWindowManager.currentMonWsNode = tree.nodeWorkpaces[0]?.getNodeByType(NODE_TYPES.MONITOR)[0];
  });

  describe('Helper Methods', () => {
    describe('_swappable', () => {
      it('should return true for non-minimized window', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
        const window = createMockWindow({ minimized: false });
        const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);
        node.mode = WINDOW_MODES.TILE;

        expect(tree._swappable(node)).toBe(true);
      });

      it('should return false for minimized window', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
        const window = createMockWindow({ minimized: true });
        const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);

        expect(tree._swappable(node)).toBe(false);
      });

      it('should return false for null node', () => {
        expect(tree._swappable(null)).toBe(false);
      });

      it('should return false for non-window node', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

        expect(tree._swappable(monitor)).toBe(false);
      });
    });

    describe('resetSiblingPercent', () => {
      it('should reset all children percent to 0', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

        // Create container with children that have custom percents
        const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
        const window1 = createMockWindow();
        const window2 = createMockWindow();
        const node1 = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window1);
        const node2 = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window2);

        node1.percent = 0.7;
        node2.percent = 0.3;

        tree.resetSiblingPercent(container);

        expect(node1.percent).toBe(0.0);
        expect(node2.percent).toBe(0.0);
      });

      it('should handle null parent gracefully', () => {
        expect(() => tree.resetSiblingPercent(null)).not.toThrow();
      });

      it('should handle parent with no children', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
        const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());

        expect(() => tree.resetSiblingPercent(container)).not.toThrow();
      });
    });

    describe('findFirstNodeWindowFrom', () => {
      it('should find first window in node', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
        const window1 = createMockWindow();
        const window2 = createMockWindow();
        const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
        tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

        const found = tree.findFirstNodeWindowFrom(monitor);

        expect(found).toBe(node1);
      });

      it('should find first window in nested container', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
        const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
        const window = createMockWindow();
        const node = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window);

        const found = tree.findFirstNodeWindowFrom(container);

        expect(found).toBe(node);
      });

      it('should return null if no windows', () => {
        const workspace = tree.nodeWorkpaces[0];
        const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

        const found = tree.findFirstNodeWindowFrom(monitor);

        expect(found).toBeNull();
      });
    });
  });

  describe('next', () => {
    it('should find next sibling to the right', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      const next = tree.next(node1, MotionDirection.RIGHT);

      expect(next).toBe(node2);
    });

    it('should find next sibling to the left', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      const next = tree.next(node2, MotionDirection.LEFT);

      expect(next).toBe(node1);
    });

    it('should find next sibling downward', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.VSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      const next = tree.next(node1, MotionDirection.DOWN);

      expect(next).toBe(node2);
    });

    it('should find next sibling upward', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.VSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      const next = tree.next(node2, MotionDirection.UP);

      expect(next).toBe(node1);
    });

    it('should return null for node at end', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);

      const next = tree.next(node, MotionDirection.RIGHT);

      // Should return null or the parent, depending on tree structure
      expect(next).toBeDefined();
    });

    it('should handle null node', () => {
      const next = tree.next(null, MotionDirection.RIGHT);

      expect(next).toBeNull();
    });

    it('should navigate across different orientations', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      container.layout = LAYOUT_TYPES.VSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      // Try to navigate from container to sibling
      const next = tree.next(container, MotionDirection.RIGHT);

      expect(next).toBe(node2);
    });
  });

  describe('split', () => {
    it('should create horizontal split container', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);

      tree.split(node, ORIENTATION_TYPES.HORIZONTAL, true);

      // Node should now be inside a container
      expect(node.parentNode.nodeType).toBe(NODE_TYPES.CON);
      expect(node.parentNode.layout).toBe(LAYOUT_TYPES.HSPLIT);
    });

    it('should create vertical split container', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);

      tree.split(node, ORIENTATION_TYPES.VERTICAL, true);

      // Node should now be inside a container
      expect(node.parentNode.nodeType).toBe(NODE_TYPES.CON);
      expect(node.parentNode.layout).toBe(LAYOUT_TYPES.VSPLIT);
    });

    it('should toggle split direction if single child', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;

      const window = createMockWindow();
      const node = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window);

      // Split should toggle the parent layout
      tree.split(node, ORIENTATION_TYPES.VERTICAL, false);

      expect(container.layout).toBe(LAYOUT_TYPES.VSPLIT);
    });

    it('should not toggle if forceSplit is true', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;

      const window = createMockWindow();
      const node = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window);

      tree.split(node, ORIENTATION_TYPES.VERTICAL, true);

      // Should create new container instead of toggling
      expect(node.parentNode.layout).toBe(LAYOUT_TYPES.VSPLIT);
      expect(node.parentNode.parentNode).toBe(container);
    });

    it('should ignore floating windows', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);
      node.mode = WINDOW_MODES.FLOAT;

      const parentBefore = node.parentNode;
      tree.split(node, ORIENTATION_TYPES.HORIZONTAL);

      // Should not have changed
      expect(node.parentNode).toBe(parentBefore);
    });

    it('should preserve node rect and percent', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);
      node.rect = { x: 100, y: 100, width: 500, height: 500 };
      node.percent = 0.6;

      tree.split(node, ORIENTATION_TYPES.HORIZONTAL, true);

      const container = node.parentNode;
      expect(container.rect).toEqual({ x: 100, y: 100, width: 500, height: 500 });
      expect(container.percent).toBe(0.6);
    });

    it('should set attachNode to new container', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);

      tree.split(node, ORIENTATION_TYPES.HORIZONTAL, true);

      expect(tree.attachNode).toBe(node.parentNode);
    });

    it('should handle null node', () => {
      expect(() => tree.split(null, ORIENTATION_TYPES.HORIZONTAL)).not.toThrow();
    });
  });

  describe('swapPairs', () => {
    it('should swap two windows in same parent', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;

      // Store original indexes
      const index1Before = node1.index;
      const index2Before = node2.index;

      tree.swapPairs(node1, node2, false);

      // Indexes should be swapped
      expect(node1.index).toBe(index2Before);
      expect(node2.index).toBe(index1Before);
    });

    it('should swap windows in different parents', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const container1 = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      const container2 = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(container1.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(container2.nodeValue, NODE_TYPES.WINDOW, window2);

      tree.swapPairs(node1, node2, false);

      // Parents should be swapped
      expect(node1.parentNode).toBe(container2);
      expect(node2.parentNode).toBe(container1);
    });

    it('should exchange modes', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.FLOAT;

      tree.swapPairs(node1, node2, false);

      expect(node1.mode).toBe(WINDOW_MODES.FLOAT);
      expect(node2.mode).toBe(WINDOW_MODES.TILE);
    });

    it('should exchange percents', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.percent = 0.7;
      node2.percent = 0.3;

      tree.swapPairs(node1, node2, false);

      expect(node1.percent).toBe(0.3);
      expect(node2.percent).toBe(0.7);
    });

    it('should call WindowManager.move for both windows', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      tree.swapPairs(node1, node2, false);

      expect(mockWindowManager.move).toHaveBeenCalledTimes(2);
    });

    it('should focus first window if focus=true', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      const raiseSpy = vi.spyOn(window1, 'raise');
      const focusSpy = vi.spyOn(window1, 'focus');

      tree.swapPairs(node1, node2, true);

      expect(raiseSpy).toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should not swap if first node not swappable', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow({ minimized: true });
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      const parentBefore = node1.parentNode;
      tree.swapPairs(node1, node2, false);

      // Should not have swapped
      expect(node1.parentNode).toBe(parentBefore);
    });

    it('should not swap if second node not swappable', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow({ minimized: true });
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      const parentBefore = node1.parentNode;
      tree.swapPairs(node1, node2, false);

      // Should not have swapped
      expect(node1.parentNode).toBe(parentBefore);
    });
  });

  describe('swap', () => {
    it('should swap with next window to the right', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;

      const result = tree.swap(node1, MotionDirection.RIGHT);

      expect(result).toBe(node2);
    });

    it('should swap with first window in container', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      node1.mode = WINDOW_MODES.TILE;

      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;

      const window2 = createMockWindow();
      const window3 = createMockWindow();
      const node2 = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window2);
      const node3 = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window3);

      node2.mode = WINDOW_MODES.TILE;
      node3.mode = WINDOW_MODES.TILE;

      const result = tree.swap(node1, MotionDirection.RIGHT);

      // Should swap with first window in container
      expect(result).toBe(node2);
    });

    it('should swap with last window in stacked container', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      node1.mode = WINDOW_MODES.TILE;

      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      container.layout = LAYOUT_TYPES.STACKED;

      const window2 = createMockWindow();
      const window3 = createMockWindow();
      const node2 = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window2);
      const node3 = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window3);

      node2.mode = WINDOW_MODES.TILE;
      node3.mode = WINDOW_MODES.TILE;

      const result = tree.swap(node1, MotionDirection.RIGHT);

      // Should swap with last window in stacked container
      expect(result).toBe(node3);
    });

    it('should return undefined if no next node', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);

      // Mock next to return null
      vi.spyOn(tree, 'next').mockReturnValue(null);

      const result = tree.swap(node, MotionDirection.RIGHT);

      expect(result).toBeUndefined();
    });

    it('should return undefined if nodes not in same monitor', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;

      // Mock sameParentMonitor to return false
      mockWindowManager.sameParentMonitor.mockReturnValue(false);

      const result = tree.swap(node1, MotionDirection.RIGHT);

      expect(result).toBeUndefined();
    });
  });

  describe('move', () => {
    it('should move window to the right', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const window3 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);
      const node3 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window3);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;
      node3.mode = WINDOW_MODES.TILE;

      // Move node1 to the right (should swap with node2)
      const result = tree.move(node1, MotionDirection.RIGHT);

      expect(result).toBe(true);
      // node1 should now be at index 1 (swapped with node2)
      expect(node1.index).toBe(1);
    });

    it('should move window to the left', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;

      // Move node2 to the left (should swap with node1)
      const result = tree.move(node2, MotionDirection.LEFT);

      expect(result).toBe(true);
      expect(node2.index).toBe(0);
    });

    it('should swap siblings using swapPairs', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;

      const swapPairsSpy = vi.spyOn(tree, 'swapPairs');

      tree.move(node1, MotionDirection.RIGHT);

      expect(swapPairsSpy).toHaveBeenCalledWith(node1, node2);
    });

    it('should move window into container', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      node1.mode = WINDOW_MODES.TILE;

      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;

      const window2 = createMockWindow();
      const node2 = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window2);
      node2.mode = WINDOW_MODES.TILE;

      tree.move(node1, MotionDirection.RIGHT);

      // node1 should now be inside container
      expect(node1.parentNode).toBe(container);
    });

    it('should reset sibling percent after move', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const window2 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;

      const resetSpy = vi.spyOn(tree, 'resetSiblingPercent');

      tree.move(node1, MotionDirection.RIGHT);

      expect(resetSpy).toHaveBeenCalled();
    });

    it('should return false if no next node', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);

      // Mock next to return null
      vi.spyOn(tree, 'next').mockReturnValue(null);

      const result = tree.move(node, MotionDirection.RIGHT);

      expect(result).toBe(false);
    });

    it('should handle moving into stacked container', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];
      monitor.layout = LAYOUT_TYPES.HSPLIT;

      const window1 = createMockWindow();
      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      node1.mode = WINDOW_MODES.TILE;

      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      container.layout = LAYOUT_TYPES.STACKED;

      const window2 = createMockWindow();
      tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window2);

      tree.move(node1, MotionDirection.RIGHT);

      // Should be appended to stacked container
      expect(node1.parentNode).toBe(container);
      expect(node1).toBe(container.lastChild);
    });
  });

  describe('getTiledChildren', () => {
    it('should return only tiled windows', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window1 = createMockWindow();
      const window2 = createMockWindow({ minimized: true });
      const window3 = createMockWindow();

      const node1 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window1);
      const node2 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window2);
      const node3 = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window3);

      node1.mode = WINDOW_MODES.TILE;
      node2.mode = WINDOW_MODES.TILE;
      node3.mode = WINDOW_MODES.FLOAT;

      const tiled = tree.getTiledChildren(monitor.childNodes);

      // Only node1 should be included (node2 minimized, node3 floating)
      expect(tiled).toContain(node1);
      expect(tiled).not.toContain(node2);
      expect(tiled).not.toContain(node3);
    });

    it('should include containers with tiled children', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      const window = createMockWindow();
      const node = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window);
      node.mode = WINDOW_MODES.TILE;

      const tiled = tree.getTiledChildren(monitor.childNodes);

      expect(tiled).toContain(container);
    });

    it('should exclude containers with only floating children', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const container = tree.createNode(monitor.nodeValue, NODE_TYPES.CON, new Bin());
      const window = createMockWindow();
      const node = tree.createNode(container.nodeValue, NODE_TYPES.WINDOW, window);
      node.mode = WINDOW_MODES.FLOAT;

      const tiled = tree.getTiledChildren(monitor.childNodes);

      expect(tiled).not.toContain(container);
    });

    it('should exclude grab-tiling windows', () => {
      const workspace = tree.nodeWorkpaces[0];
      const monitor = workspace.getNodeByType(NODE_TYPES.MONITOR)[0];

      const window = createMockWindow();
      const node = tree.createNode(monitor.nodeValue, NODE_TYPES.WINDOW, window);
      node.mode = WINDOW_MODES.GRAB_TILE;

      const tiled = tree.getTiledChildren(monitor.childNodes);

      expect(tiled).not.toContain(node);
    });

    it('should return empty array for null items', () => {
      const tiled = tree.getTiledChildren(null);

      expect(tiled).toEqual([]);
    });

    it('should return empty array for empty items', () => {
      const tiled = tree.getTiledChildren([]);

      expect(tiled).toEqual([]);
    });
  });
});
