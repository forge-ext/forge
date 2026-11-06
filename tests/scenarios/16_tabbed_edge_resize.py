#!/usr/bin/env python3
"""Resizing a window in a tabbed or stacked group by dragging the group's outer edge.

A tab (or stack) group is one tile: dragging the edge of its visible window that faces a neighbour
must move the border between the group and that neighbour. Forge looks for the neighbour with
Tree.next(), which walks a tabbed group as if its tabs were side by side (and a stacked group as if
its windows were above each other). So when the visible window isn't the first in its group, the
"neighbour" found is the previous tab: the resize changes shares inside the group, nothing moves,
and the edge snaps back on release. Found in a real session (a VS Code window, second of three tabs,
next to a column of terminals).

  16.1  control: drag the neighbour's edge that faces the tab group
  16.2  tabbed group, first tab visible: drag its left edge (works on main)
  16.3  tabbed group, last tab visible: drag its left edge
  16.4  stacked group below a window, last window visible: drag its top edge
  16.5  the real-session shape: VSPLIT[A, E] | TABBED[B, C, D], second tab visible, left edge
  16.6  a tab that is itself a split: A | TABBED[C, HSPLIT[B, B2]], B's left edge
  16.7  a split inside a stacked group, dragged on its top edge: X over STACKED[W, VSPLIT[P, Q]];
        the P | Q border must not move (the split is smaller than the group by the headers)

Run on a fresh sandbox:  sandbox/launch.sh && scenarios/16_tabbed_edge_resize.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402


def command(win_id, cmd):
    h.js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {win_id})
        .activate(global.get_current_time()); {h.WM}.command({cmd}); return "ok"; }})()""")
    time.sleep(1.0)


def activate(win_id):
    h.js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {win_id})
        .activate(global.get_current_time()); return "ok"; }})()""")
    time.sleep(0.5)
    h.settle()


def new_window():
    known = {w["id"] for w in h.windows()}
    h.open_editor()
    return next(w for w in h.windows() if w["id"] not in known)


def group(beside, split, layout_cmd, column=False):
    """A beside a group of three windows [B, C, D]: returns (A, [B, C, D]). `split`: the
    direction of the monitor split ("horizontal": A | group, "vertical": A over group).
    `column`: A is a column VSPLIT[A, E] instead of a single window."""
    a = new_window()
    b = new_window()
    h.ensure_parent_layout(a["id"], "VSPLIT" if split == "vertical" else "HSPLIT")
    if column:
        command(a["id"], '{name: "Split", orientation: "vertical"}')
        new_window()                                      # E joins A's column
    command(b["id"], '{name: "Split", orientation: "horizontal"}')
    c = new_window()
    d = new_window()
    command(b["id"], f'{{name: "{layout_cmd}"}}')
    h.settle()
    print(f"layout: {h.tree_summary()}")
    return a, [b, c, d]


def drag_check(name, win_id, side, delta, nb_id):
    ws = h.windows()
    before = h.edge(h.find(ws, win_id), side)
    # the space to the neighbour before the drag (stacked groups add their headers to the gap)
    space = abs(h.edge(h.find(ws, nb_id), h.OPP[side]) - before)
    _, grabbed, _ = h.drag_edge(win_id, side, delta)
    if not grabbed:
        print(f"  FAIL  {name}: the drag didn't start a resize")
        return False
    return h.settle_check(name, win_id, side, nb_id, before + delta, gap=space)


def done():
    h.close_windows()
    time.sleep(1.0)


def main():
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    h.set_forge_setting("auto-split-enabled", False)
    r = []

    a, tabs = group("A", "horizontal", "LayoutTabbedToggle")
    activate(tabs[0]["id"])
    r.append(drag_check("16.1", a["id"], "right", -200, tabs[0]["id"]))
    h.reset_layout()
    r.append(drag_check("16.2", tabs[0]["id"], "left", -200, a["id"]))
    h.reset_layout()
    activate(tabs[2]["id"])
    r.append(drag_check("16.3", tabs[2]["id"], "left", -200, a["id"]))
    done()

    a, stack = group("A", "vertical", "LayoutStackedToggle")
    activate(stack[2]["id"])
    r.append(drag_check("16.4", stack[2]["id"], "top", -150, a["id"]))
    done()

    a, tabs = group("A", "horizontal", "LayoutTabbedToggle", column=True)
    activate(tabs[1]["id"])
    r.append(drag_check("16.5", tabs[1]["id"], "left", -200, a["id"]))
    done()

    a = new_window()
    c = new_window()
    h.ensure_parent_layout(a["id"], "HSPLIT")
    command(c["id"], '{name: "Split", orientation: "horizontal"}')
    b = new_window()                                   # HSPLIT[A, HSPLIT[C, B]]
    command(b["id"], '{name: "Split", orientation: "horizontal"}')
    new_window()                                       # HSPLIT[A, HSPLIT[C, HSPLIT[B, B2]]]
    command(c["id"], '{name: "LayoutTabbedToggle"}')
    activate(b["id"])
    print(f"layout: {h.tree_summary()}")
    r.append(drag_check("16.6", b["id"], "left", -200, a["id"]))
    done()

    x = new_window()
    w = new_window()
    h.ensure_parent_layout(x["id"], "VSPLIT")
    command(w["id"], '{name: "Split", orientation: "vertical"}')
    p = new_window()                                   # VSPLIT[X, VSPLIT[W, P]]
    command(p["id"], '{name: "Split", orientation: "vertical"}')
    q = new_window()                                   # VSPLIT[X, VSPLIT[W, VSPLIT[P, Q]]]
    command(w["id"], '{name: "LayoutStackedToggle"}')
    activate(p["id"])
    print(f"layout: {h.tree_summary()}")
    q_before = h.find(h.windows(), q["id"])["h"]
    r.append(drag_check("16.7", p["id"], "top", -150, x["id"]))
    q_after = h.find(h.windows(), q["id"])["h"]
    ok = abs(q_after - q_before) <= h.TOL
    print(f"  {'PASS' if ok else 'FAIL'}  16.7 (inside): Q's height {q_before} -> {q_after} (must not change)")
    r.append(ok)
    sys.exit(h.summary(r))


main()
