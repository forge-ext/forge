# Test Coverage Gap Analysis

## Summary

**Total Code**: ~7,000 lines across 10 files
**Tested**: ~1,500 lines (~21% direct coverage)
**Untested Critical Code**: ~5,500 lines (~79%)

---

## ✅ **Fully Tested** (5 files)

| File | Lines | Coverage | Test File |
|------|-------|----------|-----------|
| `lib/extension/utils.js` | 408 | ~95% | `tests/unit/utils/utils.test.js` |
| `lib/shared/logger.js` | 81 | ~100% | `tests/unit/shared/logger.test.js` |
| `lib/css/index.js` | 889 | ~70% | `tests/unit/css/parser.test.js` |
| `lib/extension/tree.js` (Queue only) | 22 | 100% | `tests/unit/tree/Queue.test.js` |
| Integration scenarios | - | N/A | `tests/integration/window-operations.test.js` |

**Total Tested**: ~1,400 lines

---

## ❌ **Major Gaps** (Critical Code Untested)

### 1. **`lib/extension/tree.js`** - Node & Tree Classes ⚠️ **HIGH PRIORITY**
**Lines**: 1,669 | **Tested**: 22 (Queue only) | **Gap**: 1,647 lines (~98% untested)

#### Missing Coverage:

**Node Class** (~400 lines):
- ❌ DOM-like API:
  - `appendChild(node)` - Add child to parent
  - `insertBefore(newNode, childNode)` - Insert at position
  - `removeChild(node)` - Remove child
- ❌ Navigation properties:
  - `firstChild`, `lastChild`, `nextSibling`, `previousSibling`
  - `parentNode`, `childNodes`
- ❌ Search methods:
  - `getNodeByValue(value)` - Find by value
  - `getNodeByType(type)` - Find by type
  - `getNodeByLayout(layout)` - Find by layout
  - `getNodeByMode(mode)` - Find by mode
- ❌ Type checking:
  - `isWindow()`, `isCon()`, `isMonitor()`, `isWorkspace()`
  - `isFloat()`, `isTile()`
  - `isHSplit()`, `isVSplit()`, `isStacked()`, `isTabbed()`
- ❌ Node properties:
  - `rect` getter/setter
  - `nodeValue`, `nodeType`
  - `level`, `index`

**Tree Class** (~900 lines):
- ❌ **Layout calculation algorithms** (CRITICAL):
  - `processNode(node)` - Main layout processor
  - `processSplit(node)` - Horizontal/vertical splitting
  - `processStacked(node)` - Stacked layout
  - `processTabbed(node)` - Tabbed layout
  - `computeSizes(node, children)` - Size calculations
  - `processGap(rect, gap)` - Gap processing
- ❌ Tree operations:
  - `createNode(parent, type, value)` - Node creation
  - `findNode(value)` - Node lookup
  - `removeNode(node)` - Node removal
  - `addWorkspace(index)` - Workspace management
  - `removeWorkspace(index)`
- ❌ Window operations:
  - `move(node, direction)` - Move window in tree
  - `swap(node1, node2)` - Swap windows
  - `swapPairs(nodeA, nodeB)` - Pair swapping
  - `split(node, orientation)` - Create splits
- ❌ Focus management:
  - `focus(node, direction)` - Navigate focus
  - `next(node, direction)` - Find next node
- ❌ Rendering:
  - `render()` - Main render loop
  - `apply(node)` - Apply calculated positions
  - `cleanTree()` - Remove orphaned nodes
- ❌ Utility methods:
  - `getTiledChildren(node)` - Filter tiled windows
  - `findFirstNodeWindowFrom(node)` - Find window
  - `resetSiblingPercent(parent)` - Reset sizes

**Why Critical**: Tree/Node are the **core data structure** for the entire tiling system. All window positioning logic depends on these.

---

### 2. **`lib/extension/window.js`** - WindowManager ⚠️ **HIGHEST PRIORITY**
**Lines**: 2,821 | **Tested**: 0 | **Gap**: 2,821 lines (100% untested)

#### Missing Coverage:

**WindowManager Class**:
- ❌ **Core window lifecycle**:
  - `trackWindow(metaWindow)` - Add window to tree
  - `untrackWindow(metaWindow)` - Remove window
  - `renderTree()` - Trigger layout recalculation
- ❌ **Command system** (main interface):
  - `command(action, payload)` - Execute tiling commands
  - Actions: FOCUS, MOVE, SWAP, SPLIT, RESIZE, TOGGLE_FLOAT, etc.
