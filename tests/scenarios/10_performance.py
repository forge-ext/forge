#!/usr/bin/env python3
"""Performance: how much work Forge does per render and per live-resize tick.

Setup: 5 Text Editor windows on this workspace (nested layout) and 5 on workspace 2.
Workloads, each measured with lib/perf.js (timings of Forge's hot functions and a count of the
window move/resize requests it sends, by caller):
  render     30 re-renders (what every focus change, open, close, setting change triggers)
  drag       a 2 s mouse drag of a border between containers (the live-resize loop, 16 ms ticks)
  hold       a 2 s held resize shortcut

Every move/resize request makes the app redraw. During a live resize (a 16 ms loop) requests
for windows on another workspace, or for a window already at that exact geometry, are wasted:
  10.1  live-resize ticks only move windows on the current workspace
  10.2  live-resize ticks only re-send a window's place when it changed (at most one first
        request per window per resize)
  10.3  (info) requests per render; renders re-send every window's place on purpose
Timings are reported, not judged (they depend on the machine).

    sandbox/launch.sh && scenarios/10_performance.py [--json out.json]
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

PER_WORKSPACE = 5


def perf_start():
    h.js(open(os.path.join(h.LIB, "perf.js")).read())
    h.js("globalThis.__perf.start()")


def perf_stop():
    return json.loads(h.js("globalThis.__perf.stop()"))


def move_to_workspace(win_id, index):
    h.js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {win_id})
        .change_workspace_by_index({index}, false); return "ok"; }})()""")
    time.sleep(0.8)


def setup():
    # 5 windows on workspace 2 (index 1), then 5 here
    for _ in range(PER_WORKSPACE):
        before = {w["id"] for w in h.windows()}
        h.open_editor()
        new = [w["id"] for w in h.windows() if w["id"] not in before]
        move_to_workspace(new[0], 1)
    a, b, c = h.nested_layout()
    for _ in range(PER_WORKSPACE - 3):
        h.open_editor()
    time.sleep(1.0)
    return a, b, c


def summarize(name, report, ticks_label=None):
    t = report["timings"]
    moves = report["moves"]
    print(f"  {name}:")
    for label, s in sorted(t.items()):
        print(f"      {label:24s} {s['calls']:5d} calls  mean {s['mean_us']:6d} us  p95 {s['p95_us']:6d} us  max {s['max_us']:6d} us")
    for caller, m in sorted(moves.items()):
        per = ""
        if caller in t and t[caller]["calls"]:
            per = f"  ({m['calls'] / t[caller]['calls']:.1f} per call)"
        print(f"      moves from {caller:24s} {m['calls']:5d}{per}; other workspace {m['otherWorkspace']}, "
              f"already there {m['unchanged']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="write the raw report here")
    args = ap.parse_args()
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    a, b, c = setup()
    print(f"layout here: {h.tree_summary()} (+{PER_WORKSPACE} windows on workspace 2)")
    reports = {}

    perf_start()
    for _ in range(30):
        h.js(f'(() => {{ {h.WM}.renderTree("perf"); return "ok"; }})()')
        time.sleep(0.1)
    time.sleep(0.5)
    reports["render"] = perf_stop()

    ws = h.windows()
    side = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, a["id"]))
    perf_start()
    h.drag_edge(b["id"], side, -200 if side in ("left", "top") else 200, steps=40, step_ms=50)
    time.sleep(1.0)
    reports["drag"] = perf_stop()

    h.reset_layout()
    perf_start()
    h.hold_keys(b["id"], h.GROW_KEYS[side], 2000)
    time.sleep(1.0)
    reports["hold"] = perf_stop()

    for name, rep in reports.items():
        summarize(name, rep)
    if args.json:
        with open(args.json, "w") as f:
            json.dump(reports, f, indent=1)

    r = []
    missing = sorted({m for rep in reports.values() for m in rep.get("missing", [])})
    if missing:
        print(f"  info  this build has no {', '.join(missing)}: those parts aren't measured")
    if "wm._liveResizeNeighbors" in missing:
        # 10.1/10.2 count the live-resize loop's requests: without it they'd pass without measuring
        print("  FAIL  10.1/10.2: can't measure: this build has no live-resize loop (_liveResizeNeighbors)")
        sys.exit(h.summary([False]))
    other = sum(rep["moves"].get("wm._liveResizeNeighbors", {}).get("otherWorkspace", 0)
                for rep in (reports["drag"], reports["hold"]))
    ok = other == 0
    print(f"  {'PASS' if ok else 'FAIL'}  10.1: live-resize ticks moved windows on another workspace {other} times")
    r.append(ok)
    live = [rep["moves"].get("wm._liveResizeNeighbors", {}) for rep in (reports["drag"], reports["hold"])]
    redundant = sum(m.get("unchanged", 0) for m in live)
    allowed = 2 * len(h.windows())    # one first request per window, per drag/hold
    ok = redundant <= allowed
    print(f"  {'PASS' if ok else 'FAIL'}  10.2: live-resize requests to windows already in place: {redundant} "
          f"(at most {allowed}: one per window per resize)")
    r.append(ok)
    apply_moves = reports["render"]["moves"].get("tree.apply", {})
    renders = reports["render"]["timings"].get("tree.render", {}).get("calls", 0)
    print(f"  info  10.3: {renders} re-renders of an unchanged layout sent {apply_moves.get('calls', 0)} move "
          f"requests ({apply_moves.get('unchanged', 0)} to windows already there). Renders re-send every "
          f"window's place on purpose (they put windows back if anything moved them)")
    sys.exit(h.summary(r))


main()
