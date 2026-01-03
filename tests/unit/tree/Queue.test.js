import { describe, it, expect, beforeEach } from 'vitest';
import { Queue } from '../../../lib/extension/tree.js';

describe('Queue', () => {
  let queue;

  beforeEach(() => {
    queue = new Queue();
  });

  describe('constructor', () => {
    it('should create empty queue', () => {
      expect(queue.length).toBe(0);
    });
  });

  describe('length', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.length).toBe(0);
    });

    it('should return correct length after enqueue', () => {
      queue.enqueue('item1');
      expect(queue.length).toBe(1);

      queue.enqueue('item2');
      expect(queue.length).toBe(2);
    });

    it('should return correct length after dequeue', () => {
      queue.enqueue('item1');
      queue.enqueue('item2');
      queue.dequeue();

      expect(queue.length).toBe(1);
    });

    it('should return 0 after dequeuing all items', () => {
      queue.enqueue('item1');
      queue.enqueue('item2');
      queue.dequeue();
      queue.dequeue();

      expect(queue.length).toBe(0);
    });
  });

  describe('enqueue', () => {
    it('should add item to queue', () => {
      queue.enqueue('first');
      expect(queue.length).toBe(1);
    });

    it('should add multiple items in order', () => {
      queue.enqueue('first');
      queue.enqueue('second');
      queue.enqueue('third');

      expect(queue.length).toBe(3);
    });

    it('should handle different data types', () => {
      queue.enqueue('string');
      queue.enqueue(42);
      queue.enqueue({ key: 'value' });
      queue.enqueue(['array']);
      queue.enqueue(null);

      expect(queue.length).toBe(5);
    });

    it('should handle objects', () => {
      const obj = { id: 1, name: 'test' };
      queue.enqueue(obj);

      expect(queue.length).toBe(1);
    });
  });

  describe('dequeue', () => {
    it('should return undefined for empty queue', () => {
      const result = queue.dequeue();
      expect(result).toBeUndefined();
    });

    it('should return and remove first item', () => {
      queue.enqueue('first');
      queue.enqueue('second');

      const result = queue.dequeue();

      expect(result).toBe('first');
      expect(queue.length).toBe(1);
    });

    it('should maintain FIFO order', () => {
      queue.enqueue('first');
      queue.enqueue('second');
      queue.enqueue('third');

      expect(queue.dequeue()).toBe('first');
      expect(queue.dequeue()).toBe('second');
      expect(queue.dequeue()).toBe('third');
    });

    it('should handle dequeue until empty', () => {
      queue.enqueue('item');

      expect(queue.dequeue()).toBe('item');
      expect(queue.dequeue()).toBeUndefined();
      expect(queue.length).toBe(0);
    });

    it('should return correct item type', () => {
      const obj = { id: 1 };
      queue.enqueue(obj);

      const result = queue.dequeue();
      expect(result).toEqual(obj);
      expect(result).toBe(obj); // Same reference
    });
  });

  describe('FIFO behavior', () => {
    it('should maintain order for strings', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      items.forEach(item => queue.enqueue(item));

      const results = [];
      while (queue.length > 0) {
        results.push(queue.dequeue());
      }

      expect(results).toEqual(items);
    });

    it('should maintain order for numbers', () => {
      const items = [1, 2, 3, 4, 5];
      items.forEach(item => queue.enqueue(item));

      expect(queue.dequeue()).toBe(1);
      expect(queue.dequeue()).toBe(2);
      expect(queue.dequeue()).toBe(3);
      expect(queue.dequeue()).toBe(4);
      expect(queue.dequeue()).toBe(5);
    });

    it('should maintain order for mixed types', () => {
      queue.enqueue('string');
      queue.enqueue(123);
      queue.enqueue({ key: 'value' });

      expect(queue.dequeue()).toBe('string');
      expect(queue.dequeue()).toBe(123);
      expect(queue.dequeue()).toEqual({ key: 'value' });
    });
  });

  describe('enqueue and dequeue interleaved', () => {
    it('should handle alternating operations', () => {
      queue.enqueue('a');
      queue.enqueue('b');

      expect(queue.dequeue()).toBe('a');

      queue.enqueue('c');

      expect(queue.dequeue()).toBe('b');
      expect(queue.dequeue()).toBe('c');
    });

    it('should handle multiple enqueues then dequeues', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.enqueue('c');

      expect(queue.length).toBe(3);

      expect(queue.dequeue()).toBe('a');
      expect(queue.dequeue()).toBe('b');

      expect(queue.length).toBe(1);

      queue.enqueue('d');
      queue.enqueue('e');

      expect(queue.length).toBe(3);
      expect(queue.dequeue()).toBe('c');
      expect(queue.dequeue()).toBe('d');
      expect(queue.dequeue()).toBe('e');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', () => {
      queue.enqueue(null);
      expect(queue.dequeue()).toBeNull();
    });

    it('should handle undefined values', () => {
      queue.enqueue(undefined);
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should handle falsy values', () => {
      queue.enqueue(0);
      queue.enqueue(false);
      queue.enqueue('');

      expect(queue.dequeue()).toBe(0);
      expect(queue.dequeue()).toBe(false);
      expect(queue.dequeue()).toBe('');
    });

    it('should handle large number of items', () => {
      const count = 1000;
      for (let i = 0; i < count; i++) {
        queue.enqueue(i);
      }

      expect(queue.length).toBe(count);

      for (let i = 0; i < count; i++) {
        expect(queue.dequeue()).toBe(i);
      }

      expect(queue.length).toBe(0);
    });

    it('should handle duplicate items', () => {
      queue.enqueue('duplicate');
      queue.enqueue('duplicate');
      queue.enqueue('duplicate');

      expect(queue.dequeue()).toBe('duplicate');
      expect(queue.dequeue()).toBe('duplicate');
      expect(queue.dequeue()).toBe('duplicate');
    });
  });

  describe('state preservation', () => {
    it('should preserve queue state across operations', () => {
      queue.enqueue('a');
      const lengthAfterFirst = queue.length;

      queue.enqueue('b');
      const lengthAfterSecond = queue.length;

      expect(lengthAfterFirst).toBe(1);
      expect(lengthAfterSecond).toBe(2);
    });

    it('should not affect remaining items after dequeue', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.enqueue('c');

      queue.dequeue();

      // Remaining items should still be in correct order
      expect(queue.dequeue()).toBe('b');
      expect(queue.dequeue()).toBe('c');
    });
  });
});
