#!/usr/bin/env python3
"""resizing a window's outer edge moves its sibling's border too, when the window's
container is split in the same direction as its parent (e.g. HSPLIT[A, HSPLIT[B, C]], which
Forge's auto-split creates on wide screens).

Growing B's left edge (toward A) makes the container [B, C] larger, and Forge then shares the
extra space between B and C by their percents: C grows too and the B|C border moves, although
only the A|B border was touched. With a held shortcut A also loses twice what was asked for.
Only visible with the fix scenario 01 checks (without it these resizes snap back anyway).

Run on a fresh sandbox:  sandbox/launch.sh && scenarios/08_nested_same_direction.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402


def command(name, focus_id=None):
    if focus_id:
        h.js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {focus_id})
            .activate(global.get_current_time()); return "ok"; }})()""")
        time.sleep(0.4)
    h.js(f'(() => {{ {h.WM}.command({{name: "{name}"}}); return "ok"; }})()')
    time.sleep(1.0)


def size(win, side):
    return win["w"] if side in h.HORIZONTAL else win["h"]


def sibling_kept(name, c_before, c_id, side):
    """C (the sibling) must keep its size and position along the resize direction."""
    c = h.find(h.windows(), c_id)
    moved = abs(size(c, side) - size(c_before, side)) + abs(h.edge(c, h.OPP[side]) - h.edge(c_before, h.OPP[side]))
    ok = moved <= h.TOL
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: sibling C {size(c_before, side)} -> {size(c, side)} px, "
          f"far edge {h.edge(c_before, h.OPP[side])} -> {h.edge(c, h.OPP[side])}")
    return ok


def run(prefix, a, b, c):
    ws = h.windows()
    side = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, a["id"]))
    r = []
    print(f"layout: {h.tree_summary()}; B's {side} edge faces A")

    h.reset_layout()
    c0 = h.find(h.windows(), c["id"])
    log = h.hold_keys(b["id"], h.GROW_KEYS[side], 600)
    rel = h.parse_line(next(l for l in log if "keys released" in l))[b["id"] % 1000]
    time.sleep(1.2)
    now = h.find(h.windows(), b["id"])
    ok = abs(size(now, side) - (rel["w"] if side in h.HORIZONTAL else rel["h"])) <= h.TOL
    print(f"  {'PASS' if ok else 'FAIL'}  {prefix}.1: hold 'grow {side}' on B 600 ms: B at release "
          f"{rel['w'] if side in h.HORIZONTAL else rel['h']:.0f}, settled {size(now, side)}")
    r.append(ok)
    r.append(sibling_kept(f"{prefix}.1 (sibling)", c0, c["id"], side))
    r.append(h.timeline_check(f"{prefix}.1 (while held)", "no overlap or off-screen while the key repeats", log))

    h.reset_layout()
    c0 = h.find(h.windows(), c["id"])
    delta = -200 if side in ("left", "top") else 200
    before = h.edge(h.find(h.windows(), b["id"]), side)
    _, grabbed, _ = h.drag_edge(b["id"], side, delta)
    r.append(grabbed and h.settle_check(f"{prefix}.2", b["id"], side, a["id"], before + delta))
    r.append(sibling_kept(f"{prefix}.2 (sibling)", c0, c["id"], side))

    h.reset_layout()
    c0 = h.find(h.windows(), c["id"])
    hold = int(1000 + 1.2 * max(h.monitor_size()))
    log = h.hold_keys(b["id"], h.SHRINK_KEYS[side], hold)
    r.append(h.layout_check(f"{prefix}.3", f"hold 'shrink {side}' on B {hold} ms: B stops at its minimum"))
    r.append(sibling_kept(f"{prefix}.3 (sibling)", c0, c["id"], side))
    r.append(h.timeline_check(f"{prefix}.3 (while held)", "no overlap or off-screen while the key repeats", log))
    return r


def main():
    a, b, c = h.nested_layout()                    # [A] + CON[B, C]
    r = []
    print("side by side: HSPLIT[A, HSPLIT[B, C]]")
    h.ensure_parent_layout(a["id"], "HSPLIT")     # the monitor
    h.ensure_parent_layout(c["id"], "HSPLIT")     # the container
    b, c = sorted((h.find(h.windows(), b["id"]), h.find(h.windows(), c["id"])), key=lambda w: w["x"])
    r += run("8", a, b, c)
    print("stacked: VSPLIT[A, VSPLIT[B, C]]")
    h.ensure_parent_layout(a["id"], "VSPLIT")
    h.ensure_parent_layout(c["id"], "VSPLIT")
    b, c = sorted((h.find(h.windows(), b["id"]), h.find(h.windows(), c["id"])), key=lambda w: w["y"])
    r += run("8v", a, b, c)
    sys.exit(h.summary(r))


main()
