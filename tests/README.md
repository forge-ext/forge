# Forge Extension Testing Infrastructure

This directory contains the comprehensive testing infrastructure for the Forge GNOME Shell extension.

## Quick Start

```bash
# Install dependencies (only once)
npm install

# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI (browser-based)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Structure

```
tests/
├── README.md                    # This file
├── setup.js                     # Global test setup (mocks GNOME APIs)
├── mocks/
│   ├── gnome/                   # GNOME API mocks
│   │   ├── Meta.js             # Meta window manager APIs
│   │   ├── GLib.js             # GLib utilities
│   │   ├── Gio.js              # GIO file/settings APIs
│   │   ├── Shell.js            # GNOME Shell APIs
│   │   ├── St.js               # Shell Toolkit (UI)
│   │   ├── Clutter.js          # Clutter scene graph
│   │   ├── GObject.js          # GObject introspection
│   │   └── index.js            # Exports all mocks
│   └── helpers/
│       └── mockWindow.js       # Helper to create mock windows
├── unit/
│   ├── tree/                   # Tree data structure tests
│   ├── window/                 # WindowManager tests
│   ├── utils/                  # Utility function tests
│   │   └── utils.test.js      # ✅ Example test file
│   ├── shared/                 # Shared module tests
│   └── css/                    # CSS parser tests
└── integration/                # Full workflow tests
```

## How It Works

### Mocking GNOME APIs

The extension uses GNOME Shell APIs (Meta, Gio, GLib, etc.) via the `gi://` import scheme. These are not available in a Node.js test environment, so we mock them:

```javascript
// In your test file, imports are automatically mocked
import Meta from 'gi://Meta';  // This uses tests/mocks/gnome/Meta.js

// Create a mock window
const window = new Meta.Window({
  wm_class: 'Firefox',
  title: 'Mozilla Firefox'
});

// Mock window behaves like real Meta.Window
const rect = window.get_frame_rect();  // Returns Rectangle
```

### Writing Tests

Tests use [Vitest](https://vitest.dev/) with a Jest-like API:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createEnum } from '../../../lib/extension/utils.js';

describe('createEnum', () => {
  it('should create frozen enum object', () => {
    const Colors = createEnum(['RED', 'GREEN', 'BLUE']);
    expect(Colors.RED).toBe('RED');
    expect(Object.isFrozen(Colors)).toBe(true);
  });
});
```

### Test File Naming

- Test files: `*.test.js`
- Location: Either `tests/unit/` or co-located with source files
- Naming: Match the file being tested (e.g., `utils.js` → `utils.test.js`)

## Available Mocks

### Meta (Meta window manager)

```javascript
import { Window, Rectangle, GrabOp } from 'gi://Meta';

const rect = new Rectangle({ x: 0, y: 0, width: 100, height: 100 });
const window = new Window({ rect, wm_class: 'App' });

window.move_resize_frame(false, 10, 10, 200, 200);
const newRect = window.get_frame_rect();
```

### Gio (File/Settings)

```javascript
import { File, Settings } from 'gi://Gio';

const file = File.new_for_path('/path/to/file');
const settings = Settings.new('org.gnome.shell.extensions.forge');
settings.set_boolean('tiling-enabled', true);
```

### GLib (Utilities)

```javascript
import GLib from 'gi://GLib';

const home = GLib.get_home_dir();
const path = GLib.build_filenamev([home, '.config', 'forge']);
```

### Mock Helpers

```javascript
import { createMockWindow } from './mocks/helpers/mockWindow.js';

// Quick window creation
const window = createMockWindow({
  wm_class: 'Firefox',
  rect: { x: 0, y: 0, width: 800, height: 600 }
});

// Create multiple windows
const windows = createMockWindowArray(5);
```

## Example Tests

### Testing Pure Functions

```javascript
// tests/unit/utils/utils.test.js
import { describe, it, expect } from 'vitest';
import { rectContainsPoint } from '../../../lib/extension/utils.js';

describe('rectContainsPoint', () => {
  it('should return true for point inside rect', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(rectContainsPoint(rect, [50, 50])).toBe(true);
  });

  it('should return false for point outside rect', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(rectContainsPoint(rect, [150, 150])).toBe(false);
  });
});
```

### Testing with Mocks

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockWindow } from '../../mocks/helpers/mockWindow.js';
import { resolveWidth } from '../../../lib/extension/utils.js';

describe('resolveWidth', () => {
  let mockWindow;

  beforeEach(() => {
    mockWindow = createMockWindow({
      rect: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  it('should resolve absolute pixel values', () => {
    const result = resolveWidth({ width: 500 }, mockWindow);
    expect(result).toBe(500);
  });

  it('should resolve fractional values as percentage', () => {
    const result = resolveWidth({ width: 0.5 }, mockWindow);
    expect(result).toBe(960); // 1920 * 0.5
  });
});
```

