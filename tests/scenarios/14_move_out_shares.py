#!/usr/bin/env python3
# sandbox: second-monitor
"""Moving a window out of its container can leave its old size share behind.

Forge sizes the windows of a split by their shares (percents), which must add up to 100%. When
"move window up/down" (or left/right) takes a window out of its container to the workspace level
(because there's nothing in that direction to move into), the moved window keeps the share it had
in its old container, and the workspace level's shares aren't reset. The shares there then add up
to more than 100% and the windows overlap or run off-screen.

Found by the randomized stress test (09_fuzz.py, seed 303 on the real-size profile).

Also checks what the fix must not change: a window already at the edge of the workspace keeps
everyone's sizes, and a container emptied by the move doesn't leave a gap.

Uses a second monitor (to the right) for 14.3:
    SANDBOX_SECOND_MONITOR=1280x1024 sandbox/launch.sh && scenarios/14_move_out_shares.py
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


def new_window(known):
    h.open_editor()
    return next(w for w in h.windows() if w["id"] not in known)


def setup(container_last=False):
    """A | B at unequal shares, then C joins one of them in a container, also at unequal shares:
    HSPLIT[HSPLIT[A, C], B], or HSPLIT[B, HSPLIT[A, C]] with `container_last` (A is then the
    right-hand window). Returns (A, B, C)."""
    h.open_editor()
    h.open_editor()
    left, right = sorted(h.windows(), key=lambda w: w["x"])
    h.drag_edge(left["id"], "right", h.monitor_size()[0] // 8)
    a, b = (right, left) if container_last else (left, right)
    command(a["id"], '{name: "Split", orientation: "horizontal"}')
    c = new_window((a["id"], b["id"]))          # joins A's container, next to A
    h.drag_edge(a["id"], "right", -h.monitor_size()[0] // 16)
    return a, b, c


def finish(name, what, moved=None):
    ok = h.layout_check(name, what)
    if moved and moved["id"] not in [w["id"] for w in h.windows()]:
        print(f"  FAIL  {name} (monitor): the moved window left this monitor")
        ok = False
    print(f"          after: {h.tree_summary()}")
    h.close_windows()
    time.sleep(1.0)
    return ok


def move_out(name, direction):
    a, b, c = setup()
    print(f"before: {h.tree_summary()}")
    command(c["id"], f'{{name: "Move", direction: "{direction}"}}')
    return finish(name, f"move C {direction.lower()} out of its container: shares still add up, "
                        "no overlap or off-screen", moved=c)


def move_out_towards_monitor(name):
    """HSPLIT[B, HSPLIT[A, C]] with another monitor to the right: 'move right' on C takes it out
    of its container, onto this monitor's workspace level (Forge's MONITOR case)."""
    a, b, c = setup(container_last=True)
    print(f"before: {h.tree_summary()}")
    command(c["id"], '{name: "Move", direction: "Right"}')
    return finish(name, "move C right, out of its container towards the other monitor: shares add up",
                  moved=c)


def edge_keeps_shares(name):
    """Top-level A | B at custom sizes: 'move up' on A (nothing above it, and it's already at the
    workspace level) must leave both windows where they are, at their sizes."""
    h.open_editor()
    h.open_editor()
    a, b = sorted(h.windows(), key=lambda w: w["x"])
    h.drag_edge(a["id"], "right", h.monitor_size()[0] // 8)
    place = lambda: {w["id"] % 1000: (w["x"], w["w"]) for w in h.windows()}   # noqa: E731
    before = place()
    command(a["id"], '{name: "Move", direction: "Up"}')
    after = place()
    ok = before.keys() == after.keys() and all(
        abs(before[k][0] - after[k][0]) <= h.TOL and abs(before[k][1] - after[k][1]) <= h.TOL for k in before)
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: 'move up' on a window with nothing above keeps every place "
          f"(x, width): {before} -> {after}")
    h.close_windows()
    time.sleep(1.0)
    return ok


def emptied_container(name):
    """HSPLIT[HSPLIT[HSPLIT[W], X], Y], W and X at unequal shares: 'move up' on W empties W's
    container; X must take the whole of it, not leave W's share as a gap."""
    h.open_editor()
    h.open_editor()
    w, y = sorted(h.windows(), key=lambda v: v["x"])
    command(w["id"], '{name: "Split", orientation: "horizontal"}')
    x = new_window((w["id"], y["id"]))
    command(w["id"], '{name: "Split", orientation: "horizontal"}')
    h.drag_edge(w["id"], "right", -h.monitor_size()[0] // 16)
    print(f"before: {h.tree_summary()}")
    command(w["id"], '{name: "Move", direction: "Up"}')
    return finish(name, "move W up out of a nested container: no gap where it was", moved=w)


def main():
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    h.set_forge_setting("auto-split-enabled", False)   # new windows join the focused window's split
    h.set_forge_setting("move-pointer-focus-enabled", False)
    r = [move_out("14.1", "Up"), move_out("14.2", "Down")]
    if h.js("global.display.get_n_monitors()") >= 2:
        r.append(move_out_towards_monitor("14.3"))
    else:
        print("  SKIP  14.3: needs a second monitor to the right")
    r.append(edge_keeps_shares("14.4"))
    r.append(emptied_container("14.5"))
    sys.exit(h.summary(r))


main()
