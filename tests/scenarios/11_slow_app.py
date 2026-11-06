#!/usr/bin/env python3
"""a held resize shortcut slides a slow app's window instead of resizing it.

On Wayland a new position takes effect at once, but a new size only when the app redraws. Forge
started each key repeat from the window's frame, which (while the app is slow) already has the
new position but still the old size: growing the left or top edge then moved the whole window,
the opposite edge drifted by one step per key repeat, and it stayed there until the resize ended.
Here the app is frozen (SIGSTOP) for a moment during the hold to make it slow on purpose.

Layout: [A] + CON(VSPLIT)[B, C]. Run on a fresh sandbox: sandbox/launch.sh && scenarios/11_slow_app.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

EDGE_TOL = 30     # one or two resize steps: Wayland shows a new position just before a new size


def opposite_edge(name, win, side, hold_ms, freeze_s):
    """While `side` of `win` grows with the app frozen for `freeze_s`, the opposite edge stays."""
    opp = h.OPP[side]
    log = h.hold_keys(win["id"], h.GROW_KEYS[side], hold_ms, during=h.stall_app(win["id"], 0.8, freeze_s))
    samples = [h.edge(w, opp) for w in (h.parse_line(l).get(win["id"] % 1000) for l in log) if w]
    grown = [h.edge(w, side) for w in (h.parse_line(l).get(win["id"] % 1000) for l in log) if w]
    worst = max(samples, key=lambda v: abs(v - samples[0]))
    ok = abs(worst - samples[0]) <= EDGE_TOL and abs(samples[-1] - samples[0]) <= 2
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: grow {side} {hold_ms} ms, app frozen {freeze_s} s: {opp} edge "
          f"{samples[0]:.0f} -> worst {worst:.0f}, at the end {samples[-1]:.0f}; {side} edge moved "
          f"{grown[-1] - grown[0]:+.0f} px")
    return ok


def main():
    a, b, c = h.nested_layout()
    h.ensure_parent_layout(c["id"], "VSPLIT")
    b, c = sorted((h.find(h.windows(), b["id"]), h.find(h.windows(), c["id"])), key=lambda w: w["y"])
    ws = h.windows()
    side_ba = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, a["id"]))
    print(f"layout: {h.tree_summary()}")
    r = []
    print("bug: the app is slow to redraw while its left/top edge grows")
    h.reset_layout()
    r.append(opposite_edge("11.1", c, "top", 1600, 0.6))
    h.reset_layout()
    r.append(opposite_edge("11.2", b, side_ba, 1600, 0.6))

    print("slow neighbour: A is frozen for 0.2 s while B grows into it")
    h.reset_layout()
    log = h.hold_keys(b["id"], h.GROW_KEYS[side_ba], 2000, during=h.stall_app(a["id"], 0.9, 0.2))
    probs = h.timeline_problems(log)
    print(f"  info  11.3: while A was frozen: {probs or 'no overlap'} (A can't redraw; expected to settle)")
    r.append(h.layout_check("11.3", "no overlap once A redraws"))
    sys.exit(h.summary(r))


main()
