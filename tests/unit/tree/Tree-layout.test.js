import { describe, it, expect, beforeEach, vi } from 'vitest';
import St from 'gi://St';
import { Tree, Node, NODE_TYPES, LAYOUT_TYPES, ORIENTATION_TYPES } from '../../../lib/extension/tree.js';
import { WINDOW_MODES } from '../../../lib/extension/window.js';

/**
 * Tree layout algorithm tests
 *
 * Tests the core tiling algorithms: processSplit, processStacked, processTabbed, computeSizes
 * These are the heart of the i3-like window management system.
 */
describe('Tree Layout Algorithms', () => {
  let tree;
  let mockWindowManager;

  beforeEach(() => {
    // Mock global objects
    global.display = {
      get_workspace_manager: vi.fn(() => ({
        get_n_workspaces: vi.fn(() => 1),
        get_workspace_by_index: vi.fn((i) => ({ index: () => i })),
        get_active_workspace: vi.fn(() => ({
          get_work_area_for_monitor: vi.fn(() => ({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080
          }))
        }))
      })),
      get_n_monitors: vi.fn(() => 1)
    };

    global.window_group = {
      contains: vi.fn(() => false),
      add_child: vi.fn(),
      remove_child: vi.fn()
    };

    // Mock WindowManager
    mockWindowManager = {
      ext: {
        settings: {
          get_boolean: vi.fn(() => false),  // showtab-decoration-enabled
          get_uint: vi.fn(() => 0)
        }
      },
      determineSplitLayout: vi.fn(() => LAYOUT_TYPES.HSPLIT),
      bindWorkspaceSignals: vi.fn(),
      calculateGaps: vi.fn(() => 10)  // 10px gap
    };

    tree = new Tree(mockWindowManager);
  });

  describe('computeSizes', () => {
    it('should divide space equally for horizontal split', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 500 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());

      const sizes = tree.computeSizes(container, [child1, child2]);

      expect(sizes).toHaveLength(2);
      expect(sizes[0]).toBe(500);  // 1000 / 2
      expect(sizes[1]).toBe(500);
    });

    it('should divide space equally for vertical split', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.VSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 600 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());

      const sizes = tree.computeSizes(container, [child1, child2]);

      expect(sizes).toHaveLength(2);
      expect(sizes[0]).toBe(300);  // 600 / 2
      expect(sizes[1]).toBe(300);
    });

    it('should respect custom percent values', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 500 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      child1.percent = 0.7;  // 70%

      const child2 = new Node(NODE_TYPES.CON, new St.Bin());
      child2.percent = 0.3;  // 30%

      const sizes = tree.computeSizes(container, [child1, child2]);

      expect(sizes[0]).toBe(700);  // 1000 * 0.7
      expect(sizes[1]).toBe(300);  // 1000 * 0.3
    });

    it('should handle three children equally', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 900, height: 500 };

      const children = [
        new Node(NODE_TYPES.CON, new St.Bin()),
        new Node(NODE_TYPES.CON, new St.Bin()),
        new Node(NODE_TYPES.CON, new St.Bin())
      ];

      const sizes = tree.computeSizes(container, children);

      expect(sizes).toHaveLength(3);
      expect(sizes[0]).toBe(300);  // 900 / 3
      expect(sizes[1]).toBe(300);
      expect(sizes[2]).toBe(300);
    });

    it('should floor the sizes to integers', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 500 };

      const children = [
        new Node(NODE_TYPES.CON, new St.Bin()),
        new Node(NODE_TYPES.CON, new St.Bin()),
        new Node(NODE_TYPES.CON, new St.Bin())
      ];

      const sizes = tree.computeSizes(container, children);

      // 1000 / 3 = 333.333... should floor to 333
      sizes.forEach(size => {
        expect(Number.isInteger(size)).toBe(true);
      });
    });

    it('should handle single child', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 500 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());

      const sizes = tree.computeSizes(container, [child1]);

      expect(sizes).toHaveLength(1);
      expect(sizes[0]).toBe(1000);  // Full width
    });
  });

  describe('processSplit - Horizontal', () => {
    it('should split two windows horizontally', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 500 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());

      const params = { sizes: [500, 500] };

      tree.processSplit(container, child1, params, 0);
      tree.processSplit(container, child2, params, 1);

      // First child should be on the left
      expect(child1.rect.x).toBe(0);
      expect(child1.rect.y).toBe(0);
      expect(child1.rect.width).toBe(500);
      expect(child1.rect.height).toBe(500);

      // Second child should be on the right
      expect(child2.rect.x).toBe(500);
      expect(child2.rect.y).toBe(0);
      expect(child2.rect.width).toBe(500);
      expect(child2.rect.height).toBe(500);
    });

    it('should split three windows with custom sizes', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 100, y: 50, width: 1200, height: 600 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());
      const child3 = new Node(NODE_TYPES.CON, new St.Bin());

      const params = { sizes: [300, 500, 400] };

      tree.processSplit(container, child1, params, 0);
      tree.processSplit(container, child2, params, 1);
      tree.processSplit(container, child3, params, 2);

      // Check x positions
      expect(child1.rect.x).toBe(100);
      expect(child2.rect.x).toBe(400);  // 100 + 300
      expect(child3.rect.x).toBe(900);  // 100 + 300 + 500

      // All should have same height
      expect(child1.rect.height).toBe(600);
      expect(child2.rect.height).toBe(600);
      expect(child3.rect.height).toBe(600);

      // Check widths
      expect(child1.rect.width).toBe(300);
      expect(child2.rect.width).toBe(500);
      expect(child3.rect.width).toBe(400);
    });

    it('should handle offset container position', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 200, y: 100, width: 800, height: 400 };

      const child = new Node(NODE_TYPES.CON, new St.Bin());
      const params = { sizes: [800] };

      tree.processSplit(container, child, params, 0);

      // Should respect container offset
      expect(child.rect.x).toBe(200);
      expect(child.rect.y).toBe(100);
    });
  });

  describe('processSplit - Vertical', () => {
    it('should split two windows vertically', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.VSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 800 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());

      const params = { sizes: [400, 400] };

      tree.processSplit(container, child1, params, 0);
      tree.processSplit(container, child2, params, 1);

      // First child should be on top
      expect(child1.rect.x).toBe(0);
      expect(child1.rect.y).toBe(0);
      expect(child1.rect.width).toBe(1000);
      expect(child1.rect.height).toBe(400);

      // Second child should be below
      expect(child2.rect.x).toBe(0);
      expect(child2.rect.y).toBe(400);
      expect(child2.rect.width).toBe(1000);
      expect(child2.rect.height).toBe(400);
    });

    it('should split three windows vertically', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.VSPLIT;
      container.rect = { x: 0, y: 0, width: 1000, height: 900 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());
      const child3 = new Node(NODE_TYPES.CON, new St.Bin());

      const params = { sizes: [300, 300, 300] };

      tree.processSplit(container, child1, params, 0);
      tree.processSplit(container, child2, params, 1);
      tree.processSplit(container, child3, params, 2);

      // Check y positions
      expect(child1.rect.y).toBe(0);
      expect(child2.rect.y).toBe(300);
      expect(child3.rect.y).toBe(600);

      // All should have same width
      expect(child1.rect.width).toBe(1000);
      expect(child2.rect.width).toBe(1000);
      expect(child3.rect.width).toBe(1000);
    });
  });

  describe('processStacked', () => {
    it('should stack single window with full container size', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.STACKED;
      container.rect = { x: 0, y: 0, width: 1000, height: 800 };
      container.childNodes = [new Node(NODE_TYPES.CON, new St.Bin())];

      const child = new Node(NODE_TYPES.CON, new St.Bin());
      const params = {};

      tree.processStacked(container, child, params, 0);

      // Single window should use full container
      expect(child.rect.x).toBe(0);
      expect(child.rect.y).toBe(0);
      expect(child.rect.width).toBe(1000);
      expect(child.rect.height).toBe(800);
    });

    it('should stack multiple windows with tabs', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.STACKED;
      container.rect = { x: 0, y: 0, width: 1000, height: 800 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());
      const child3 = new Node(NODE_TYPES.CON, new St.Bin());

      container.childNodes = [child1, child2, child3];

      const params = {};
      const stackHeight = tree.defaultStackHeight;

      tree.processStacked(container, child1, params, 0);
      tree.processStacked(container, child2, params, 1);
      tree.processStacked(container, child3, params, 2);

      // First window - no offset
      expect(child1.rect.y).toBe(0);
      expect(child1.rect.height).toBe(800);

      // Second window - offset by one stack height
      expect(child2.rect.y).toBe(stackHeight);
      expect(child2.rect.height).toBe(800 - stackHeight);

      // Third window - offset by two stack heights
      expect(child3.rect.y).toBe(stackHeight * 2);
      expect(child3.rect.height).toBe(800 - stackHeight * 2);

      // All should have same width and x position
      [child1, child2, child3].forEach(child => {
        expect(child.rect.x).toBe(0);
        expect(child.rect.width).toBe(1000);
      });
    });

    it('should respect container offset', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.STACKED;
      container.rect = { x: 100, y: 50, width: 800, height: 600 };
      container.childNodes = [
        new Node(NODE_TYPES.CON, new St.Bin()),
        new Node(NODE_TYPES.CON, new St.Bin())
      ];

      const child = new Node(NODE_TYPES.CON, new St.Bin());
      const params = {};

      tree.processStacked(container, child, params, 0);

      expect(child.rect.x).toBe(100);
      expect(child.rect.y).toBe(50);
    });
  });

  describe('processTabbed', () => {
    it('should show single tab with full container', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.TABBED;
      container.rect = { x: 0, y: 0, width: 1000, height: 800 };
      container.childNodes = [new Node(NODE_TYPES.CON, new St.Bin())];

      const child = new Node(NODE_TYPES.CON, new St.Bin());
      const params = { stackedHeight: 0 };

      tree.processTabbed(container, child, params, 0);

      // With alwaysShowDecorationTab and stackedHeight=0, should show full size
      expect(child.rect.x).toBe(0);
      expect(child.rect.y).toBe(0);
      expect(child.rect.width).toBe(1000);
      expect(child.rect.height).toBe(800);
    });

    it('should account for tab decoration height', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.TABBED;
      container.rect = { x: 0, y: 0, width: 1000, height: 800 };
      container.childNodes = [
        new Node(NODE_TYPES.CON, new St.Bin()),
        new Node(NODE_TYPES.CON, new St.Bin())
      ];

      const child = new Node(NODE_TYPES.CON, new St.Bin());
      const stackedHeight = 35;  // Tab bar height
      const params = { stackedHeight };

      tree.processTabbed(container, child, params, 0);

      // Y should be offset by tab bar
      expect(child.rect.y).toBe(stackedHeight);
      expect(child.rect.height).toBe(800 - stackedHeight);

      // X and width should match container
      expect(child.rect.x).toBe(0);
      expect(child.rect.width).toBe(1000);
    });

    it('should show all tabs at same position (only one visible)', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.TABBED;
      container.rect = { x: 0, y: 0, width: 1000, height: 800 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());
      const child3 = new Node(NODE_TYPES.CON, new St.Bin());

      container.childNodes = [child1, child2, child3];

      const stackedHeight = 35;
      const params = { stackedHeight };

      tree.processTabbed(container, child1, params, 0);
      tree.processTabbed(container, child2, params, 1);
      tree.processTabbed(container, child3, params, 2);

      // All tabs should have same rect (overlapping, only one shown)
      [child1, child2, child3].forEach(child => {
        expect(child.rect.x).toBe(0);
        expect(child.rect.y).toBe(stackedHeight);
        expect(child.rect.width).toBe(1000);
        expect(child.rect.height).toBe(800 - stackedHeight);
      });
    });

    it('should respect container offset', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.TABBED;
      container.rect = { x: 200, y: 100, width: 800, height: 600 };
      container.childNodes = [new Node(NODE_TYPES.CON, new St.Bin())];

      const child = new Node(NODE_TYPES.CON, new St.Bin());
      const params = { stackedHeight: 0 };

      tree.processTabbed(container, child, params, 0);

      expect(child.rect.x).toBe(200);
      expect(child.rect.y).toBe(100);
    });
  });

  describe('processGap', () => {
    it('should add gaps to all sides', () => {
      const node = new Node(NODE_TYPES.CON, new St.Bin());
      node.rect = { x: 0, y: 0, width: 1000, height: 800 };

      const gap = 10;
      mockWindowManager.calculateGaps.mockReturnValue(gap);

      const result = tree.processGap(node);

      // Position should be offset by gap
      expect(result.x).toBe(gap);
      expect(result.y).toBe(gap);

      // Size should be reduced by gap * 2
      expect(result.width).toBe(1000 - gap * 2);
      expect(result.height).toBe(800 - gap * 2);
    });

    it('should handle larger gaps', () => {
      const node = new Node(NODE_TYPES.CON, new St.Bin());
      node.rect = { x: 100, y: 50, width: 1000, height: 800 };

      const gap = 20;
      mockWindowManager.calculateGaps.mockReturnValue(gap);

      const result = tree.processGap(node);

      expect(result.x).toBe(120);  // 100 + 20
      expect(result.y).toBe(70);   // 50 + 20
      expect(result.width).toBe(960);   // 1000 - 40
      expect(result.height).toBe(760);  // 800 - 40
    });

    it('should not add gap if rect too small', () => {
      const node = new Node(NODE_TYPES.CON, new St.Bin());
      node.rect = { x: 0, y: 0, width: 15, height: 15 };

      const gap = 10;
      mockWindowManager.calculateGaps.mockReturnValue(gap);

      const result = tree.processGap(node);

      // Gap * 2 (20) > width (15), so no gap applied
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(15);
      expect(result.height).toBe(15);
    });

    it('should handle zero gap', () => {
      const node = new Node(NODE_TYPES.CON, new St.Bin());
      node.rect = { x: 10, y: 20, width: 1000, height: 800 };

      mockWindowManager.calculateGaps.mockReturnValue(0);

      const result = tree.processGap(node);

      // No gap, should return original rect
      expect(result).toEqual({ x: 10, y: 20, width: 1000, height: 800 });
    });
  });

  describe('Layout Integration', () => {
    it('should compute sizes and apply split layout', () => {
      const container = new Node(NODE_TYPES.CON, new St.Bin());
      container.layout = LAYOUT_TYPES.HSPLIT;
      container.rect = { x: 0, y: 0, width: 1200, height: 600 };

      const child1 = new Node(NODE_TYPES.CON, new St.Bin());
      child1.percent = 0.6;
      const child2 = new Node(NODE_TYPES.CON, new St.Bin());
      child2.percent = 0.4;

      const children = [child1, child2];
      const sizes = tree.computeSizes(container, children);
      const params = { sizes };

      tree.processSplit(container, child1, params, 0);
      tree.processSplit(container, child2, params, 1);

      // Should respect percentages
      expect(child1.rect.width).toBe(720);   // 1200 * 0.6
      expect(child2.rect.width).toBe(480);   // 1200 * 0.4
      expect(child1.rect.x).toBe(0);
      expect(child2.rect.x).toBe(720);
    });
  });
});
