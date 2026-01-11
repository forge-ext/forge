# Test Coverage Gap Analysis

## Summary

**Total Test Files**: 18 unit test files + 1 integration test
**Total Tests**: 641 (640 passing, 1 skipped)
**Test Code**: ~9,124 lines of test code
**Source Code**: ~7,000 lines across 10 core files

---

## Current Test Status

All tests passing as of latest run:

```
✓ tests/unit/css/parser.test.js (42 tests)
✓ tests/unit/shared/logger.test.js (27 tests)
✓ tests/unit/tree/Node.test.js (62 tests)
✓ tests/unit/tree/Queue.test.js (29 tests)
✓ tests/unit/tree/Tree-layout.test.js (50 tests)
✓ tests/unit/tree/Tree-operations.test.js (75 tests)
✓ tests/unit/tree/Tree.test.js (32 tests)
✓ tests/unit/utils/utils.test.js (50 tests)
✓ tests/unit/window/WindowManager-batch.test.js (22 tests)
✓ tests/unit/window/WindowManager-commands.test.js (44 tests)
✓ tests/unit/window/WindowManager-floating.test.js (63 tests)
✓ tests/unit/window/WindowManager-focus.test.js (37 tests)
✓ tests/unit/window/WindowManager-overrides.test.js (33 tests)
✓ tests/unit/window/WindowManager-pointer.test.js (18 tests)
✓ tests/unit/window/WindowManager-resize.test.js (11 tests)
✓ tests/unit/window/WindowManager-tracking.test.js (22 tests)
✓ tests/unit/window/WindowManager-workspaces.test.js (23 tests)
✓ tests/integration/window-operations.test.js (1 skipped)
```

---

## ✅ **Well Covered** (Good test coverage)

| File | Lines | Coverage | Test File(s) |
|------|-------|----------|--------------|
| `lib/extension/utils.js` | 408 | ~95% | `utils.test.js` |
| `lib/shared/logger.js` | 81 | ~100% | `logger.test.js` |
| `lib/css/index.js` | 889 | ~70% | `parser.test.js` |
| `lib/extension/tree.js` (Queue) | 22 | 100% | `Queue.test.js` |
| `lib/extension/tree.js` (Node) | ~400 | ~90% | `Node.test.js` |
| `lib/extension/tree.js` (Tree) | ~900 | ~70% | `Tree.test.js`, `Tree-operations.test.js`, `Tree-layout.test.js` |
| `lib/extension/window.js` (WindowManager) | 2,821 | ~60% | 9 test files (~273 tests) |

### Node Class - Extensively Tested

**Covered in `Node.test.js` (62 tests)**:
- ✅ DOM-like API: `appendChild()`, `insertBefore()`, `removeChild()`
- ✅ Navigation: `firstChild`, `lastChild`, `nextSibling`, `previousSibling`, `parentNode`, `childNodes`
- ✅ Search: `getNodeByValue()`, `getNodeByType()`, `getNodeByLayout()`, `getNodeByMode()`
- ✅ Type checking: `isWindow()`, `isCon()`, `isMonitor()`, `isWorkspace()`, `isFloat()`, `isTile()`
- ✅ Properties: `rect`, `nodeValue`, `nodeType`, `level`, `index`

### Tree Class - Extensively Tested

**Covered in `Tree.test.js`, `Tree-operations.test.js`, `Tree-layout.test.js` (157 tests)**:
- ✅ Node operations: `createNode()`, `findNode()`, `removeNode()`
- ✅ Window operations: `move()`, `swap()`, `swapPairs()`, `split()`
- ✅ Layout: `processNode()`, `processSplit()`, `computeSizes()`
- ✅ Workspace: `addWorkspace()`, `removeWorkspace()`
- ✅ Tree structure: `getTiledChildren()`, `findFirstNodeWindowFrom()`, `resetSiblingPercent()`

### WindowManager Class - Extensively Tested

