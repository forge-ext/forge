#!/usr/bin/env python3
# sandbox: second-monitor
"""Regression checks for how Forge places windows: moving a window to another monitor and back,
an X11 (Xwayland) app, and maximize/unmaximize of a tiled window. Written for the change that
moves and resizes a window in one request instead of move_frame() + move_resize_frame().

Needs a second monitor:  SANDBOX_SECOND_MONITOR=1280x1024 sandbox/launch.sh && scenarios/12_monitors_x11.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

W = "global.display.list_all_windows().find(w => w.get_id() === {})"


def geometry(wid):
    return h.js(f"""(() => {{ const w = {W.format(wid)}; const f = w.get_frame_rect();
        const m = w.get_monitor(); const a = global.workspace_manager.get_active_workspace().get_work_area_for_monitor(m);
        return {{mon: m, x: f.x, y: f.y, w: f.width, h: f.height, ax: a.x, ay: a.y, aw: a.width, ah: a.height,
                 max: w.is_maximized()}}; }})()""")


def inside(g, tol=2):
    return (g["x"] >= g["ax"] - tol and g["y"] >= g["ay"] - tol and
            g["x"] + g["w"] <= g["ax"] + g["aw"] + tol and g["y"] + g["h"] <= g["ay"] + g["ah"] + tol)


def check(name, ok, what):
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: {what}")
    return ok


def open_x11(title):
    display = h.js('GLib.getenv("DISPLAY")')
    xauth = h.js('GLib.getenv("XAUTHORITY")')
    h.open_app("env", f"DISPLAY={display}", f"XAUTHORITY={xauth}", "xmessage", "-name", title, title)


def main():
    h.require(apps=("xmessage",))
    if h.js("global.display.get_n_monitors()") < 2:
        raise SystemExit("needs two monitors: SANDBOX_SECOND_MONITOR=1280x1024 sandbox/launch.sh")
    h.open_editor()
    h.open_editor()
    a, b = sorted(h.windows(), key=lambda w: w["x"])
    r = []

    print("move a tiled window to the other monitor and back (window-move-right / -left)")
    for _ in range(3):
        h.hold_keys(b["id"], h.chord("window-move-right"), 0)
        time.sleep(1.0)
        if geometry(b["id"])["mon"] == 1:
            break
    g = geometry(b["id"])
    r.append(check("12.1", g["mon"] == 1 and inside(g), f"on monitor {g['mon']}, frame {g['x']},{g['y']} {g['w']}x{g['h']} "
                   f"inside its work area {g['ax']},{g['ay']} {g['aw']}x{g['ah']}"))
    r.append(h.layout_check("12.2", "monitor 0's layout after the move (A alone)"))
    for _ in range(3):
        h.hold_keys(b["id"], h.chord("window-move-left"), 0)
        time.sleep(1.0)
        if geometry(b["id"])["mon"] == 0:
            break
    g = geometry(b["id"])
    r.append(check("12.3", g["mon"] == 0 and inside(g), f"back on monitor {g['mon']}, frame {g['x']},{g['y']} {g['w']}x{g['h']}"))
    r.append(h.layout_check("12.4", "monitor 0's layout after moving back"))

    print("maximize and unmaximize a tiled window")
    h.js(f'(() => {{ {W.format(a["id"])}.maximize(); return "ok"; }})()')
    time.sleep(1.0)
    h.js(f'(() => {{ {W.format(a["id"])}.unmaximize(); return "ok"; }})()')
    time.sleep(1.5)
    r.append(h.layout_check("12.5", "layout after maximize + unmaximize"))

    print("an X11 app, tiled and resized")
    open_x11("forge-x11-test")
    x11 = next(w for w in h.windows() if w["id"] not in (a["id"], b["id"]))
    log = h.hold_keys(x11["id"], h.GROW_KEYS[h.neighbour_side(h.find(h.windows(), x11["id"]), h.find(h.windows(), a["id"]))], 800)
    r.append(h.layout_check("12.6", "layout after holding a resize shortcut on the X11 window"))
    r.append(h.timeline_check("12.6 (while held)", "no overlap or off-screen while the key repeats", log))
    sys.exit(h.summary(r))


main()
