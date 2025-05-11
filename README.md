# Forge is not maintained anymore

Forge is a GNOME Shell extension that provides tiling/window management **_AND_** is looking for a new owner or maintainer:
- https://github.com/orgs/forge-ext/discussions/276
- https://github.com/forge-ext/forge/issues/336

## Features

- Works on GNOME 3.36+ (feature-freeze) and 40+. X11 and Wayland
- Tree-based tiling with vertical and horizontal split containers similar to i3-wm and sway-wm
- Vim-like keybindings for navigation/swapping windows/moving windows in the containers
- Drag and drop tiling
- Support for floating windows, smart gaps and focus hint
- Customizable shortcuts in extension preferences
- Some support for multi-display
- Tiling support per workspace
- Update hint color scheme from preferences
- Stacked tiling layout
- Swap current window with the last active window
- Auto Split or Quarter Tiling
- Show/hide tab decoration via keybinding https://github.com/forge-ext/forge/issues/180
- Window resize using keyboard shortcuts

## Known Issues / Limitations

- Does not support dynamic workspaces
- Does not support vertical monitor setup

## Installation

- Build it yourself via `make install` or `make dev`.
- Download from [GNOME extensions website](https://extensions.gnome.org/extension/4481/forge/).
- [AUR Package](https://aur.archlinux.org/packages/gnome-shell-extension-forge) - thanks to [@Radeox](https://github.com/Radeox)
- [Fedora Package](https://packages.fedoraproject.org/pkgs/gnome-shell-extension-forge/gnome-shell-extension-forge/) - thanks to [@carlwgeorge](https://github.com/carlwgeorge)

![image](https://user-images.githubusercontent.com/348125/146386593-8f53ea8b-2cf3-4d44-a613-bbcaf89f9d4a.png)

## Forge Keybinding Defaults

See the acceptable key combinations on the [wiki](https://github.com/forge-ext/forge/wiki/Keyboard-Shortcuts)

| Action | Shortcut |
| --- | --- |
| Increase active window size left | `<Ctrl> + <Super> + y` |
| Decrease active window size left | `<Ctrl> + <Shift> + <Super> + o` |
| Increase active window size bottom | `<Ctrl> + <Super> + u` |
| Decrease active window size bottom | `<Ctrl> + <Shift> + <Super> + i` |
| Increase active window size top | `<Ctrl> + <Super> + i` |
| Decrease active window size top | `<Ctrl> + <Shift> + <Super> + u` |
| Increase active window size right | `<Ctrl> + <Super> + o` |
| Decrease active window size right | `<Ctrl> + <Shift> + <Super> + y` |
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
| Show/hide tab decoration | `<Ctrl> + <Alt> + y` |
| Activate tile drag-drop | `Start dragging - Mod key configuration in prefs` |
| Snap active window left two thirds | `<Ctrl> + <Alt> + e` |
| Snap active window right two thirds | `<Ctrl> + <Alt> + t` |
| Snap active window left third | `<Ctrl> + <Alt> + d` |
| Snap active window right third | `<Ctrl> + <Alt> + g` |
| Persist toggle floating for active window | `<Super> + c` |
| Persist toggle floating for active window and its window class | `<Super><Shift> + c` |

For any shortcut conflicts, the user has to manually configure those for now from the
`GNOME Control Center > Keyboard > Customize Shortcuts`. https://github.com/forge-ext/forge/issues/37

## Forge Override Paths

- Window Overrides: `$HOME/.config/forge/config/windows.json`
- Stylesheet Overrides: `$HOME/.config/forge/stylesheet/forge/stylesheet.css`

## GNOME Defaults

GNOME Shell has built in support for workspace management and seems to work well - so Forge will not touch those.

User is encouraged to bind the following:
- Switching/moving windows to different workspaces
- Switching to numbered, previous or next workspace

## Development

- The `main` branch contains gnome-4x code.
- The `legacy` and `gnome-3-36` are the same and is now the source for gnome-3x.

## Local Development Setup

- Install NodeJS 16+
- Install `gettext`
- Run `npm install`
- Commands:

```bash
# Compile and override the gnome-shell update repo
make dev

# Or run below, and restart the shell manually
make build && make debug && make install

# X11 - build from source and restarts gnome-shell
make test-x

# Wayland - build from source and starts a wayland instance (no restart)
make test-wayland

# Formatting, when you do npm install,
# husky gets installed should force prettier formatting during commit

npm run format
```

## Contributing

- Please be nice, friendly and welcoming on discussions/tickets.
- See existing [issues](https://github.com/forge-ext/forge/issues) or file a new ticket with the bug report format if it doesn't exist.

## Credits

Thank you to:
- Forge extension contributors
- Michael Stapelberg/contributors for i3
- System76/contributors for pop-shell
- ReworkCSS/contributors for css-parse/css-stringify
