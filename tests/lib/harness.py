"""Shared helpers for driving the nested sandbox gnome-shell (see sandbox/launch.sh).

All calls go to the sandbox's private D-Bus bus. Input is injected with Clutter virtual devices
created *inside* the nested shell, so nothing reaches the host session.
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import time

import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "lib")
SANDBOX_DIR = os.environ.get("SANDBOX_DIR") or os.path.join(
    os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache"), "forge-sandbox", "sandbox")

# Real-session mode (FORGE_TEST_REAL_SESSION=1): talk to the GNOME Shell of the session you are logged
# into, instead of a sandbox. It only works while that shell is in unsafe mode, a security trade-off,
# so it is not used by these tests; see forge-repro's realsession/ for a runner that enables it.
REAL_SESSION = os.environ.get("FORGE_TEST_REAL_SESSION") == "1"

TOL = 10      # px allowed between an edge's position at release and where it settles
GAP_TOL = 4   # px allowed between the space between two windows and Forge's gap
WM = 'Main.extensionManager.lookup("forge@jmmaranan.com").stateObj.extWm'
# Forge's tree node for monitor 0 on the active workspace. Everything the harness inspects or
# changes is limited to it, so windows on other workspaces are never counted or touched.
HERE = WM + '.tree.findNode(`mo0ws${global.workspace_manager.get_active_workspace_index()}`)'

_bus = None


def bus():
    global _bus
    if _bus is None and REAL_SESSION:
        _bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    if _bus is None:
        addr = open(os.path.join(SANDBOX_DIR, "bus-address")).read().strip()
        if not addr.startswith("unix:path=/tmp/dbus-"):
            raise SystemExit(f"refusing: {addr!r} is not a private dbus-run-session bus")
        _bus = Gio.DBusConnection.new_for_address_sync(
            addr, Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION,
            None, None)
    return _bus


def js_raw(code):
    return bus().call_sync("org.gnome.Shell", "/org/gnome/Shell", "org.gnome.Shell", "Eval",
                           GLib.Variant("(s)", (code,)), GLib.VariantType("(bs)"),
                           Gio.DBusCallFlags.NONE, 20000, None).unpack()


def js(code):
    ok, out = js_raw(code)
    if not ok:
        raise RuntimeError(out)
    return json.loads(out) if out else None


def windows():
    """Tiled windows on monitor 0 with frame geometry, node percent and parent info."""
    return json.loads(js(f"""JSON.stringify(({HERE}?.getNodeByType("WINDOW") ?? [])
        .map(n => {{
            const f = n.nodeValue.get_frame_rect();
            return {{ id: n.nodeValue.get_id(), x: f.x, y: f.y, w: f.width, h: f.height, float: n.isFloat(),
                      percent: n.percent ?? 0, playout: n.parentNode.layout,
                      pid: n.parentNode.nodeType === "CON" ? "con" : "top",
                      depth: (() => {{ let d = 0; for (let p = n.parentNode; p; p = p.parentNode) if (p.nodeType === "CON") d++; return d; }})() }}; }}))"""))


def park_pointer():
    """Move the sandbox pointer to the centre of monitor 0 so new windows open there."""
    js("""(() => { const r = global.display.get_monitor_geometry(0);
        const d = global.stage.context.get_backend().get_default_seat().create_virtual_device(0);
        d.notify_absolute_motion(GLib.get_monotonic_time(), r.x + r.width / 2, r.y + r.height / 2);
        return "ok"; })()""")


def open_app(*argv, timeout=10, log=None):
    """Open an app inside the sandbox and wait until Forge tiles its window.
    `log`: file for the app's output (default: discarded)."""
    park_pointer()
    before = len(windows())
    out = open(log, "a") if log else subprocess.DEVNULL
    launcher = [] if REAL_SESSION else [os.path.join(ROOT, "sandbox", "run-in-sandbox.sh")]
    subprocess.Popen([*launcher, *argv],
                     stdout=out, stderr=out, stdin=subprocess.DEVNULL, start_new_session=True)
    for _ in range(int(timeout * 4)):
        time.sleep(0.25)
        if len(windows()) > before:
            time.sleep(1.0)
            return
    # Say what is on screen instead (e.g. an app's error or "already running" dialog)
    shown = js("""JSON.stringify(global.display.list_all_windows().map(w => `${w.get_wm_class()}: ${w.get_title()}`))""")
    raise RuntimeError(f"{argv[0]} window did not appear within {timeout} s; windows: {shown}")


