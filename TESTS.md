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

## Tiling Mode

## Floating Mode

## Layout Mode
