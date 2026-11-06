#!/usr/bin/env python3
"""Randomized stress test: random actions, and the layout rules checked after every one.

Each step is one random action a user could take: open or close a window, focus, a Forge
shortcut (split, layout toggles, tabbed/stacked, move, swap, float, gaps, ...), a held resize
shortcut, or a mouse drag of a window edge. After every step the layout must be valid
(harness.layout_problems()), held keys and drags must not overlap or leave the screen while in
progress (harness.timeline_problems()), and Forge must not log a JS ERROR. The first failure
stops the run and prints the seed and the steps so far, so it can be replayed exactly.

    sandbox/launch.sh && scenarios/09_fuzz.py [--seed N|random] [--steps N]
"""
import argparse
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

SIDES = ["left", "right", "top", "bottom"]
DIRS = ["left", "right", "up", "down"]
# Forge shortcuts the fuzzer presses. Left out: ones that turn tiling off or open other UI
# (prefs-open, prefs-tiling-toggle, workspace-active-tile-toggle, window-toggle-always-float,
# window-snap-*), where the layout rules do not apply.
SHORTCUTS = (["con-split-layout-toggle", "con-split-horizontal", "con-split-vertical",
              "con-stacked-layout-toggle", "con-tabbed-layout-toggle",
              "con-tabbed-showtab-decoration-toggle", "focus-border-toggle",
              "window-gap-size-increase", "window-gap-size-decrease", "window-toggle-float",
              "window-swap-last-active"]
             + [f"window-{kind}-{d}" for kind in ("swap", "move", "focus") for d in DIRS])
MAX_WINDOWS = 7


def focus(win_id):
    h.js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {win_id})
        ?.activate(global.get_current_time()); return "ok"; }})()""")
    time.sleep(0.3)


def close(win_id):
    h.js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {win_id})
        ?.delete(global.get_current_time()); return "ok"; }})()""")
    time.sleep(1.0)


def tap(win_id, binding):
    try:
        keys = h.chord(binding)
    except RuntimeError:
        return None                      # shortcut not set in these settings
    return h.hold_keys(win_id, keys, 0)


class Fuzzer:
    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.seed = seed
        self.steps = []
        self.errors = h.js_errors()

    def pick_window(self):
        ws = sorted(h.windows(), key=lambda w: w["id"])
        return self.rng.choice(ws) if ws else None

    def step(self):
        """Do one random action. Returns (description, timeline log or None)."""
        ws = h.windows()
        roll = self.rng.random()
        if not ws or (roll < 0.15 and len(ws) < MAX_WINDOWS):
            h.open_editor()
            return "open a window", None
        win = self.pick_window()
        wid = win["id"]
        tag = f"w{wid % 1000}"
        if roll < 0.22 and len(ws) > 1:
            close(wid)
            return f"close {tag}", None
        if roll < 0.30:
            focus(wid)
            return f"focus {tag}", None
        if roll < 0.60:
            binding = self.rng.choice(SHORTCUTS)
            focus(wid)
            tap(wid, binding)
            # layout changes move several windows at once and each app redraws at its own pace,
            # so only the end state is checked (in-progress checks are for resizes and drags)
            return f"{binding} on {tag}", None
        if roll < 0.85:
            side = self.rng.choice(SIDES)
            kind = self.rng.choice(["increase", "decrease"])
            ms = self.rng.choice([0, 150, 400, 900, 2000])
            try:
                keys = h.chord(f"window-resize-{side}-{kind}")
            except RuntimeError:
                return f"(no shortcut for resize {side} {kind})", None
            log = h.hold_keys(wid, keys, ms)
            return f"{'tap' if ms == 0 else f'hold {ms} ms'} resize {side} {kind} on {tag}", log
        side = self.rng.choice(SIDES)
        delta = self.rng.choice([-400, -150, -40, 40, 150, 400])
        if win.get("float"):
            return f"(skip drag of floating {tag})", None
        # An edge on the screen edge has nothing to resize against, and the press point just
        # outside it is on a panel or dock (clicking the Ubuntu dock's icon minimizes the app)
        ax, ay, aw, ah = h.work_area()
        bound = {"left": ax, "top": ay, "right": ax + aw, "bottom": ay + ah}[side]
        if abs(h.edge(win, side) - bound) <= h.gap() + h.GAP_TOL:
            return f"(skip drag of {tag}'s {side} edge: it's on the screen edge)", None
        _, grabbed, log = h.drag_edge(wid, side, delta)
        # the window GNOME grabbed (edges coincide in stacked/tabbed groups, so it may be another)
        grab = next((l for l in log if "SIGNAL grab-op-begin" in l), "")
        self.dragged = int(grab.split("win=")[1].split()[0]) if "win=" in grab else wid
        return f"drag {tag}'s {side} edge {delta:+d} px", log if grabbed else None

    def check(self, log):
        probs = h.layout_problems()
        if log:
            floats = {w["id"] % 1000 for w in h.windows() if w.get("float")}
            probs += [p for p in h.timeline_problems(log, ignore=self.dragged)
                      if not any(p.startswith(f"{f} ") or f" {f} " in p for f in floats)]
        errors = h.js_errors()
        if errors > self.errors:
            for entry in h.js_error_entries()[self.errors:]:
                probs.append("Forge JS ERROR:\n            " + entry.replace("\n", "\n            "))
            self.errors = errors
        return probs

    def run(self, count):
        tree_js = open(os.path.join(h.LIB, "tree.js")).read()
        before = None
        for i in range(1, count + 1):
            self.dragged = None
            what, log = self.step()
            h.settle()
            self.steps.append(what)
            probs = self.check(log)
            print(f"  {'ok  ' if not probs else 'FAIL'} {i:3d}. {what}   {h.tree_summary()}", flush=True)
            if probs:
                for p in probs:
                    print(f"          - {p}")
                # Replays can diverge (focus and app timing), so show the full state around the failure
                print("\nForge's tree before this step:\n" + (before or "(none)"))
                print("\nForge's tree after it:\n" + h.js(tree_js))
                print(f"\nFAILED at step {i} (seed {self.seed}). Steps to reproduce:")
                for n, s in enumerate(self.steps, 1):
                    print(f"  {n:3d}. {s}")
                return False
            before = h.js(tree_js)
        return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", default="303",
                    help="replay a run (default 303, so suite runs are repeatable), or 'random' to explore")
    ap.add_argument("--steps", type=int, default=150)
    args = ap.parse_args()
    args.seed = int(time.time()) % 100000 if args.seed == "random" else int(args.seed)
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    # With more windows than fit, "overlap" (today's default) breaks the layout rules by design;
    # use tabbed where the build has the setting, else keep the window count low.
    global MAX_WINDOWS
    if not h.set_forge_setting("min-size-overflow", "tabbed"):
        MAX_WINDOWS = 4
    print(f"fuzz: seed {args.seed}, {args.steps} steps, up to {MAX_WINDOWS} windows")
    ok = Fuzzer(args.seed).run(args.steps)
    sys.exit(h.summary([ok]))


main()