**Covered across 9 test files (~273 tests)**:
- ✅ Window tracking: `trackWindow()`, `untrackWindow()` (`WindowManager-tracking.test.js`)
- ✅ Float management: `toggleFloatingMode()`, `isFloatingExempt()` (`WindowManager-floating.test.js`)
- ✅ Overrides: `addFloatOverride()`, `removeFloatOverride()` (`WindowManager-overrides.test.js`)
- ✅ Commands: `command()` system (`WindowManager-commands.test.js`)
- ✅ Focus: focus navigation (`WindowManager-focus.test.js`)
- ✅ Batch operations: batch float toggles (`WindowManager-batch.test.js`)
- ✅ Workspaces: workspace management (`WindowManager-workspaces.test.js`)
- ✅ Pointer: mouse/pointer interactions (`WindowManager-pointer.test.js`)
- ✅ Resize: window resizing (`WindowManager-resize.test.js`)

---

## ⚠️ **Partial Coverage** (Key gaps remaining)

### Tree Class - Advanced Algorithms

**File**: `lib/extension/tree.js`

Methods with complex logic needing more tests:

- **`focus()` (lines 772-858)** - 86 lines, deeply nested
  - ❌ STACKED layout focus traversal
  - ❌ Focus with minimized windows (recursive case)
  - ❌ GRAB_TILE mode handling
  - ❌ Cross-monitor focus navigation

- **`next()` (lines 992-1036)** - Core tree traversal
  - ❌ Orientation matching against parent layout
  - ❌ Walking up tree to find matching sibling

- **`processTabbed()` (lines 1512-1570)** - Decoration positioning
  - ❌ DPI scaling effects
  - ❌ Gap and border calculation accuracy

- **`cleanTree()` (lines 1289-1325)** - Multi-phase orphan removal
  - ❌ Invalid window detection
  - ❌ Container flattening scenarios

### WindowManager - Complex Operations

**File**: `lib/extension/window.js`

- **`moveWindowToPointer()` (lines 1931-2281)** - 350+ lines, drag-drop
  - ❌ 5-region detection (left, right, top, bottom, center)
  - ❌ Stacked/tabbed layout handling during drag
  - ❌ Container creation conditions

- **`_handleResizing()` (lines 2523-2665)** - Resize propagation
  - ❌ Same-parent vs cross-parent resizing
  - ❌ Percentage delta calculations

- **`showWindowBorders()` (lines 1247-1380)** - Border display
  - ❌ Gap-dependent rendering (hide when gaps=0)
  - ❌ Multi-monitor maximization detection
  - ❌ GNOME 49+ compatibility branches

---

## ❌ **Untested Modules**

### 1. **`lib/shared/theme.js`** - ThemeManagerBase
**Lines**: 280 | **Gap**: 100% untested

- ❌ CSS manipulation: `getCssRule()`, `getCssProperty()`, `setCssProperty()`, `patchCss()`
- ❌ Color conversion: `RGBAToHexA()`, `hexAToRGBA()`
- ❌ Theme management: `getDefaultPalette()`, `reloadStylesheet()`

### 2. **`lib/shared/settings.js`** - ConfigManager
**Lines**: 167 | **Gap**: 100% untested

- ❌ File management: `loadFile()`, `loadFileContents()`
- ❌ Window configuration: `windowProps` getter/setter
- ❌ Stylesheet management: `stylesheetFile`, `defaultStylesheetFile`

### 3. **`lib/extension/keybindings.js`** - Keybindings
**Lines**: 494 | **Gap**: 100% untested

- ❌ Keybinding registration: `enable()`, `disable()`, `buildBindingDefinitions()`
- ❌ Modifier key handling: `allowDragDropTile()`
- ❌ Command mapping for 40+ keyboard shortcuts

### 4. **`lib/extension/indicator.js`** - Quick Settings UI
**Lines**: 130 | **Gap**: 100% untested

- ❌ UI components (harder to test without full GNOME Shell)

### 5. **`lib/extension/extension-theme-manager.js`** - Extension Theme Manager
**Lines**: Unknown | **Gap**: 100% untested

