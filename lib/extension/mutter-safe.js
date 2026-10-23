// Guard helpers around Meta.Window operations that fault when the window
// has been unmanaged but Forge still holds a reference to it.
//
// Mutter clears `compositor_private` and resets `stack_position` to -1
// the moment a window is unmanaged. Calling `raise()`, `activate()`, or
// `focus()` after that fires assertions like
//   meta_window_set_stack_position_no_sync: assertion 'window->stack_position >= 0' failed
// and bumps the gnome-shell main-loop cost on every churn (alt-tab,
// app close, workspace move). The checks here cost a single C call and
// short-circuit before Forge hands a dead window back to Mutter.

export function isWindowAlive(metaWindow) {
  if (!metaWindow) return false;
  if (typeof metaWindow.get_compositor_private !== "function") return false;
  return metaWindow.get_compositor_private() !== null;
}

export function safeRaise(metaWindow) {
  if (!isWindowAlive(metaWindow)) return false;
  metaWindow.raise();
  return true;
}

export function safeFocus(metaWindow, time) {
  if (!isWindowAlive(metaWindow)) return false;
  metaWindow.focus(time);
  return true;
}

export function safeActivate(metaWindow, time) {
  if (!isWindowAlive(metaWindow)) return false;
  metaWindow.activate(time);
  return true;
}
