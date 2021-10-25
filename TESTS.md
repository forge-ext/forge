# Forge Tests

## Configurations and Preferences

### Preferences #39

- [ ] - Should open prefs.js via `<Super> + Period` in GNOME 3.3x+.

On opening Production Mode Preferences window:

- [ ] - Should close prefs.js via `Esc` in GNOME 3.3x+.
- [ ] - Should show `Home, Appearance, Workspace, Keyboard, Experimental,` on the parent-level settings list.
- [ ] - Should show `Appearance` right-arrow indicator, since Appearance have child-level settings options.
- [ ] - Should show `Keyboard` right-arrow indicator, since Keyboard have child-level settings options.

On opening Development Mode Preferences window, _includes_ all of Production Mode checks plus below:

- [ ] - Should show `Development, About,` on the parent-level settings list.

On navigating `Home` parent item,

- [ ] - Should show a _work in progress_ panel showing Forge version information depending if it was built using Production or Development mode.

On navigating `Appearance` parent item,

- [ ] - Should transition to sub-list which includes: `Windows,`. The initial sub-item's panel box  should show immediately.
- [ ] - Should show the `back button` on the header bar of the Preferences Window.
- [ ] - Should update the header bar `title` of the Preferences Window and appends `- Windows`.

### Production and Dev Modes

## Window Effects

When changing Preferences on Appearance > Colors:
- [ ] - Tiled Focus Hint updates border size and color
- [ ] - Tiled Focus Hint color updates also updates preview tiled hint
- [ ] - Tiled Focus Hint color updates also updates overview and workspace thumbnail hints
- [ ] - Tiled Focus Hint updates can be reset
- [ ] - Floated Focus Hint updates border size and color
- [ ] - Stacked Focus Hint updates border size and color
- [ ] - Stacked Focus Hint color updates also updates preview stacked hint
- [ ] - Stacked Focus Hint updates can be reset
- [ ] - Tabbed Focus Hint updates border size and color
- [ ] - Tabbed Focus Hint color updates also updates preview tabbed hint
- [ ] - Tabbed Focus Hint updates can be reset

## Tiling Mode

When dragging a window,
- [ ] - On dropping and _also_ pressing the Swap Modifier, should swap the windows.
- [ ] - On moving and _not_ pressing the Swap modifier, should show a preview hint where the window would be tiled.
    - [ ] - For split layout, should show preview hint left/right on horizontal, top/bottom on vertical following the mouse pointer.
    - [ ] - For tabbed layout, should show preview hint same size as the current front window.
    - [ ] - For stacked layout, should show preview hint same size as the current front window.
- [ ] - On moving and not pressing the Swap modifier, pressing ESC should cancel the drag/drop and dragged window should go back to its previous position.
- [ ] - On dropping and not pressing the Swap modifier, should tile the window on the preview hint position shown before dropping.
- [ ] - On moving, should update the focus hint position unless disabled.
- [ ] - On dropping to a different monitor, should tile based on the preview hint position shown unless empty monitor.
    - [ ] - Empty monitors will not show a preview hint.

## Floating Mode

## Layout Mode
