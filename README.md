# Forge

Forge is a GNOME Shell extension that provides tiling/window management.

## Installation
- Extensions GNOME site: https://extensions.gnome.org/extension/4481/forge/
- Download/clone the source and `make install`, restart gnome-shell after or `make dev`.
- AUR Package: https://aur.archlinux.org/packages/gnome-shell-extension-forge - thanks to [@Radeox](https://github.com/Radeox)

## ! Major Changes !
- Implemented quarter tiling. See https://github.com/jmmaranan/forge/issues/166. Toggle available on preferences
- Implemented floating windows are default always on top. Toggle available on preferences

## Development
- The `main` branch contains gnome-4x code.
- The `legacy` and `gnome-3-36` are the same and is now the source for gnome-3x.

## Local Development Setup
- Install NodeJS 16+
- Install `gettext`
- Run `npm install`
- Run `make dev`. Ctrl + C to cancel

## Features
- Tree-based tiling with vertical and horizontal split containers similar to i3-wm
- Vim-like keybindings for navigation/swapping windows/moving windows in the containers
- Drag and drop tiling
- Support for floating windows, smart gaps and focus hint
- Customizable shortcuts in extension preferences
- Some support for multi-display
- Tiling support per workspace
- Update hint color scheme from Preferences
- Stacked tiling layout
- Works on GNOME 3.36+ (feature-freeze) and 40. X11 and Wayland
- Swap current window with the last active window
- Auto Split or Quarter Tiling
- Show/hide tab decoration via keybinding https://github.com/jmmaranan/forge/issues/180

![image](https://user-images.githubusercontent.com/348125/146386593-8f53ea8b-2cf3-4d44-a613-bbcaf89f9d4a.png)

## Forge Keybinding Defaults

### New
| Action | Shortcut |
| --- | --- |
| Show/hide tab decoration | `<Ctrl> + <Alt> + y` |

### Current

| Action | Shortcut |
| --- | --- |
| Open preferences | `<Super> + period` |
| Toggle tiling mode |`<Super> + w` |
| Focus left | `<Super> + h` |
| Focus right | `<Super> + l` |
| Focus up | `<Super> + k` |
| Focus down | `<Super> + j` |
| Swap current window with last active | `<Super> + Return` |
| Swap active window left | `<Ctrl> + <Super> + h` |
| Swap active window right | `<Ctrl> + <Super> + l` |
| Swap active window up | `<Ctrl> + <Super> + k` |
| Swap active window down | `<Ctrl> + <Super> + j` |
| Move active window left | `<Shift> + <Super> + h` |
| Move active window right | `<Shift> + <Super> + l` |
| Move active window up | `<Shift> + <Super> + k` |
| Move active window down | `<Shift> + <Super> + j` |
| Split container horizontally | `<Super> + z` |
| Split container vertically | `<Super> + v` |
| Toggle split container | `<Super> + g` |
| Gap increase | `<Ctrl> + <Super> + Plus` |
| Gap decrease | `<Ctrl> + <Super> + Minus` |
| Toggle focus hint | `<Super> + x` |
| Toggle active workspace tiling | `<Shift> + <Super> + w` |
| Toggle stacked layout | `<Shift> + <Super> + s` |
| Toggle tabbed layout | `<Shift> + <Super> + t` |
| Activate tile drag-drop | `Start dragging - Mod key configuration in prefs` |
| Snap active window left two thirds | `<Ctrl> + <Alt> + e` |
| Snap active window right two thirds | `<Ctrl> + <Alt> + t` |
| Snap active window left third | `<Ctrl> + <Alt> + d` |
| Snap active window right third | `<Ctrl> + <Alt> + g` |
| Persist toggle floating for active window | `<Super> + c` |
| Persist toggle floating for active window and its window class | `<Super><Shift> + c` |

For any shortcut conflicts, the user has to manually configure those for now from the
`GNOME Control Center > Keyboard > Customize Shortcuts`. https://github.com/jmmaranan/forge/issues/37

## Forge Override Paths
- Window Overrides: `$HOME/.config/forge/config/windows.json`
- Stylesheet Overrides: `$HOME/.config/forge/stylesheet/forge/stylesheet.css`

## GNOME Defaults

GNOME Shell has built in support for workspace management and seems to work well - so Forge will not touch those.

User is encouraged to bind the following:
- Switching/moving windows to different workspaces
- Switching to numbered, previous or next workspace

## Contributing

- Please be nice, friendly and welcoming on discussions/tickets.
- See existing [issues](https://github.com/jmmaranan/forge/issues) or file a new ticket with title `bug: short description` if it doesn't exist.

## Credits

Thank you to: 
- Michael Stapelberg/contributors for i3.
- System76/contributors for pop-shell.
- ReworkCSS/contributors for css-parse/css-stringify.
