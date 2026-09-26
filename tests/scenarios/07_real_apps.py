#!/usr/bin/env python3
"""Real apps: the real-session checks with Ptyxis, Files (Nautilus) and VS Code.

Part 1 uses the layout Forge builds by itself (on a wide screen with auto-split:
HSPLIT[Ptyxis, HSPLIT[Files, VS Code]]; on 1920x1080: Files stacked over VS Code, the layout where
the original problems were seen); part 2 toggles the container to the other direction. Run on a fresh sandbox, ideally the one that mirrors this machine:
    SANDBOX_PROFILE=real sandbox/launch.sh && scenarios/07_real_apps.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

VSCODE_DIR = os.path.join(h.SANDBOX_DIR, "vscode")   # throwaway VS Code profile


def ptyxis():
    h.open_app("ptyxis", "--new-window")


def files():
    h.open_app("nautilus", "--new-window")


def vscode():
    # The VS Code snap forces --ozone-platform=x11, so it runs on the sandbox's Xwayland
    # (as it does in a normal session).
    display = h.js('GLib.getenv("DISPLAY")')
    xauth = h.js('GLib.getenv("XAUTHORITY")')
    h.open_app("env", f"DISPLAY={display}", f"XAUTHORITY={xauth}", "code", "--new-window",
               f"--user-data-dir={VSCODE_DIR}", "--skip-welcome", "--disable-workspace-trust", timeout=120,
               log=os.path.join(h.SANDBOX_DIR, "vscode.log"))


def toggle_container_layout(focus_id):
    h.js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {focus_id})
        .activate(global.get_current_time()); return "ok"; }})()""")
    time.sleep(0.4)
    h.js(f'(() => {{ {h.WM}.command({{name: "LayoutToggle"}}); return "ok"; }})()')
    time.sleep(1.0)


def size(win, side):
    return win["w"] if side in h.HORIZONTAL else win["h"]


def checks(prefix, a, b, c):
    """Checks 1, 2 and 4 on B's edge that faces A, with C (B's sibling) left alone."""
    ws = h.windows()
    side = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, a["id"]))
    print(f"layout: {h.tree_summary()}; Files faces Ptyxis on its {side}")
    r = []
    h.reset_layout()
    delta = -150 if side in ("left", "top") else 150
    before = h.edge(h.find(h.windows(), b["id"]), side)
    c0 = h.find(h.windows(), c["id"])
    _, grabbed, _ = h.drag_edge(b["id"], side, delta)
    r.append(grabbed and h.settle_check(f"{prefix}.1 check 1: drag Files|Ptyxis border", b["id"], side, a["id"], before + delta))
    c1 = h.find(h.windows(), c["id"])
    if c1["playout"] == ("HSPLIT" if side in h.HORIZONTAL else "VSPLIT"):
        # Files and VS Code split in the resize direction: VS Code must keep its size (scenario 08)
        ok = abs(size(c1, side) - size(c0, side)) <= h.TOL
        print(f"  {'PASS' if ok else 'FAIL'}  {prefix}.1 (VS Code keeps its size): {size(c0, side)} -> {size(c1, side)} px")
    else:
        # stacked across the resize direction: VS Code spans the container and follows the edge
        ok = abs(h.edge(c1, side) - h.edge(h.find(h.windows(), b["id"]), side)) <= h.TOL
        print(f"  {'PASS' if ok else 'FAIL'}  {prefix}.1 (VS Code follows the edge): VS Code {side} edge "
              f"{h.edge(c1, side)}, Files {h.edge(h.find(h.windows(), b['id']), side)}")
    r.append(ok)

    h.reset_layout()
    log = h.hold_keys(b["id"], h.GROW_KEYS[side], 1000)
    rel = h.parse_line(next(l for l in log if "keys released" in l))[b["id"] % 1000]
    time.sleep(1.2)
    now = h.find(h.windows(), b["id"])
    rel_size = rel["w"] if side in h.HORIZONTAL else rel["h"]
    ok = abs(size(now, side) - rel_size) <= h.TOL
    print(f"  {'PASS' if ok else 'FAIL'}  {prefix}.2 check 2: hold 'grow {side}' on Files 1 s: "
          f"{rel_size:.0f} at release, settled {size(now, side)}")
    r.append(ok)

    h.reset_layout()
    hold = int(1000 + 1.2 * max(h.monitor_size()))
    log = h.hold_keys(b["id"], h.GROW_KEYS[side], hold)
    r.append(h.layout_check(f"{prefix}.4 check 4: hold 'grow {side}' on Files {hold} ms", "stops at Ptyxis's minimum"))
    r.append(h.timeline_check(f"{prefix}.4 (while held)", "no overlap or off-screen while the key repeats", log))
    return r


def main():
    h.require(apps=("ptyxis", "nautilus", "code"))
    a, b, c = h.nested_layout((ptyxis, files, vscode))
    print(f"A=Ptyxis {a['id'] % 1000}, B=Files {b['id'] % 1000}, C=VS Code {c['id'] % 1000}")
    r = []
    print("part 1: the layout Forge builds by itself")
    r += checks("7", a, b, c)

    print("part 2: the container toggled to the other direction")
    toggle_container_layout(c["id"])
    r += checks("7v", a, b, c)
    if h.find(h.windows(), b["id"])["playout"] != "VSPLIT":
        toggle_container_layout(c["id"])    # check 3 needs Files stacked over VS Code
    h.reset_layout()
    ws = h.windows()
    side = h.neighbour_side(h.find(ws, b["id"]), h.find(ws, c["id"]))
    opp = h.OPP[side]
    log = h.hold_keys(b["id"], h.GROW_KEYS[side], 700)
    samples = [h.edge(w, opp) for w in (h.parse_line(l).get(b["id"] % 1000) for l in log) if w]
    worst = max(samples, key=lambda v: abs(v - samples[0]))
    ok = abs(worst - samples[0]) <= 30
    print(f"  {'PASS' if ok else 'FAIL'}  7v.3 check 3: hold 'grow {side}' on Files: its {opp} edge "
          f"{samples[0]:.0f} -> worst {worst:.0f} while held (must stay put)")
    r.append(ok)
    sys.exit(h.summary(r))


main()
