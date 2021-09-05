# Forge

Forge is a GNOME Shell extension that provides extra tiling/window management.

## Features
- Tree based tiling with vertical and horizontal split containers similar to i3-wm.
- Vim-like keybindings for navigation/swapping windows. Customizable shortcuts in extension preferences.
- Support for floating windows and focus hint.
- Limited support for multi-display.
- Works in gnome-shell versions 3.36+ and 40.

## Forge Keybinding Defaults

| Action | Shortcut |
| --- | --- |
| Open preferences | `<Super> + period` |
| Toggle tiling mode |`<Super> + w` |
| Toggle floating for active window | `<Super> + c` |
| Focus left | `<Super> + h` |
| Focus right | `<Super> + l` |
| Focus up | `<Super> + k` |
| Focus down | `<Super> + j` |
| Swap active window left | `<Ctrl> + <Super> + h` |
| Swap active window right | `<Ctrl> + <Super> + l` |
| Swap active window up | `<Ctrl> + <Super> + k` |
| Swap active window down | `<Ctrl> + <Super> + j` |
| Split container horizontally | `<Super> + z` |
| Split container vertically | `<Super> + v` |
| Toggle split container | `<Super> + g` |

## GNOME Defaults

GNOME Shell has built in support for workspace management and seems to work well - so Forge will not touch those.

User is encouraged to bind the following:
- Switching/moving windows to different workspaces
- Switching to numbered, previous or next workspace

## Work in Progress
- Stacking Containers
- Tabbed Containers