- ❌ Extends ThemeManagerBase

---

## 📊 **Priority for Additional Tests**

### 🔴 High Priority (User Configuration)

1. **`lib/shared/settings.js` - ConfigManager** (167 lines)
   - Why: User settings and window overrides
   - What to test: `windowProps` getter/setter, file loading

2. **`lib/shared/theme.js` - ThemeManagerBase** (280 lines)
   - Why: Visual customization
   - What to test: CSS property get/set, color conversions (pure functions)

### 🟡 Medium Priority (Complex Algorithms)

3. **Tree focus/navigation** (extend existing tests)
   - `focus()` through STACKED/TABBED layouts
   - `next()` orientation matching

4. **WindowManager drag-drop** (new test file)
   - `moveWindowToPointer()` region detection
   - Container creation conditions

### 🟢 Lower Priority (User Interaction/UI)

5. **`lib/extension/keybindings.js` - Keybindings** (494 lines)
   - Why: User input handling
   - What to test: Binding definitions, modifier key detection

6. **`lib/extension/indicator.js`** (130 lines)
   - Why: Quick settings UI - harder to test, less critical

---

## 🎯 **Recommended Next Steps**

### Phase 1: Configuration & Theme Testing
```bash
tests/unit/shared/settings.test.js      # ConfigManager
tests/unit/shared/theme.test.js         # ThemeManagerBase
```

### Phase 2: Advanced Algorithm Testing
```bash
tests/unit/tree/Tree-focus.test.js      # focus()/next() edge cases
tests/unit/tree/Tree-cleanup.test.js    # cleanTree()/removeNode() edge cases
```

### Phase 3: Complex WindowManager Operations
```bash
tests/unit/window/WindowManager-drag-drop.test.js  # moveWindowToPointer()
tests/unit/window/WindowManager-borders.test.js   # showWindowBorders()
```

### Phase 4: Input Testing
```bash
tests/unit/extension/keybindings.test.js  # Keyboard shortcuts
```

---

## 💡 **Quick Wins** (Easy to Add)

1. **Color conversion functions** (`theme.js`)
   - Pure functions, no dependencies
   - ~30 lines of code, ~10 test cases

2. **ConfigManager file operations** (`settings.js`)
   - Well-defined I/O behavior
   - ~50 lines of code, ~15 test cases

---

## 📈 **Coverage Summary**

| Module | Previous | Current | Target |
|--------|----------|---------|--------|
| Utils | 95% | 95% | ✅ Done |
| Logger | 100% | 100% | ✅ Done |
| CSS Parser | 70% | 70% | ✅ Done |
| Queue | 100% | 100% | ✅ Done |
| Node | 0% | ~90% | ✅ Done |
| Tree | 0% | ~70% | ~80% |
| WindowManager | 0% | ~60% | ~70% |
| Settings | 0% | 0% | ~80% |
| Theme | 0% | 0% | ~70% |
| Keybindings | 0% | 0% | ~50% |

**Overall**: ~60% of core logic now tested (up from ~21%)

---

## 🧪 **Mock Infrastructure**

The test suite includes comprehensive mocks for GNOME APIs:

```
tests/mocks/
├── gnome/
│   ├── Clutter.js       # Clutter toolkit
│   ├── Gio.js           # GIO (I/O, settings)
│   ├── GLib.js          # GLib utilities
│   ├── GObject.js       # GObject type system
│   ├── Meta.js          # Window manager (Window, Workspace, Rectangle)
│   ├── Shell.js         # Shell integration
│   └── St.js            # Shell toolkit (Bin, Widget, Label)
├── helpers/
│   └── mockWindow.js    # Window factory helpers
└── extension/
    └── window-stubs.js  # WindowManager stubs
```

Global mocks available in tests:
- `global.display` - Display manager with workspace/monitor methods
- `global.get_pointer()` - Mouse position
- `global.get_current_time()` - Timestamp
- `imports.gi.*` - All GNOME introspection modules
