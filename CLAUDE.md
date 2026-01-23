# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forge is a GNOME Shell extension providing i3/sway-style tiling window management. It supports GNOME 40+ on both X11 and Wayland, featuring tree-based tiling with horizontal/vertical split containers, stacked/tabbed layouts, vim-like keybindings, drag-and-drop tiling, and multi-monitor support.

## Build & Development Commands

```bash
# Install dependencies (Node.js 16+ and gettext required)
npm install

# Development build: compile, set debug mode, install to ~/.local/share/gnome-shell/extensions/
make dev

# Production build: compile, install, enable extension, restart shell
make prod

# Testing in nested Wayland session (no shell restart needed)
make test

# Testing on X11 (restarts gnome-shell)
make test-x

# Unit tests (mocked GNOME APIs via Vitest)
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report

# Code formatting
npm run format              # Format code with Prettier
npm run lint                # Check formatting
```

## Architecture

### Entry Points

- `extension.js` - Main extension entry point, creates ForgeExtension class that manages lifecycle
- `prefs.js` - Preferences window entry point (GTK4/Adwaita)

### Core Components (lib/extension/)

- **tree.js** - Tree data structure for window layout (central to tiling logic)
  - `Node` class: Represents monitors, workspaces, containers, and windows in a tree hierarchy
  - `Tree` class: Manages the entire tree structure, handles layout calculations
  - `Queue` class: Event queue for window operations
  - Node types: ROOT, MONITOR, WORKSPACE, CON (container), WINDOW
  - Layout types: HSPLIT, VSPLIT, STACKED, TABBED, PRESET

- **window.js** - WindowManager class, handles window signals, grab operations, tiling logic, and focus management

- **keybindings.js** - Keyboard shortcut management

- **utils.js** - Utility functions for geometry calculations, window operations

- **enum.js** - `createEnum()` helper for creating frozen enum objects

### Shared Modules (lib/shared/)

- **settings.js** - ConfigManager for loading window overrides from `~/.config/forge/config/windows.json`
- **logger.js** - Debug logging (controlled by settings)
- **theme.js** - ThemeManagerBase for CSS parsing and stylesheet management

### Preferences UI (lib/prefs/)

GTK4/Adwaita preference pages - not covered by unit tests.

### GSettings Schemas

Located in `schemas/org.gnome.shell.extensions.forge.gschema.xml`. Compiled during build.

## Testing Infrastructure

Tests use Vitest with mocked GNOME APIs (tests/mocks/gnome/). The mocks simulate Meta, Gio, GLib, Shell, St, Clutter, and GObject APIs so tests can run in Node.js without GNOME Shell.

**Always run tests in Docker** to ensure consistent environment:

```bash
# Run all tests in Docker (preferred)
make unit-test-docker

# Run with coverage report
make unit-test-docker-coverage

# Watch mode for development
make unit-test-docker-watch

# Run locally (if Node.js environment matches)
npm test
npm run test:coverage
```

**Coverage**: 60.5% overall, 728 tests. Run `npm run test:coverage` for detailed breakdown.

Test structure:
- `tests/setup.js` - Global test setup, loads mocks
- `tests/mocks/gnome/` - GNOME API mocks (Meta.js, GLib.js, etc.)
- `tests/mocks/helpers/` - Test helpers like `createMockWindow()`
- `tests/unit/` - Unit tests organized by module

## Key Concepts

- **Tiling tree**: Windows are organized in a tree structure similar to i3/sway. Containers can split horizontally or vertically, or display children in stacked/tabbed mode.

- **Window modes**: TILE (managed by tree), FLOAT (unmanaged), GRAB_TILE (being dragged), DEFAULT

- **Session modes**: Extension disables keybindings on lock screen but keeps tree in memory to preserve layout

## Configuration Files

- Window overrides: `~/.config/forge/config/windows.json`
- Stylesheet overrides: `~/.config/forge/stylesheet/forge/stylesheet.css`
