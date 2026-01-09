# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forge is a GNOME Shell extension providing tiling/window management with i3-wm/sway-wm style workflow. It supports GNOME Shell versions 45-49 on both X11 and Wayland.

## Development Commands

```bash
# Quick development cycle (build + debug mode + install)
make dev

# Full test cycle (disable, uninstall, build, install, enable, nested shell)
make test

# X11 testing with shell restart
make test-x

# Wayland testing with nested GNOME Shell
make test-wayland

# Build only
make build

# View extension logs
make log

# Format code
npm run format

# Check formatting
npm test
```

For Wayland nested testing, use `make test-open` to launch apps in the nested session.

## Architecture

### Entry Points
- `extension.js` - Main extension class with `enable()`/`disable()` lifecycle
- `prefs.js` - Preferences UI entry point (separate process from extension)

### Core Components (lib/extension/)
- `window.js` - **WindowManager**: Central tiling logic, window placement, focus management, workspace handling. This is the largest and most critical file (~3000 lines).
- `tree.js` - **Tree/Node**: Binary tree data structure for window hierarchy. Defines NODE_TYPES (ROOT, MONITOR, CON, WINDOW, WORKSPACE), LAYOUT_TYPES (STACKED, TABBED, HSPLIT, VSPLIT), and POSITION enum.
- `keybindings.js` - Keyboard shortcut handling (vim-like hjkl navigation)
- `indicator.js` - Quick settings panel integration

### Shared Utilities (lib/shared/)
- `settings.js` - ConfigManager for GSettings and file-based config
- `logger.js` - Debug logging (controlled by `production` flag)
- `theme.js` - Theme/CSS utilities

### Configuration
- GSettings schema: `org.gnome.shell.extensions.forge`
- Window overrides: `~/.config/forge/config/windows.json`
- User CSS: `~/.config/forge/stylesheet/forge/stylesheet.css`

## Key Patterns

**Session Modes**: Extension persists window data in `unlock-dialog` mode but disables keybindings. This is intentional to preserve window arrangement across lock/unlock.

**GObject Classes**: All core classes extend GObject with `static { GObject.registerClass(this); }` pattern.

**Window Classification**: Windows are classified as FLOAT, TILE, GRAB_TILE, or DEFAULT based on wmClass/wmTitle matching in windows.json.

**Signal Connections**: Track signal IDs for proper cleanup in disable().

## Build Output

The `make build` command compiles to `temp/` directory. The `make debug` command patches `lib/shared/settings.js` to set `production = false` for development logging.

## Code Style

- Prettier with 2-space indentation, 100-char line width
- Husky pre-commit hooks enforce formatting
- Use `npm run format` before committing

## Branches

- `main` - GNOME 40+ (current development)
- `legacy`/`gnome-3-36` - GNOME 3.36 support (feature-frozen)
