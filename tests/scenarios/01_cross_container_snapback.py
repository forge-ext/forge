#!/usr/bin/env python3
"""continuous resize against a neighbour in a DIFFERENT container snaps back on release.

Layout: [A] + CON[B, C]. Resizing the B|C border (same container) is the control; resizing the
B|A border from B (different containers) is the bug. Covers mouse drags and a held shortcut
(the keyboard form is forge issue #532).

Run on a fresh sandbox:  sandbox/launch.sh && scenarios/01_cross_container_snapback.py
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402


def drag(name, win, side, nb, delta):
    e, grabbed, _ = h.drag_edge(win["id"], side, delta)
    if not grabbed:
        print(f"  FAIL  {name}: no resize grab started")
        return False
    return h.settle_check(name, win["id"], side, nb["id"], e + delta)


def hold(name, win, side, nb, hold_ms=1000):
    log = h.hold_keys(win["id"], h.GROW_KEYS[side], hold_ms)
    rel = h.parse_line(next(l for l in log if "keys released" in l))
    w = rel[win["id"] % 1000]
    size_rel = w["w"] if side in h.HORIZONTAL else w["h"]
    ws = h.windows()
    now = h.find(ws, win["id"])
    size_now = now["w"] if side in h.HORIZONTAL else now["h"]
    ok_size = abs(size_now - size_rel) <= h.TOL
    print(f"  {'PASS' if ok_size else 'FAIL'}  {name}: {rel['calls']} key repeats; size at release "
          f"{size_rel:.0f}, settled {size_now}")
    return ok_size and h.settle_check(f"{name} (layout)", win["id"], side, nb["id"], h.edge(now, side))


def focus(win_id):
    h.js(f"(() => {{ const w = global.display.list_all_windows().find(w => w.get_id() === {win_id});"
         f" w.activate(global.get_current_time()); return 'ok'; }})()")
    time.sleep(0.4)


def command(action):
    h.js(f"(() => {{ {h.WM}.command({action}); return 'ok'; }})()")
    time.sleep(0.8)


def border(ws, a_id, b_id):
    a, b = h.find(ws, a_id), h.find(ws, b_id)
    return h.edge(a, h.neighbour_side(a, b))


def taps(name, win, side, nb, n=3, amount=15):
    """AC6: separate short taps still move the edge one step each and persist."""
    e0 = h.edge(h.find(h.windows(), win["id"]), side)
    for _ in range(n):
        h.hold_keys(win["id"], h.GROW_KEYS[side], 0)
    sign = -1 if side in ("left", "top") else 1
    return h.settle_check(name, win["id"], side, nb["id"], e0 + sign * n * amount)


def persistence(name, a, b, c):
    """AC5: the resized border survives tabbed on/off and opening+closing another window."""
    before = border(h.windows(), b["id"], a["id"])
    focus(b["id"])
    command('{ name: "LayoutTabbedToggle" }')
    command('{ name: "LayoutTabbedToggle" }')
    focus(c["id"])
    ids = {w["id"] for w in h.windows()}
    h.open_editor()
    new = next(w["id"] for w in h.windows() if w["id"] not in ids)
    h.js(f"(() => {{ global.display.list_all_windows().find(w => w.get_id() === {new}).delete(global.get_current_time()); return 'ok'; }})()")
    time.sleep(1.5)
    after = border(h.windows(), b["id"], a["id"])
    ok = abs(after - before) <= h.TOL
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: A|CON border {before} -> {after} after tabbed toggle x2 + open/close window")
    return ok


def deeper(name, a):
    """AC3: a window two containers deep (CON > CON2 > X) resized against A at the top level.
    Returns (ok, new_window)."""
    ws = h.windows()
    candidates = []
    for w in ws:
        if w["depth"] >= 1:
            try:
                candidates.append((w, h.neighbour_side(w, h.find(ws, a["id"]))))
            except ValueError:
                pass
    if not candidates:
        print(f"  FAIL  {name}: no container window borders A")
        return False, None
    x, _ = candidates[0]
    focus(x["id"])
    ids = {w["id"] for w in h.windows()}
    h.open_editor()
    ws = h.windows()
    d = next(w for w in ws if w["id"] not in ids)
    deep = [w for w in ws if w["depth"] >= 2]
    target = None
    for w in deep:
        try:
            target = (w, h.neighbour_side(w, h.find(ws, a["id"])))
            break
        except ValueError:
            pass
    if not target:
        print(f"  FAIL  {name}: no depth-2 window borders A (depths: {[(w['id'] % 1000, w['depth']) for w in ws]})")
        return False, d
    t, side = target
    # Move the edge AWAY from A (A grows) so no window is pushed below its minimum size;
    # minimum-size behaviour is covered by its own scenario.
    delta = 120 if side in ("left", "top") else -120
    e, grabbed, _ = h.drag_edge(t["id"], side, delta)
    if not grabbed:
        print(f"  FAIL  {name}: no resize grab started")
        return False, d
    print(f"  (target {t['id'] % 1000} at depth {t['depth']}, {side} edge vs A)")
    return h.settle_check(name, t["id"], side, a["id"], e + delta), d


def floating(name, win):
    """AC6: floating windows resize freely and don't disturb the tiled layout."""
    focus(win["id"])
    command('{ name: "FloatToggle", mode: "float", x: "center", y: "center", width: 0.5, height: 0.5 }')
    tiled_before = {w["id"]: (w["x"], w["y"], w["w"], w["h"]) for w in h.windows() if w["id"] != win["id"]}
    f = h.js(f"(() => {{ const r = global.display.list_all_windows().find(w => w.get_id() === {win['id']}).get_frame_rect(); return JSON.stringify([r.x, r.y, r.width, r.height]); }})()")
    x, y, w, hh = json.loads(f)
    log = h.run_js_file("drag.js", {"__X0__": x + w + 1, "__Y0__": y + hh // 2, "__DX__": 100, "__DY__": 0,
                                    "__STEPS__": 10, "__STEP_MS__": 40}, "__drag")
    time.sleep(1.0)
    f2 = json.loads(h.js(f"(() => {{ const r = global.display.list_all_windows().find(w => w.get_id() === {win['id']}).get_frame_rect(); return JSON.stringify([r.x, r.y, r.width, r.height]); }})()"))
    tiled_after = {w["id"]: (w["x"], w["y"], w["w"], w["h"]) for w in h.windows() if w["id"] != win["id"]}
    grew = abs((f2[2] - w) - 100) <= h.TOL
    same = tiled_before == tiled_after
    ok = grew and same and any("grab-op-begin" in l for l in log)
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: floating width {w} -> {f2[2]} (+100 expected); tiled windows unchanged: {same}")
    command('{ name: "FloatToggle", mode: "float", x: "center", y: "center", width: 0.5, height: 0.5 }')
    return ok