def open_editor():
    open_app("gnome-text-editor", "--standalone")


def run_js_file(name, subs, flag, during=None):
    code = open(os.path.join(LIB, name)).read()
    for k, v in subs.items():
        code = code.replace(k, str(v))
    js(code)
    if during:
        during()                 # runs while the timeline is in progress
    for _ in range(160):
        time.sleep(0.25)
        if js(f"String(globalThis.{flag}?.done)") == "true":
            log = json.loads(js(f"JSON.stringify(globalThis.{flag}.log)"))
            errors = [l for l in log if l.startswith("ERROR ")]
            if errors:
                raise RuntimeError(f"{name}: {errors[0][6:]}")
            return log
    raise RuntimeError(f"{name} did not finish")


def find(ws, wid):
    return next(w for w in ws if w["id"] == wid)


def edge(win, side):
    return {"left": win["x"], "right": win["x"] + win["w"], "top": win["y"], "bottom": win["y"] + win["h"]}[side]


OPP = {"left": "right", "right": "left", "top": "bottom", "bottom": "top"}
HORIZONTAL = {"left", "right"}


def neighbour_side(a, b):
    """Side of window a that faces window b (they must share a border)."""
    for side in ("left", "right", "top", "bottom"):
        if abs(edge(a, side) - edge(b, OPP[side])) < 24:
            return side
    raise ValueError("windows are not adjacent")


def js_error_entries():
    """The Forge JS ERROR entries in the sandbox log (message + stack), as text blocks."""
    try:
        if REAL_SESSION:   # the session's journal since the run started
            lines = subprocess.run(["journalctl", "--user", "-o", "cat", "--since",
                                    "@" + os.environ["FORGE_TEST_SINCE"]],
                                   capture_output=True, text=True).stdout.splitlines()
        else:
            lines = open(os.path.join(SANDBOX_DIR, "nested.log"), errors="replace").read().splitlines()
    except FileNotFoundError:
        return []
    entries = []
    for i, line in enumerate(lines):
        if "JS ERROR" in line and any("forge@" in l for l in lines[i:i + 12]):
            block = [line] + [l for l in lines[i + 1:i + 12] if "@" in l and ".js:" in l]
            entries.append("\n".join(block))
    return entries


def js_errors():
    """Number of Forge exceptions in the sandbox log: JS ERROR entries whose message or stack
    trace mentions Forge (other extensions, e.g. the Ubuntu desktop icons, log their own)."""
    return len(js_error_entries())


def gap():
    """The space Forge leaves between two tiled neighbours: twice its window gap (each window is
    inset by the gap), from the sandbox's Forge settings."""
    return 2 * int(js(f"""(() => {{ const s = {WM}.ext.settings;
        return s.get_uint("window-gap-size") * s.get_uint("window-gap-size-increment"); }})()"""))


def settle_check(name, moved_id, side, nb_id, expect_edge, tol=TOL, gap=None):
    """PASS if the moved edge settled near expect_edge and the neighbour sits one gap away
    (`gap`: default Forge's current gap, see gap())."""
    time.sleep(1.0)
    gap = globals()["gap"]() if gap is None else gap
    ws = windows()
    m, n = find(ws, moved_id), find(ws, nb_id)
    got = edge(m, side)
    space = abs(edge(n, OPP[side]) - got)
    ok = abs(got - expect_edge) <= tol and abs(space - gap) <= GAP_TOL
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: {side} edge expected ~{expect_edge}, settled {got}; "
          f"gap to neighbour {space}px")
    return ok


def drag_edge(win_id, side, delta, steps=20, step_ms=40, during=None):
    """Press just outside `side` of the window (in the gap) and drag `delta` px across it.
    `during`: optional function run while the drag is in progress (e.g. a screenshot).
    Waits for the layout to settle first, so the press lands on the edge where it really is.
    Returns (edge_before, grabbed: bool, log)."""
    settle()
    w = find(windows(), win_id)
    e = edge(w, side)
    off = 1 if side in ("right", "bottom") else -1
    if side in HORIZONTAL:
        x, y, dx, dy = e + off, w["y"] + w["h"] // 2, delta, 0
    else:
        x, y, dx, dy = w["x"] + w["w"] // 2, e + off, 0, delta
    log = run_js_file("drag.js", {"__X0__": x, "__Y0__": y, "__DX__": dx, "__DY__": dy,
                                  "__STEPS__": steps, "__STEP_MS__": step_ms}, "__drag", during)
    return e, any("grab-op-begin" in l for l in log), log


