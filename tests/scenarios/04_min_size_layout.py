#!/usr/bin/env python3
"""the layout ignores windows' minimum sizes.

Forge splits space purely by percent. When a window's share is smaller than the minimum size
its app allows, GNOME keeps the window at its minimum and it overlaps its neighbour or extends
off-screen (#117, #271).

Part 1, the windows fit: after a resize has left a window at its minimum, anything that shrinks
the space (here: larger gaps; also a lower display resolution or a panel) squeezes it below
its minimum. Expected: it keeps its minimum and the other windows give up the space.
After such a clamp, the stored shares must match what is shown, or a later resize drifts.
(Windows that can't all fit at their minimum sizes: see 13_overflow_policy.py, a proposal.)

Run on a fresh sandbox:  sandbox/launch.sh && scenarios/04_min_size_layout.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

WM = h.WM


def shares():
    return [(w["id"] % 1000, w["x"], w["w"], round(w["percent"], 3)) for w in sorted(h.windows(), key=lambda w: (w["x"], w["y"]))]


def close_all():
    """Close the windows one at a time. (Closing all windows of a tabbed container at the same
    moment leaves its tab bar on screen: a separate upstream bug, scenario 06.)"""
    h.close_windows()


def main():
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    h.set_forge_setting("auto-split-enabled", False)   # new windows join the focused window's split
    r = []

    print("bug: the windows fit, but the space shrinks after a resize left one at its minimum")
    for _ in range(3):
        h.open_editor()
    a, b, c = sorted(h.windows(), key=lambda w: w["x"])
    h.drag_edge(a["id"], "right", h.monitor_size()[0] // 3, steps=30)   # B (middle) ends at its minimum
    time.sleep(1.0)
    print(f"          after drag: {shares()}")
    h.set_forge_setting("window-gap-size-increment", 4)   # gaps 4 -> 16 px
    time.sleep(0.5)
    r.append(h.layout_check("4.1", "gap size 4 -> 16 px with the middle window at its minimum"))
    print(f"          {shares()}")

    print("bug: a resize after a window was held at its minimum drifts")
    h.settle()
    a0 = h.find(h.windows(), a["id"])
    before = h.edge(h.find(h.windows(), b["id"]), "right")
    h.drag_edge(b["id"], "right", 150, steps=20)
    r.append(h.settle_check("4.2", b["id"], "right", c["id"], before + 150))
    a1 = h.find(h.windows(), a["id"])
    ok = abs(a1["w"] - a0["w"]) <= h.TOL and abs(a1["x"] - a0["x"]) <= h.TOL
    print(f"  {'PASS' if ok else 'FAIL'}  4.2 (others): A {a0['x']},{a0['w']} -> {a1['x']},{a1['w']} (must not change)")
    r.append(ok)
    sys.exit(h.summary(r))

main()