def main():
    a, b, c = h.nested_layout()
    print(f"layout: A={a['id'] % 1000} (top level) + CON {b['playout']}[B={b['id'] % 1000}, C={c['id'] % 1000}]")
    ws = h.windows()
    s_bc = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, c["id"]))
    s_ba = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, a["id"]))
    grow_ba = -150 if s_ba in ("left", "top") else 150
    shrink_bc = -60 if s_bc in ("right", "bottom") else 60

    r = []
    print("control: mouse drag, neighbour in the SAME container (B|C)")
    r.append(drag("1.1", b, s_bc, c, shrink_bc))
    r.append(drag("1.2", b, s_bc, c, -shrink_bc * 4 // 3))
    print("bug: mouse drag, neighbour in a DIFFERENT container (B|A)")
    r.append(drag("1.3", b, s_ba, a, grow_ba))
    r.append(drag("1.4", b, s_ba, a, -grow_ba // 2))
    print("control: held grow shortcut, SAME container (B toward C)")
    # 500 ms stays within the room C has above its minimum height; a longer hold would (correctly,
    # since the fix scenario 03 checks) stop at C's minimum and no longer measure what this test is about.
    r.append(hold("1.5", b, s_bc, c, 500))
    print("bug (#532): held grow shortcut, DIFFERENT container (B toward A)")
    r.append(hold("1.6", b, s_ba, a))
    print("no regression: separate taps, DIFFERENT container (B toward A)")
    r.append(taps("1.7", b, s_ba, a))
    print("persistence: tabbed toggle + open/close another window")
    r.append(persistence("1.8", a, b, c))
    print("deeper nesting: C inside CON2 inside CON, resized against A")
    ok9, d = deeper("1.9", a)
    r.append(ok9)
    if d:
        print("no regression: floating window resize")
        r.append(floating("1.10", d))
    sys.exit(h.summary(r))


main()
