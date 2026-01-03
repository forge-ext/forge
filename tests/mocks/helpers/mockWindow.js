// Helper factory for creating mock windows

import { Window, Rectangle } from '../gnome/Meta.js';

export function createMockWindow(overrides = {}) {
  return new Window({
    id: overrides.id || `win-${Date.now()}-${Math.random()}`,
    rect: new Rectangle(overrides.rect || {}),
    wm_class: overrides.wm_class || 'TestApp',
    title: overrides.title || 'Test Window',
    ...overrides
  });
}

export function createMockWindowArray(count, baseOverrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    createMockWindow({ ...baseOverrides, id: `win-${i}` })
  );
}

export function createMockWindowWithRect(x, y, width, height, overrides = {}) {
  return createMockWindow({
    ...overrides,
    rect: { x, y, width, height }
  });
}

export default {
  createMockWindow,
  createMockWindowArray,
  createMockWindowWithRect
};
