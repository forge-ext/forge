#!/usr/bin/env python3
"""Forge puts tiled windows back after something else moves or resizes them.

Forge re-renders when a tiled window's position or size changes. A performance change may skip
renders that would only repeat the last one (a window arriving where Forge just put it), but these
must still render:

  15.1  an app resizes its own tiled window: Forge puts it back in its place;
  15.2  a window is maximized, its neighbour changes size meanwhile, then the window is restored:
        the neighbour is back in its place too;
  15.3  the same, all within 0.8 s of a render (so a "recent request" rule can't hide it).

These pass on main; they guard against skipping a render that was needed.

Run on a fresh sandbox:  sandbox/launch.sh && scenarios/15_render_on_changes.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402


def resize_behind_forges_back(win_id, dw):
    """Resize a window the way an app would (not through Forge)."""
    h.js(f"""(() => {{ const w = global.display.list_all_windows().find(w => w.get_id() === {win_id});
        const f = w.get_frame_rect(); w.move_resize_frame(true, f.x, f.y, f.width + {dw}, f.height);
        return "ok"; }})()""")


def maximize(win_id, on):
    h.js(f"""(() => {{ const w = global.display.list_all_windows().find(w => w.get_id() === {win_id});
        if ({'true' if on else 'false'}) w.maximize(); else w.unmaximize(); return "ok"; }})()""")


def main():
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    h.open_editor()
    h.open_editor()
    a, b = sorted(h.windows(), key=lambda w: w["x"])
    r = []

    resize_behind_forges_back(b["id"], -200)
    time.sleep(1.5)
    r.append(h.layout_check("15.1", "an app shrinks its own tiled window: Forge puts it back"))

    maximize(a["id"], True)
    time.sleep(1.5)
    resize_behind_forges_back(b["id"], -200)
    time.sleep(1.5)
    maximize(a["id"], False)
    time.sleep(1.5)
    r.append(h.layout_check("15.2", "restore a maximized window: its neighbour, resized meanwhile, "
                                    "is back in its place"))

    h.js(f'(() => {{ {h.WM}.renderTree("test"); return "ok"; }})()')   # Forge requests every frame now
    time.sleep(0.2)
    maximize(a["id"], True)
    time.sleep(0.2)
    resize_behind_forges_back(b["id"], -200)
    time.sleep(0.2)
    maximize(a["id"], False)
    r.append(h.layout_check("15.3", "the same within 0.8 s of a render"))
    sys.exit(h.summary(r))


main()