- ❌ **Signal handling**:
  - `_bindSignals()` - Connect to GNOME Shell events
  - `_handleWindowCreated()` - New window events
  - `_handleWindowDestroyed()` - Window cleanup
  - `_handleGrabOpBegin()` - Drag/resize start
  - `_handleGrabOpEnd()` - Drag/resize end
  - `_handleWorkspaceChanged()` - Workspace switching
- ❌ **Floating window management**:
  - `toggleFloatingMode(window)` - Toggle float/tile
  - `isFloatingExempt(window)` - Check float rules
  - `addFloatOverride(wmClass, wmTitle)` - Add exception
  - `removeFloatOverride(wmClass, wmTitle)` - Remove exception
- ❌ **Window modes**:
  - Mode detection (FLOAT, TILE, GRAB_TILE)
  - Mode transitions
- ❌ **Drag-drop tiling**:
  - Modifier key detection
  - Drag position calculation
  - Auto-tiling on drop

**Why Critical**: WindowManager is the **main orchestrator** - it's what users interact with. All tiling functionality flows through this class.

---

### 3. **`lib/shared/theme.js`** - ThemeManagerBase
**Lines**: 280 | **Tested**: 0 | **Gap**: 280 lines (100% untested)

#### Missing Coverage:

- ❌ CSS manipulation:
  - `getCssRule(selector)` - Find CSS rule
  - `getCssProperty(selector, property)` - Get property value
  - `setCssProperty(selector, property, value)` - Set property
  - `patchCss(patches)` - Apply CSS patches
- ❌ Color conversion:
  - `RGBAToHexA(rgba)` - Color format conversion
  - `hexAToRGBA(hex)` - Hex to RGBA
- ❌ Theme management:
  - `getDefaultPalette()` - Get default colors
  - `reloadStylesheet()` - Reload CSS

**Why Important**: Handles all visual customization - colors, borders, focus hints.

---

### 4. **`lib/shared/settings.js`** - ConfigManager
**Lines**: 167 | **Tested**: 0 | **Gap**: 167 lines (100% untested)

#### Missing Coverage:

- ❌ File management:
  - `loadFile(path, file, defaultFile)` - Load config files
  - `loadFileContents(file)` - Read file contents
  - `loadDefaultWindowConfigContents()` - Load defaults
- ❌ Window configuration:
  - `windowProps` getter - Load window overrides
  - `windowProps` setter - Save window overrides
- ❌ Stylesheet management:
  - `stylesheetFile` getter - Load custom CSS
  - `defaultStylesheetFile` getter - Load default CSS
- ❌ File paths:
  - `confDir` - Get config directory
  - Directory creation and permissions

**Why Important**: Manages user configuration and window override rules (which apps should float, etc.).

---

### 5. **`lib/extension/keybindings.js`** - Keybindings
**Lines**: 494 | **Tested**: 0 | **Gap**: 494 lines (100% untested)

#### Missing Coverage:

- ❌ Keybinding registration:
  - `enable()` - Register all 40+ keyboard shortcuts
  - `disable()` - Unregister shortcuts
  - `buildBindingDefinitions()` - Create binding map
- ❌ Modifier key handling:
  - `allowDragDropTile()` - Check modifier keys for drag-drop
- ❌ Command mapping:
  - Focus navigation (h/j/k/l vim-style)
  - Window swapping, moving
  - Layout toggling (split, stacked, tabbed)
  - Float/tile toggling
  - Gap size adjustment
  - Window resizing
  - Snap layouts (1/3, 2/3)

**Why Important**: This is **how users interact** with the extension - all keyboard shortcuts.

---

### 6. **`lib/extension/indicator.js`** - Quick Settings Integration
**Lines**: 130 | **Tested**: 0 | **Gap**: 130 lines (100% untested)

#### Missing Coverage:

- ❌ Quick settings UI:
  - `FeatureMenuToggle` - Main toggle in quick settings
  - `FeatureIndicator` - System tray indicator
  - `SettingsPopupSwitch` - Individual setting switches
- ❌ Enable/disable functionality
- ❌ Settings synchronization

**Why Lower Priority**: UI component - harder to test without full GNOME Shell, less critical than core logic.

---

### 7. **`lib/extension/extension-theme-manager.js`** - Extension Theme Manager
**Lines**: (Unknown - need to check) | **Tested**: 0

**Why Lower Priority**: Extends ThemeManagerBase, similar to indicator - UI-focused.

---

## 📊 **Priority Ranking for Next Tests**

### 🔴 **Critical Priority** (Core Functionality)

1. **`lib/extension/window.js` - WindowManager** (2,821 lines)
   - Why: Main orchestrator, user-facing functionality
   - What to test first:
     - `trackWindow()` / `untrackWindow()`
     - `command()` system with major actions
     - `isFloatingExempt()` - window override rules
     - `toggleFloatingMode()`

