#!/usr/bin/env python3
"""a resize keeps going after the neighbour has reached its minimum size.

Growing a tiled window (held shortcut or mouse drag) keeps shrinking the neighbour's percent
after the neighbour's app refuses to get any smaller. The neighbour is then pushed partly
off-screen or over other windows, and the percents stop adding up (one goes over 100%).

Expected: the resize stops when the neighbour reaches its minimum size.
Run on a fresh sandbox:  sandbox/launch.sh && scenarios/03_resize_bounds.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402


def hold_ms():
    """Long enough to run out of room on this screen: key repeat adds ~15 px every ~30 ms after a
    500 ms delay, so ~500 px/s; 1.2 ms per px of screen width is ~2.3x the room there is."""
    return int(1000 + 1.2 * h.monitor_size()[0])


def main():
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    h.open_editor()
    h.open_editor()
    a, b = sorted(h.windows(), key=lambda w: w["x"])
    HOLD_MS = hold_ms()
    print(f"layout: [A={a['id'] % 1000} | B={b['id'] % 1000}] side by side (Text Editor: min frame 360x200)")
    r = []
    print("bug: growing a window into a neighbour at its minimum size")
    log = h.hold_keys(a["id"], h.GROW_KEYS["right"], HOLD_MS)
    r.append(h.layout_check("3.1", f"hold 'grow right' on A for {HOLD_MS} ms"))
    r.append(h.timeline_check("3.1 (while held)", "no overlap or off-screen while the key repeats", log))
    h.reset_layout()
    log = h.hold_keys(b["id"], h.GROW_KEYS["left"], HOLD_MS)
    r.append(h.layout_check("3.2", f"hold 'grow left' on B for {HOLD_MS} ms"))
    r.append(h.timeline_check("3.2 (while held)", "no overlap or off-screen while the key repeats", log))
    h.reset_layout()
    far = int(0.7 * h.monitor_size()[0])
    h.drag_edge(a["id"], "right", far, steps=40)
    r.append(h.layout_check("3.3", f"drag A's right edge {far} px to the right"))
    h.reset_layout()

    print("slow app: hold 'grow left' on B while B's app is frozen for 0.6 s")
    log = h.hold_keys(b["id"], h.GROW_KEYS["left"], HOLD_MS, during=h.stall_app(b["id"], 0.8, 0.6))
    r.append(h.layout_check("3.7", f"hold 'grow left' on B for {HOLD_MS} ms, app frozen 0.6 s"))
    r.append(h.timeline_check("3.7 (while held)", "no overlap or off-screen while the key repeats", log))
    h.reset_layout()

    print("bug: shrinking the focused window past its minimum leaves a gap (shares sum < 100%)")
    h.hold_keys(a["id"], h.SHRINK_KEYS["right"], HOLD_MS)
    r.append(h.layout_check("3.4", f"hold 'shrink right' on A for {HOLD_MS} ms"))
    h.reset_layout()

    print("bug, vertical: B above C in a container, grow B's bottom edge into C")
    h.open_app("gnome-text-editor", "--standalone")   # opens next to the focused window
    con_ids = [w["id"] for w in h.windows() if w["pid"] == "con"]
    if len(con_ids) == 2:
        h.ensure_parent_layout(con_ids[0], "VSPLIT")   # auto-split varies with screen size
    ws = h.windows()
    con = sorted([w for w in ws if w["pid"] == "con"], key=lambda w: w["y"])
    if len(con) == 2 and con[0]["playout"] == "VSPLIT":
        h.reset_layout()
        log = h.hold_keys(con[0]["id"], h.GROW_KEYS["bottom"], HOLD_MS)
        r.append(h.layout_check("3.5", f"hold 'grow bottom' on the upper window for {HOLD_MS} ms"))
        r.append(h.timeline_check("3.5 (while held)", "no overlap or off-screen while the key repeats", log))
        # Cross-container (parent pairs): grow a window in the container toward the top-level
        # window. On builds without the fix scenario 01 checks, the held resize snaps back on release, so
        # this case only exercises the limit once scenario 01 passes too.
        print("bug, across containers: grow a window in the container into the top-level window")
        h.reset_layout()
        top = next(w for w in h.windows() if w["pid"] == "top")
        side = h.neighbour_side(h.find(h.windows(), con[0]["id"]), top)
        log = h.hold_keys(con[0]["id"], h.GROW_KEYS[side], HOLD_MS)
        r.append(h.layout_check("3.6", f"hold 'grow {side}' on the upper window for {HOLD_MS} ms"))
        r.append(h.timeline_check("3.6 (while held)", "no overlap or off-screen while the key repeats", log))
    else:
        print(f"  SKIP  3.5: third window did not form a vertical container: {ws}")
    sys.exit(h.summary(r))


main()