## Coverage

Generate a coverage report:

```bash
npm run test:coverage
```

This creates an HTML report in `coverage/index.html`. Open it in a browser to see:
- Line coverage
- Branch coverage
- Function coverage
- Uncovered code highlights

## CI/CD Integration

Tests run automatically on GitHub Actions:
- On every push to `main`
- On every pull request
- Coverage reports are uploaded as artifacts

See `.github/workflows/testing.yml` for configuration.

## What to Test

### Priority 1: Core Logic ✅
- [x] Utility functions (`lib/extension/utils.js`)
- [ ] Tree data structure (`lib/extension/tree.js`)
  - [ ] Node class (DOM-like API)
  - [ ] Tree class (layout calculations)
  - [ ] Queue class
- [ ] WindowManager (`lib/extension/window.js`)

### Priority 2: Shared Utilities
- [ ] Logger (`lib/shared/logger.js`)
- [ ] ConfigManager (`lib/shared/settings.js`)
- [ ] ThemeManagerBase (`lib/shared/theme.js`)
- [ ] CSS Parser (`lib/css/index.js`)

### Priority 3: Integration
- [ ] Full tiling workflow
- [ ] Multi-monitor scenarios
- [ ] Layout transitions

## Expanding Mocks

When you encounter missing mock functionality:

1. Add the needed methods/properties to the appropriate mock file
2. Keep mocks minimal - only implement what tests actually use
3. Document any non-obvious mock behavior

Example - adding a missing Meta.Window method:

```javascript
// tests/mocks/gnome/Meta.js
export class Window {
  // ... existing code ...

  is_skip_taskbar() {
    // Mock implementation
    return this.skip_taskbar || false;
  }
}
```

## Tips

1. **Run tests in watch mode** during development for instant feedback
2. **Use `describe` blocks** to group related tests logically
3. **Use `beforeEach`** to set up common test state
4. **Test edge cases** (null, undefined, empty, negative values)
5. **Keep tests focused** - one assertion per test when possible
6. **Use descriptive test names** - "should do X when Y"

## Troubleshooting

### Import errors

If you see errors like "Cannot find module 'gi://Meta'":
- Check that `tests/setup.js` is properly configured in `vitest.config.js`
- Ensure all mocks are exported in `tests/mocks/gnome/index.js`

### Mock behavior doesn't match real API

- Update the mock in `tests/mocks/gnome/` to match actual behavior
- Add comments explaining any simplifications

### Tests are slow

- Check if you're doing I/O operations - mock them instead
- Ensure you're not importing UI components that do heavy initialization
- Use Vitest's `--no-threads` flag if needed

## Next Steps

1. **Install dependencies**: `npm install`
2. **Run example test**: `npm test tests/unit/utils/utils.test.js`
3. **Create your first test**: Copy `tests/unit/utils/utils.test.js` as a template
4. **Expand coverage**: Add tests for Tree, Node, WindowManager
5. **Run in watch mode**: `npm run test:watch` for live development

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [GNOME JavaScript (GJS) API](https://gjs-docs.gnome.org/)
- [Vitest UI](https://vitest.dev/guide/ui.html)
- [Coverage Configuration](https://vitest.dev/guide/coverage.html)

---

**Note**: This testing infrastructure allows you to run comprehensive tests **without building or deploying the extension**. All GNOME APIs are mocked, so tests run in a standard Node.js environment.