2. **`lib/extension/tree.js` - Tree & Node** (1,647 lines)
   - Why: Core data structure, all layout calculations
   - What to test first:
     - **Node**: `appendChild()`, `insertBefore()`, `removeChild()`, navigation
     - **Tree**: `processSplit()`, `move()`, `swap()`, `split()`
     - Layout calculations (the i3-like algorithms)

### 🟡 **High Priority** (User Configuration)

3. **`lib/shared/settings.js` - ConfigManager** (167 lines)
   - Why: User settings and window overrides
   - What to test: `windowProps` getter/setter, file loading

4. **`lib/shared/theme.js` - ThemeManagerBase** (280 lines)
   - Why: Visual customization
   - What to test: CSS property get/set, color conversions

### 🟢 **Medium Priority** (User Interaction)

5. **`lib/extension/keybindings.js` - Keybindings** (494 lines)
   - Why: User input handling
   - What to test: Binding definitions, modifier key detection

### ⚪ **Lower Priority** (UI/Integration)

6. **`lib/extension/indicator.js`** (130 lines)
   - Why: Quick settings UI - harder to test, less critical

7. **`lib/extension/extension-theme-manager.js`**
   - Why: Extends ThemeManagerBase

---

## 🎯 **Recommended Next Steps**

### Phase 1: Core Algorithm Testing
```bash
# Create these test files:
tests/unit/tree/Node.test.js           # Node DOM-like API
tests/unit/tree/Tree-operations.test.js  # move, swap, split
tests/unit/tree/Tree-layout.test.js      # processSplit, processStacked
```

### Phase 2: Window Management Testing
```bash
tests/unit/window/WindowManager.test.js  # Core window tracking
tests/unit/window/commands.test.js       # Command system
tests/unit/window/floating.test.js       # Float mode logic
```

### Phase 3: Configuration & Theme Testing
```bash
tests/unit/shared/settings.test.js      # ConfigManager
tests/unit/shared/theme.test.js         # ThemeManagerBase
```

### Phase 4: Input & UI Testing
```bash
tests/unit/extension/keybindings.test.js  # Keyboard shortcuts
tests/unit/extension/indicator.test.js    # Quick settings (optional)
```

---

## 🚧 **Testing Challenges**

### Why Some Code Is Harder to Test:

1. **GObject.Object inheritance**: Node, Tree, Queue, WindowManager all extend GObject
   - ✅ **Solution**: We added `registerClass()` to GObject mock - already working for Queue!

2. **GNOME Shell globals**: `global.display`, `global.window_group`, etc.
   - ⚠️ **Need**: Mock for `global` object with display, workspace_manager

3. **St.Bin UI components**: Tree uses St.Bin for decorations
   - ✅ **Already mocked**: `tests/mocks/gnome/St.js` has Bin, Widget

4. **Signal connections**: Lots of `window.connect('size-changed', ...)`
   - ✅ **Already mocked**: Meta.Window has signal support

5. **Meta.Window dependencies**: Tree and WindowManager work with real windows
   - ✅ **Already mocked**: `createMockWindow()` helper works great

### What We Need to Mock Next:

```javascript
// global object (for WindowManager/Tree)
global.display
global.workspace_manager
global.window_group
global.get_current_time()

// Workspace manager (for Tree)
WorkspaceManager.get_n_workspaces()
WorkspaceManager.get_workspace_by_index(i)
```

---

## 💡 **Quick Wins** (Easy to Add)

These would add significant coverage with minimal effort:

1. **Color conversion functions** (`theme.js`)
   - Pure functions, no dependencies
   - ~30 lines of code, ~10 test cases

2. **Node navigation** (`tree.js`)
   - DOM-like API, well-defined behavior
   - ~100 lines of code, ~50 test cases

3. **WindowManager.isFloatingExempt()** (`window.js`)
   - Logic function, no UI
   - ~50 lines of code, ~20 test cases

---

## 📈 **Coverage Goal**

**Target**: 60-70% code coverage of core logic

**Focus Areas** (in order):
1. ✅ Utils (95%) - **DONE**
2. ✅ Logger (100%) - **DONE**
3. ✅ CSS Parser (70%) - **DONE**
4. ❌ Tree/Node (0% → 70%) - **HIGH PRIORITY**
5. ❌ WindowManager (0% → 60%) - **HIGHEST PRIORITY**
6. ❌ Settings (0% → 80%) - **HIGH PRIORITY**
7. ❌ Theme (0% → 70%) - **MEDIUM PRIORITY**
8. ❌ Keybindings (0% → 50%) - **MEDIUM PRIORITY**

With these additions, you'd have **~4,000 lines tested** out of ~7,000 total (**~57% coverage**).