MODIFIER_KEYVALS = [("CONTROL_MASK", 0xffe3), ("SHIFT_MASK", 0xffe1), ("MOD1_MASK", 0xffe9),
                    ("SUPER_MASK", 0xffeb), ("MOD4_MASK", 0xffeb)]


def chord(binding):
    """Keyvals ("0xffe3, 0xffeb, 0x6f") for Forge's keybinding setting `binding` (its first
    accelerator), e.g. chord("window-resize-right-increase") -> Ctrl+Super+O by default."""
    gi.require_version("Gdk", "3.0")
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gdk, Gtk
    accel = js(f"""{WM}.ext.kbdSettings.get_strv("{binding}")[0] ?? "" """)
    if not accel:
        raise RuntimeError(f"Forge keybinding {binding} is not set")
    key, mods = Gtk.accelerator_parse(accel)
    keyvals = []
    for name, keyval in MODIFIER_KEYVALS:
        if mods & getattr(Gdk.ModifierType, name) and keyval not in keyvals:
            keyvals.append(keyval)
    return ", ".join(hex(k) for k in keyvals + [key])


class _GrowKeys(dict):
    """GROW_KEYS[side]: the chord that grows `side` of the focused window (from the settings)."""
    def __missing__(self, side):
        self[side] = chord(f"window-resize-{side}-increase")
        return self[side]


class _ShrinkKeys(dict):
    def __missing__(self, side):
        self[side] = chord(f"window-resize-{side}-decrease")
        return self[side]


GROW_KEYS = _GrowKeys()
SHRINK_KEYS = _ShrinkKeys()


def work_area():
    """(x, y, width, height) of monitor 0's work area (the screen minus panels and docks)."""
    return tuple(js("""(() => { const a = global.workspace_manager.get_active_workspace()
        .get_work_area_for_monitor(0); return [a.x, a.y, a.width, a.height]; })()"""))


def monitor_size():
    """(width, height) of monitor 0's work area."""
    return work_area()[2:]


def hold_keys(win_id, keys, hold_ms=1000, during=None):
    """Focus a window and hold a key chord with a virtual keyboard (real key repeat).
    `during`: optional function run while the key is held (e.g. stall_app()).
    Returns the timeline log (each line has per-window x,y,w,h,p and resize() call count)."""
    return run_js_file("holdkey.js", {"__WIN__": win_id % 1000, "__KEYS__": keys, "__HOLD_MS__": hold_ms},
                       "__hk", during)


def stall_app(win_id, after_s, for_s):
    """Returns a function for hold_keys(during=...): after `after_s` s, freeze the window's app
    (SIGSTOP) for `for_s` s. The app then stops drawing, like a busy or slow app, while GNOME and
    Forge keep going: resize requests pile up until it continues (SIGCONT)."""
    pid = int(js(f"global.display.list_all_windows().find(w => w.get_id() === {win_id}).get_pid()"))
    # Only ever signal one real process of ours, and never this script's own process group:
    # get_pid() can be 0 or -1 when the pid is unknown, and kill() treats those as groups.
    if pid <= 1 or pid == os.getpid() or os.getpgid(pid) == os.getpgid(0):
        raise RuntimeError(f"stall_app: window {win_id} has no usable pid ({pid})")

    def resume(*_):
        try:
            os.kill(pid, signal.SIGCONT)
        except ProcessLookupError:
            pass

    def stall():
        time.sleep(after_s)
        # If this script is stopped (timeout, Ctrl+C) while the app is frozen, still resume it
        old = {s: signal.signal(s, lambda *a: (resume(), sys.exit(1))) for s in (signal.SIGTERM, signal.SIGINT)}
        os.kill(pid, signal.SIGSTOP)
        try:
            time.sleep(for_s)
        finally:
            resume()
            for s, handler in old.items():
                signal.signal(s, handler)
    return stall


