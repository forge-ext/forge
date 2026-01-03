import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Node, NODE_TYPES, LAYOUT_TYPES } from '../../../lib/extension/tree.js';
import { WINDOW_MODES } from '../../../lib/extension/window.js';

describe('Node', () => {
  describe('Constructor and Basic Properties', () => {
    it('should create node with type and data', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root-data');

      expect(node.nodeType).toBe(NODE_TYPES.ROOT);
      expect(node.nodeValue).toBe('root-data');
    });

    it('should initialize with empty child nodes', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');

      expect(node.childNodes).toEqual([]);
      expect(node.firstChild).toBeNull();
      expect(node.lastChild).toBeNull();
    });

    it('should have no parent initially', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');

      expect(node.parentNode).toBeNull();
    });

    it('should initialize with default mode', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');

      expect(node.mode).toBe(WINDOW_MODES.DEFAULT);
    });

    it('should initialize with zero percent', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');

      expect(node.percent).toBe(0.0);
    });
  });

  describe('Type Checking Methods', () => {
    it('should correctly identify ROOT type', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');

      expect(node.isRoot()).toBe(true);
      expect(node.isWindow()).toBe(false);
      expect(node.isCon()).toBe(false);
      expect(node.isMonitor()).toBe(false);
      expect(node.isWorkspace()).toBe(false);
    });

    it('should correctly identify MONITOR type', () => {
      const node = new Node(NODE_TYPES.MONITOR, 'monitor-0');

      expect(node.isMonitor()).toBe(true);
      expect(node.isRoot()).toBe(false);
      expect(node.isWindow()).toBe(false);
    });

    it('should correctly identify CON type', () => {
      const node = new Node(NODE_TYPES.CON, 'container');

      expect(node.isCon()).toBe(true);
      expect(node.isRoot()).toBe(false);
      expect(node.isWindow()).toBe(false);
    });

    it('should correctly identify WORKSPACE type', () => {
      const node = new Node(NODE_TYPES.WORKSPACE, 'ws-0');

      expect(node.isWorkspace()).toBe(true);
      expect(node.isRoot()).toBe(false);
      expect(node.isWindow()).toBe(false);
    });

    it('should check type by name', () => {
      const node = new Node(NODE_TYPES.CON, 'container');

      expect(node.isType(NODE_TYPES.CON)).toBe(true);
      expect(node.isType(NODE_TYPES.ROOT)).toBe(false);
    });
  });

  describe('Mode Checking Methods', () => {
    it('should check if node is floating', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');
      node.mode = WINDOW_MODES.FLOAT;

      expect(node.isFloat()).toBe(true);
      expect(node.isTile()).toBe(false);
    });

    it('should check if node is tiled', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');
      node.mode = WINDOW_MODES.TILE;

      expect(node.isTile()).toBe(true);
      expect(node.isFloat()).toBe(false);
    });

    it('should check if node is grab-tile', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');
      node.mode = WINDOW_MODES.GRAB_TILE;

      expect(node.isGrabTile()).toBe(true);
    });

    it('should check mode by name', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');
      node.mode = WINDOW_MODES.TILE;

      expect(node.isMode(WINDOW_MODES.TILE)).toBe(true);
      expect(node.isMode(WINDOW_MODES.FLOAT)).toBe(false);
    });
  });

  describe('Layout Checking Methods', () => {
    it('should check horizontal split layout', () => {
      const node = new Node(NODE_TYPES.CON, 'container');
      node.layout = LAYOUT_TYPES.HSPLIT;

      expect(node.isHSplit()).toBe(true);
      expect(node.isVSplit()).toBe(false);
      expect(node.isStacked()).toBe(false);
    });

    it('should check vertical split layout', () => {
      const node = new Node(NODE_TYPES.CON, 'container');
      node.layout = LAYOUT_TYPES.VSPLIT;

      expect(node.isVSplit()).toBe(true);
      expect(node.isHSplit()).toBe(false);
    });

    it('should check stacked layout', () => {
      const node = new Node(NODE_TYPES.CON, 'container');
      node.layout = LAYOUT_TYPES.STACKED;

      expect(node.isStacked()).toBe(true);
      expect(node.isTabbed()).toBe(false);
    });

    it('should check tabbed layout', () => {
      const node = new Node(NODE_TYPES.CON, 'container');
      node.layout = LAYOUT_TYPES.TABBED;

      expect(node.isTabbed()).toBe(true);
      expect(node.isStacked()).toBe(false);
    });

    it('should check layout by name', () => {
      const node = new Node(NODE_TYPES.CON, 'container');
      node.layout = LAYOUT_TYPES.HSPLIT;

      expect(node.isLayout(LAYOUT_TYPES.HSPLIT)).toBe(true);
      expect(node.isLayout(LAYOUT_TYPES.VSPLIT)).toBe(false);
    });
  });

  describe('appendChild', () => {
    let parent, child1, child2;

    beforeEach(() => {
      parent = new Node(NODE_TYPES.ROOT, 'parent');
      child1 = new Node(NODE_TYPES.CON, 'child1');
      child2 = new Node(NODE_TYPES.CON, 'child2');
    });

    it('should add child to empty parent', () => {
      parent.appendChild(child1);

      expect(parent.firstChild).toBe(child1);
      expect(parent.lastChild).toBe(child1);
      expect(parent.childNodes).toHaveLength(1);
      expect(child1.parentNode).toBe(parent);
    });

    it('should add multiple children in order', () => {
      parent.appendChild(child1);
      parent.appendChild(child2);

      expect(parent.firstChild).toBe(child1);
      expect(parent.lastChild).toBe(child2);
      expect(parent.childNodes).toHaveLength(2);
    });

    it('should set parent reference on child', () => {
      parent.appendChild(child1);

      expect(child1.parentNode).toBe(parent);
    });

    it('should move child if already has different parent', () => {
      const otherParent = new Node(NODE_TYPES.ROOT, 'other');

      parent.appendChild(child1);
      otherParent.appendChild(child1);

      expect(parent.childNodes).toHaveLength(0);
      expect(otherParent.childNodes).toHaveLength(1);
      expect(child1.parentNode).toBe(otherParent);
    });

    it('should return null for null node', () => {
      const result = parent.appendChild(null);

      expect(result).toBeNull();
      expect(parent.childNodes).toHaveLength(0);
    });

    it('should return the appended node', () => {
      const result = parent.appendChild(child1);

      expect(result).toBe(child1);
    });
  });

  describe('removeChild', () => {
    let parent, child1, child2, child3;

    beforeEach(() => {
      parent = new Node(NODE_TYPES.ROOT, 'parent');
      child1 = new Node(NODE_TYPES.CON, 'child1');
      child2 = new Node(NODE_TYPES.CON, 'child2');
      child3 = new Node(NODE_TYPES.CON, 'child3');

      parent.appendChild(child1);
      parent.appendChild(child2);
      parent.appendChild(child3);
    });

    it('should remove child from parent', () => {
      parent.removeChild(child2);

      expect(parent.childNodes).toHaveLength(2);
      expect(parent.childNodes).not.toContain(child2);
    });

    it('should clear parent reference', () => {
      parent.removeChild(child1);

      expect(child1.parentNode).toBeNull();
    });

    it('should update siblings when removing middle child', () => {
      parent.removeChild(child2);

      expect(child1.nextSibling).toBe(child3);
      expect(child3.previousSibling).toBe(child1);
    });

    it('should update firstChild when removing first child', () => {
      parent.removeChild(child1);

      expect(parent.firstChild).toBe(child2);
    });

    it('should update lastChild when removing last child', () => {
      parent.removeChild(child3);

      expect(parent.lastChild).toBe(child2);
    });

    it('should handle removing only child', () => {
      const singleParent = new Node(NODE_TYPES.ROOT, 'single');
      const onlyChild = new Node(NODE_TYPES.CON, 'only');
      singleParent.appendChild(onlyChild);

      singleParent.removeChild(onlyChild);

      expect(singleParent.firstChild).toBeNull();
      expect(singleParent.lastChild).toBeNull();
      expect(singleParent.childNodes).toHaveLength(0);
    });
  });

  describe('insertBefore', () => {
    let parent, child1, child2, newChild;

    beforeEach(() => {
      parent = new Node(NODE_TYPES.ROOT, 'parent');
      child1 = new Node(NODE_TYPES.CON, 'child1');
      child2 = new Node(NODE_TYPES.CON, 'child2');
      newChild = new Node(NODE_TYPES.CON, 'new');

      parent.appendChild(child1);
      parent.appendChild(child2);
    });

    it('should insert before specified child', () => {
      parent.insertBefore(newChild, child2);

      expect(parent.childNodes[0]).toBe(child1);
      expect(parent.childNodes[1]).toBe(newChild);
      expect(parent.childNodes[2]).toBe(child2);
    });

    it('should insert at beginning', () => {
      parent.insertBefore(newChild, child1);

      expect(parent.firstChild).toBe(newChild);
      expect(newChild.nextSibling).toBe(child1);
    });

    it('should set parent reference', () => {
      parent.insertBefore(newChild, child2);

      expect(newChild.parentNode).toBe(parent);
    });

    it('should append if childNode is null', () => {
      parent.insertBefore(newChild, null);

      expect(parent.lastChild).toBe(newChild);
    });

    it('should return null if newNode is null', () => {
      const result = parent.insertBefore(null, child1);

      expect(result).toBeNull();
    });

    it('should return null if newNode same as childNode', () => {
      const result = parent.insertBefore(child1, child1);

      expect(result).toBeNull();
    });

    it('should return null if childNode parent is not this', () => {
      const otherParent = new Node(NODE_TYPES.ROOT, 'other');
      const otherChild = new Node(NODE_TYPES.CON, 'other-child');
      otherParent.appendChild(otherChild);

      const result = parent.insertBefore(newChild, otherChild);

      expect(result).toBeNull();
    });

    it('should move node if already has parent', () => {
      const otherParent = new Node(NODE_TYPES.ROOT, 'other');
      otherParent.appendChild(newChild);

      parent.insertBefore(newChild, child2);

      expect(otherParent.childNodes).not.toContain(newChild);
      expect(parent.childNodes).toContain(newChild);
    });
  });

  describe('Navigation Properties', () => {
    let parent, child1, child2, child3;

    beforeEach(() => {
      parent = new Node(NODE_TYPES.ROOT, 'parent');
      child1 = new Node(NODE_TYPES.CON, 'child1');
      child2 = new Node(NODE_TYPES.CON, 'child2');
      child3 = new Node(NODE_TYPES.CON, 'child3');

      parent.appendChild(child1);
      parent.appendChild(child2);
      parent.appendChild(child3);
    });

    describe('firstChild and lastChild', () => {
      it('should return first child', () => {
        expect(parent.firstChild).toBe(child1);
      });

      it('should return last child', () => {
        expect(parent.lastChild).toBe(child3);
      });

      it('should return null for empty node', () => {
        const empty = new Node(NODE_TYPES.ROOT, 'empty');

        expect(empty.firstChild).toBeNull();
        expect(empty.lastChild).toBeNull();
      });
    });

    describe('nextSibling and previousSibling', () => {
      it('should return next sibling', () => {
        expect(child1.nextSibling).toBe(child2);
        expect(child2.nextSibling).toBe(child3);
      });

      it('should return null for last child', () => {
        expect(child3.nextSibling).toBeNull();
      });

      it('should return previous sibling', () => {
        expect(child3.previousSibling).toBe(child2);
        expect(child2.previousSibling).toBe(child1);
      });

      it('should return null for first child', () => {
        expect(child1.previousSibling).toBeNull();
      });

      it('should return null when no parent', () => {
        const orphan = new Node(NODE_TYPES.CON, 'orphan');

        expect(orphan.nextSibling).toBeNull();
        expect(orphan.previousSibling).toBeNull();
      });
    });

    describe('index', () => {
      it('should return correct index for each child', () => {
        expect(child1.index).toBe(0);
        expect(child2.index).toBe(1);
        expect(child3.index).toBe(2);
      });

      it('should return -1 when no parent', () => {
        const orphan = new Node(NODE_TYPES.CON, 'orphan');

        expect(orphan.index).toBe(-1);
      });
    });

    describe('level', () => {
      it('should return 0 for root node', () => {
        expect(parent.level).toBe(0);
      });

      it('should return correct level for nested nodes', () => {
        expect(child1.level).toBe(1);

        const grandchild = new Node(NODE_TYPES.CON, 'grandchild');
        child1.appendChild(grandchild);

        expect(grandchild.level).toBe(2);
      });
    });
  });

  describe('contains', () => {
    let root, child, grandchild;

    beforeEach(() => {
      root = new Node(NODE_TYPES.ROOT, 'root');
      child = new Node(NODE_TYPES.CON, 'child');
      grandchild = new Node(NODE_TYPES.CON, 'grandchild');

      root.appendChild(child);
      child.appendChild(grandchild);
    });

    it('should return true for direct child', () => {
      expect(root.contains(child)).toBe(true);
    });

    it('should return true for grandchild', () => {
      expect(root.contains(grandchild)).toBe(true);
    });

    it('should return false for unrelated node', () => {
      const other = new Node(NODE_TYPES.CON, 'other');

      expect(root.contains(other)).toBe(false);
    });

    it('should return false for null', () => {
      expect(root.contains(null)).toBe(false);
    });
  });

  describe('getNodeByValue', () => {
    let root, child1, child2, grandchild;

    beforeEach(() => {
      root = new Node(NODE_TYPES.ROOT, 'root');
      child1 = new Node(NODE_TYPES.CON, 'child1');
      child2 = new Node(NODE_TYPES.CON, 'child2');
      grandchild = new Node(NODE_TYPES.CON, 'grandchild');

      root.appendChild(child1);
      root.appendChild(child2);
      child1.appendChild(grandchild);
    });

    it('should find direct child by value', () => {
      const found = root.getNodeByValue('child1');

      expect(found).toBe(child1);
    });

    it('should find grandchild by value', () => {
      const found = root.getNodeByValue('grandchild');

      expect(found).toBe(grandchild);
    });

    it('should return null for non-existent value', () => {
      const found = root.getNodeByValue('nonexistent');

      expect(found).toBeNull();
    });
  });

  describe('getNodeByType', () => {
    let root, con1, con2, workspace;

    beforeEach(() => {
      root = new Node(NODE_TYPES.ROOT, 'root');
      con1 = new Node(NODE_TYPES.CON, 'con1');
      con2 = new Node(NODE_TYPES.CON, 'con2');
      workspace = new Node(NODE_TYPES.WORKSPACE, 'ws0');

      root.appendChild(con1);
      root.appendChild(con2);
      root.appendChild(workspace);
    });

    it('should find all nodes of given type', () => {
      const cons = root.getNodeByType(NODE_TYPES.CON);

      expect(cons).toHaveLength(2);
      expect(cons).toContain(con1);
      expect(cons).toContain(con2);
    });

    it('should find single node of unique type', () => {
      const workspaces = root.getNodeByType(NODE_TYPES.WORKSPACE);

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]).toBe(workspace);
    });

    it('should return empty array for non-existent type', () => {
      const monitors = root.getNodeByType(NODE_TYPES.MONITOR);

      expect(monitors).toEqual([]);
    });
  });

  describe('rect property', () => {
    it('should get and set rect', () => {
      const node = new Node(NODE_TYPES.ROOT, 'root');
      const rect = { x: 10, y: 20, width: 100, height: 200 };

      node.rect = rect;

      expect(node.rect).toEqual(rect);
    });
  });
});
