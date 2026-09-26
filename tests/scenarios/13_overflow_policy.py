#!/usr/bin/env python3
"""Proposal (not a bug fix): what happens when tiled windows can't all get their minimum size.

With more windows than fit at their minimum size (e.g. 6 Text Editors side by side need
6 x 368 px > 1904 px on 1920x1080), today they overlap and extend off-screen. The proposed setting
`min-size-overflow` = tabbed / stacked groups windows until the rest fit. On builds without the
setting the tabbed/stacked checks fail by design; 13.4 checks that the default keeps today's
behaviour. Branch: feat/min-size-overflow (see the design proposal before relying on it).

Run on a fresh sandbox:  sandbox/launch.sh && scenarios/13_overflow_policy.py
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


EDITOR_MIN = (360, 200)   # GNOME Text Editor's minimum frame size (get_min_size() minus shadows)


def overflow_count(vertical):
    """One more editor than fits at its minimum size (plus 8 px of gaps) on this screen."""
    width, height = h.monitor_size()
    return (height // (EDITOR_MIN[1] + 8) if vertical else width // (EDITOR_MIN[0] + 8)) + 1


def overflow(name, policy, split=None):
    """Open one more editor than fits side by side (or stacked vertically with split)."""
    close_all()
    h.set_forge_setting("window-gap-size-increment", 1)
    ok_key = h.set_forge_setting("min-size-overflow", policy)
    h.open_editor()
    if split:
        h.js(f'(() => {{ {WM}.command({{name: "Split", orientation: "{split}"}}); return "ok"; }})()')
        time.sleep(0.5)
    count = overflow_count(vertical=bool(split))
    for _ in range(count - 1):
        h.open_editor()
    what = f"{count} windows {'in a vertical container' if split else 'side by side'}, min-size-overflow={policy}"
    if not ok_key:
        print(f"  FAIL  {name}: {what}: this Forge build has no min-size-overflow setting")
        ok = h.layout_check(name + " (layout)", f"{count} windows with no overflow handling")
        return False
    ok = h.layout_check(name, what)
    print(f"          tree: {h.tree_summary()}")
    return ok


def main():
    if h.windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    h.require(setting="min-size-overflow")    # a proposal: only its branch has the setting
    h.set_forge_setting("auto-split-enabled", False)   # new windows join the focused window's split
    r = []
    print("more windows than fit at their minimum size")
    r.append(overflow("13.1", "tabbed"))
    r.append(overflow("13.2", "stacked"))
    r.append(overflow("13.3", "tabbed", split="vertical"))
    print("control: default policy keeps today's behaviour (windows overlap), no errors")
    close_all()
    h.set_forge_setting("min-size-overflow", "overlap")
    for _ in range(overflow_count(vertical=False)):
        h.open_editor()
    probs = h.layout_problems()
    print(f"  {'PASS' if probs else 'FAIL'}  13.4: overlap policy leaves the overflow as it is "
          f"({len(probs)} layout problems, expected > 0)")
    r.append(bool(probs))
    sys.exit(h.summary(r))


main()