def parse_line(line):
    """Parse a timeline line into {id%1000: dict(x,y,w,h,p)} plus 'calls'."""
    out = {}
    if "calls=" in line:
        out["calls"] = int(line.split("calls=")[1].split()[0])
    for tok in line.split(" | ")[1:]:
        if ":" in tok and "=" in tok and not tok.startswith("CON"):
            wid, kv = tok.split(":", 1)
            out[int(wid)] = {k: float(v) for k, v in (p.split("=") for p in kv.split(","))}
    return out


def nested_layout(openers=(open_editor, open_editor, open_editor)):
    """Open 3 windows => Forge builds [A] + CON[B, C] on monitor 0. Returns (A, B, C)."""
    if windows():
        raise SystemExit("sandbox must be fresh (no windows); run sandbox/launch.sh first")
    for opener in openers:
        opener()
    ws = windows()
    con = [w for w in ws if w["pid"] == "con"]
    top = [w for w in ws if w["pid"] == "top"]
    assert len(con) == 2 and len(top) == 1, f"unexpected layout: {ws}"
    horiz = con[0]["playout"] == "HSPLIT"
    b, c = sorted(con, key=lambda w: w["x"] if horiz else w["y"])
    return top[0], b, c


def summary(results):
    """Print the result line and return the exit status: 0 only if every check passed and Forge
    logged no JS errors."""
    errs = js_errors()
    print(f"sandbox JS errors: {errs}")
    print(f"RESULT: {sum(results)}/{len(results)} passed" + (f", {errs} Forge JS errors" if errs else ""))
    return 0 if all(results) and errs == 0 else 1


SKIP = 77    # exit status of a skipped scenario (run-suite.sh reports it as skipped, not failed)


def require(apps=(), setting=None):
    """Skip the scenario (exit 77) unless these apps are installed and this Forge build has
    `setting`. Call it at the start of main()."""
    missing = [a for a in apps if not shutil.which(a)]
    if setting and js(f"""{WM}.ext.settings.settings_schema.has_key("{setting}")""") is not True:
        missing.append(f"Forge setting {setting} (not in this build)")
    if missing:
        print(f"SKIP: needs {', '.join(missing)}")
        print(f"RESULT: skipped (needs {', '.join(missing)})")
        sys.exit(SKIP)


def layout_problems():
    """Check the tiled layout on monitor 0 and return a list of violations (empty = OK):
    windows inside the work area, no overlapping windows, each window at the size Forge laid it
    out at (it isn't when that is below the app's minimum), windows at or above the minimum size
    their app allows, and each container's percents in (0, 1] summing to 1."""
    return json.loads(js(f"""(() => {{
        const wm = {WM};
        const area = global.workspace_manager.get_active_workspace().get_work_area_for_monitor(0);
        const probs = [];
        const nodes = ({HERE}?.getNodeByType("WINDOW") ?? []).filter(n => !n.isFloat() && !n.nodeValue.minimized);   // Forge doesn't tile minimized windows
        const tag = (n) => n.nodeValue.get_id() % 1000;
        const frames = nodes.map(n => [n, n.nodeValue.get_frame_rect()]);
        for (const [n, f] of frames) {{
            if (f.x < area.x - 1 || f.y < area.y - 1 || f.x + f.width > area.x + area.width + 1 ||
                f.y + f.height > area.y + area.height + 1)
                probs.push(`${{tag(n)}} outside the work area: x=${{f.x}} y=${{f.y}} w=${{f.width}} h=${{f.height}}`);
            const rr = n.renderRect;
            if (rr && (Math.abs(rr.width - f.width) > 2 || Math.abs(rr.height - f.height) > 2))
                probs.push(`${{tag(n)}} is ${{f.width}}x${{f.height}} but was laid out at ${{rr.width}}x${{rr.height}}`);
            const [has, mw, mh] = n.nodeValue.get_min_size();
            if (has) {{
                const r = n.nodeValue.get_frame_rect(); r.width = mw; r.height = mh;
                const m = n.nodeValue.client_rect_to_frame_rect(r);
                if (f.width < m.width - 1 || f.height < m.height - 1)
                    probs.push(`${{tag(n)}} below its minimum ${{m.width}}x${{m.height}}: ${{f.width}}x${{f.height}}`);
            }}
        }}
        for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {{
            const [a, fa] = frames[i], [b, fb] = frames[j];
            const ox = Math.min(fa.x + fa.width, fb.x + fb.width) - Math.max(fa.x, fb.x);
            const oy = Math.min(fa.y + fa.height, fb.y + fb.height) - Math.max(fa.y, fb.y);
            // windows in the same tabbed/stacked container share its area by design
            const group = (n) => {{ for (let p = n.parentNode; p; p = p.parentNode)
                if (p.layout === "TABBED" || p.layout === "STACKED") return p; return null; }};
            if (group(a) && group(a) === group(b)) continue;
            if (ox > 2 && oy > 2) probs.push(`${{tag(a)}} and ${{tag(b)}} overlap by ${{ox}}x${{oy}}`);
        }}
        const parents = new Set(nodes.map(n => n.parentNode));
        for (const n of nodes) for (let p = n.parentNode; p && p.nodeType !== "ROOT"; p = p.parentNode) parents.add(p);
        for (const p of parents) {{
            if (!p || !(p.layout === "HSPLIT" || p.layout === "VSPLIT")) continue;
            const kids = wm.tree.getTiledChildren(p.childNodes);
            if (kids.length < 2) continue;
            const pcts = kids.map(k => k.percent ?? 0);
            if (pcts.some(v => v <= 0)) continue;   // unset percents = equal split
            if (pcts.some(v => v > 1)) probs.push(`${{p.layout}} child percent over 100%: ${{pcts.map(v => v.toFixed(3))}}`);
            const sum = pcts.reduce((s, v) => s + v, 0);
            if (Math.abs(sum - 1) > 0.02) probs.push(`${{p.layout}} percents sum to ${{sum.toFixed(3)}}: ${{pcts.map(v => v.toFixed(3))}}`);
        }}
        return JSON.stringify(probs); }})()"""))


