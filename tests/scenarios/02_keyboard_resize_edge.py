#!/usr/bin/env python3
"""vertical keyboard resize moves the OPPOSITE edge while the key repeats.

`resize()` applies the y adjustment to the wrong vertical direction: "grow/shrink bottom"
moves the window's TOP edge, and "grow/shrink top" moves its BOTTOM edge, until the final
render snaps it back into the layout. Horizontal (left/right) shortcuts are correct and serve
as controls.

Layout: [A] + CON(VSPLIT)[B, C]. B's bottom edge and C's top edge form the B|C border.
Run on a fresh sandbox:  sandbox/launch.sh && scenarios/02_keyboard_resize_edge.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

# Forge's window-resize-<edge>-increase / -decrease shortcuts, read from its settings
# (defaults: grow bottom Ctrl+Super+U, shrink bottom Ctrl+Shift+Super+I, ...).
def keys(side, mode):
    return (h.GROW_KEYS if mode == "grow" else h.SHRINK_KEYS)[side]


# The non-resized edge may shift by at most two resize steps (2 x 15 px) while the key repeats:
# on Wayland mutter applies a new position immediately but a new size only when the client
# commits it, so a left/top edge resize can show the window shifted by a step or two in
# flight. The bug (moving the wrong edge) instead accumulates with every repeat.
EDGE_TOL = 30


def fixed_edge_check(name, win, side, mode, hold_ms, stall=False):
    """While `side` of `win` is resized by keyboard, the opposite edge must not move.
    stall: freeze the app for 0.6 s during the hold (a slow or busy app)."""
    opp = h.OPP[side]
    h.reset_layout()                  # start each case from a settled, equal layout
    during = h.stall_app(win["id"], 0.8, 0.6) if stall else None
    log = h.hold_keys(win["id"], keys(side, mode), hold_ms, during=during)
    samples = []
    for line in log:
        if any(t in line for t in ("start", "keys down", "holding", "keys released")):
            w = h.parse_line(line).get(win["id"] % 1000)
            if w:
                samples.append(h.edge({"x": w["x"], "y": w["y"], "w": w["w"], "h": w["h"]}, opp))
    start = samples[0]
    worst = max(samples, key=lambda v: abs(v - start))
    moved_side = [h.edge({"x": w["x"], "y": w["y"], "w": w["w"], "h": w["h"]}, side)
                  for w in (h.parse_line(l).get(win["id"] % 1000) for l in log) if w]
    resized = abs(moved_side[-1] - moved_side[0]) > 0 or mode == "shrink"
    ok = abs(worst - start) <= EDGE_TOL
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: {mode} {side} ({hold_ms} ms): {opp} edge "
          f"{start:.0f} -> worst {worst:.0f} during repeat (Δ{worst - start:+.0f})"
          f"{'' if resized else '  [warning: resized edge did not move]'}")
    return ok


def main():
    a, b, c = h.nested_layout()
    h.ensure_parent_layout(c["id"], "VSPLIT")      # B above C (auto-split varies with screen size)
    h.reset_layout()
    b, c = sorted((h.find(h.windows(), b["id"]), h.find(h.windows(), c["id"])), key=lambda w: w["y"])
    ws = h.windows()
    print(f"layout: A={a['id'] % 1000} + CON VSPLIT[B={b['id'] % 1000} (top), C={c['id'] % 1000} (bottom)]")
    side_ba = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, a["id"]))

    r = []
    print("bug: vertical shortcuts, sampled during key repeat")
    r.append(fixed_edge_check("2.1", b, "bottom", "grow", 700))
    r.append(fixed_edge_check("2.2", b, "bottom", "shrink", 700))
    r.append(fixed_edge_check("2.3", c, "top", "grow", 700))
    r.append(fixed_edge_check("2.4", c, "top", "shrink", 700))
    r.append(fixed_edge_check("2.5", b, "bottom", "grow", 0))   # single tap
    print("control: horizontal shortcut (left edge), sampled during key repeat")
    r.append(fixed_edge_check("2.6", b, side_ba, "shrink", 700))
    sys.exit(h.summary(r))


main()