def reset_layout():
    """Back to an equal split everywhere on monitor 0 and re-render."""
    js(f"""(() => {{ const wm = {WM};
        const here = {HERE};
        if (!here) return "ok";
        here.getNodeByType("WINDOW").forEach(n => wm.tree.resetSiblingPercent(n.parentNode));
        here.getNodeByType("CON").forEach(n => wm.tree.resetSiblingPercent(n.parentNode));
        wm.renderTree("test-reset"); return "ok"; }})()""")
    time.sleep(0.5)
    settle()


def layout_check(name, what):
    """PASS if layout_problems() is empty after the layout has settled."""
    time.sleep(1.5)
    probs = layout_problems()
    print(f"  {'PASS' if not probs else 'FAIL'}  {name}: {what}")
    for p in probs:
        print(f"          - {p}")
    return not probs


def set_forge_setting(key, value):
    """Set a Forge setting inside the sandbox. Returns False if this Forge build has no such key
    (setting an unknown GSettings key would abort the shell, so this checks first)."""
    kind = "boolean" if isinstance(value, bool) else "uint" if isinstance(value, int) else "string"
    return js(f"""(() => {{ const s = {WM}.ext.settings;
        if (!s.settings_schema.has_key("{key}")) return false;
        s.set_{kind}("{key}", {json.dumps(value)}); return true; }})()""")


def tree_summary():
    """Monitor 0's tiling tree as a compact string, e.g. HSPLIT[w12, TABBED[w13, w14]]."""
    return js(f"""(() => {{ const wm = {WM};
        const mon = {HERE};
        const fmt = (n) => n.nodeType === "WINDOW" ? `w${{n.nodeValue.get_id() % 1000}}`
            : `${{n.layout}}[${{n.childNodes.map(fmt).join(", ")}}]`;
        return mon && mon.childNodes.length ? fmt(mon) : "(no windows)"; }})()""")


def timeline_problems(log, tol=30, ignore=None):
    """Check every sample of a hold_keys()/drag_edge() timeline: windows must not overlap each
    other or leave the work area by more than `tol` px while the input is still going on.
    (`tol` allows for Wayland showing a new position a frame or two before the new size.)
    `ignore`: a window id whose own position is not checked, i.e. the window being dragged with
    the mouse, which follows the pointer (GNOME owns it until the button is released)."""
    area = js("""(() => { const a = global.workspace_manager.get_active_workspace().get_work_area_for_monitor(0);
        return [a.x, a.y, a.width, a.height]; })()""")
    ax, ay, aw, ah = area
    worst = {}
    for line in log:
        wins = {k: v for k, v in parse_line(line).items() if k != "calls" and k != (ignore or 0) % 1000}
        tag = line.split(" | ")[0][:40]
        for wid, w in wins.items():
            out = max(ax - w["x"], ay - w["y"], w["x"] + w["w"] - (ax + aw), w["y"] + w["h"] - (ay + ah))
            if out > tol and out > worst.get(("out", wid), (0, ""))[0]:
                worst[("out", wid)] = (out, tag)
        ids = sorted(wins)
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                wa, wb = wins[a], wins[b]
                if wa.get("g") and wa.get("g") == wb.get("g"):
                    continue         # same tabbed/stacked container: they share its area
                ox = min(wa["x"] + wa["w"], wb["x"] + wb["w"]) - max(wa["x"], wb["x"])
                oy = min(wa["y"] + wa["h"], wb["y"] + wb["h"]) - max(wa["y"], wb["y"])
                if ox > 2 and oy > 2 and min(ox, oy) > tol and min(ox, oy) > worst.get(("ov", a, b), (0, ""))[0]:
                    worst[("ov", a, b)] = (min(ox, oy), tag)
    probs = []
    for key, (px, tag) in worst.items():
        if key[0] == "out":
            probs.append(f"{key[1]} {px:.0f} px outside the work area ({tag})")
        else:
            probs.append(f"{key[1]} and {key[2]} overlap by {px:.0f} px ({tag})")
    return probs


def timeline_check(name, what, log, ignore=None):
    probs = timeline_problems(log, ignore=ignore)
    print(f"  {'PASS' if not probs else 'FAIL'}  {name}: {what}")
    for p in probs:
        print(f"          - {p}")
    if probs:
        # the trajectory of every window involved, for diagnosis
        ids = {int(t) for p in probs for t in p.replace("(", " ").split() if t.isdigit() and len(t) <= 3}
        for wid in sorted(ids):
            rows = []
            for line in log:
                w = parse_line(line).get(wid)
                if w:
                    rows.append(f"{line.split(' ')[0]}:{w['x']:.0f},{w['y']:.0f},{w['w']:.0f}x{w['h']:.0f}")
            print(f"          w{wid} (t:x,y,wxh): " + " ".join(rows))
    return not probs


def ensure_parent_layout(win_id, layout):
    """Make the container (or monitor) holding `win_id` use `layout` ("HSPLIT"/"VSPLIT"), with
    Forge's layout toggle. Forge's auto-split picks the direction from the window shape, so it
    differs between screen sizes; scenarios that need a direction set it with this."""
    for _ in range(2):
        if find(windows(), win_id)["playout"] == layout:
            return
        js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {win_id})
            .activate(global.get_current_time()); return "ok"; }})()""")
        time.sleep(0.4)
        js(f'(() => {{ {WM}.command({{name: "LayoutToggle"}}); return "ok"; }})()')
        time.sleep(1.0)
    got = find(windows(), win_id)["playout"]
    if got != layout:
        raise RuntimeError(f"could not set the layout of {win_id % 1000}'s container to {layout} (got {got})")


def close_windows():
    """Close the windows Forge manages on this workspace, on every monitor, one at a time (never
    the desktop-icons window or other windows Forge does not manage)."""
    def managed():
        return js(f"""JSON.stringify({WM}.tree.getNodeByType("WINDOW")
            .filter(n => n.nodeValue.get_workspace() === global.workspace_manager.get_active_workspace())
            .map(n => n.nodeValue.get_id()))""")
    while ids := json.loads(managed()):
        wid = ids[0]
        js(f"""(() => {{ global.display.list_all_windows().find(w => w.get_id() === {wid})
            ?.delete(global.get_current_time()); return "ok"; }})()""")
        for _ in range(40):
            time.sleep(0.25)
            if wid not in json.loads(managed()):
                break
        else:
            raise RuntimeError(f"window {wid % 1000} did not close")
        time.sleep(0.3)
    park_pointer()


def settle(max_s=3.0):
    """Wait until the layout on this workspace stops changing (checked every 0.3 s, at most
    `max_s`). Use before acting on window positions after something that re-lays out."""
    prev = None
    for _ in range(int(max_s / 0.3)):
        time.sleep(0.3)
        cur = [(w["id"], w["x"], w["y"], w["w"], w["h"]) for w in windows()]
        if cur == prev:
            return
        prev = cur
