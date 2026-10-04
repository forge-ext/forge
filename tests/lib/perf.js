// Performance probes for the SANDBOX shell. Wraps Forge's hot functions to time them, and counts
// window moves/resizes (Meta.Window.move_resize_frame / move_frame), per caller and per workspace.
//   globalThis.__perf.start()   install the wrappers and reset the counters
//   globalThis.__perf.stop()    remove them, return the report
(() => {
  if (globalThis.__perf?.installed) globalThis.__perf.stop();
  const wm = Main.extensionManager.lookup("forge@jmmaranan.com").stateObj.extWm;
  const Meta = imports.gi.Meta;
  const now = () => GLib.get_monotonic_time();
  const st = {
    installed: false,
    wrapped: [],
    timings: {},
    moves: null,
    missing: [],
    current: null,
  };
  const record = (name, us) => (st.timings[name] ??= []).push(us);
  const wrap = (obj, name, label) => {
    const orig = obj[name];
    if (typeof orig !== "function") {
      st.missing.push(label);
      return;
    } // reported: not measured
    obj[name] = function (...args) {
      if (st.current === label) return orig.apply(this, args); // recursion: time the outer call only
      const prev = st.current;
      st.current = label;
      const t0 = now();
      try {
        return orig.apply(this, args);
      } finally {
        record(label, now() - t0);
        st.current = prev;
      }
    };
    st.wrapped.push([obj, name, orig]);
  };
  const countMoves = (name) => {
    const proto = Meta.Window.prototype;
    const orig = proto[name];
    proto[name] = function (...args) {
      const caller = st.current ?? "other";
      const c = (st.moves[caller] ??= { calls: 0, otherWorkspace: 0, unchanged: 0 });
      c.calls++;
      if (this.get_workspace() !== global.workspace_manager.get_active_workspace())
        c.otherWorkspace++;
      if (name === "move_resize_frame") {
        const f = this.get_frame_rect();
        const [, x, y, w, h] = args;
        if (f.x === x && f.y === y && f.width === w && f.height === h) c.unchanged++;
      }
      return orig.apply(this, args);
    };
    st.wrapped.push([proto, name, orig]);
  };
  st.start = () => {
    st.timings = {};
    st.moves = {};
    st.missing = [];
    wrap(wm.tree, "render", "tree.render");
    wrap(wm.tree, "processNode", "tree.processNode");
    wrap(wm.tree, "apply", "tree.apply");
    wrap(wm, "_handleResizing", "wm._handleResizing");
    wrap(wm, "_liveResizeNeighbors", "wm._liveResizeNeighbors");
    wrap(wm, "resize", "wm.resize");
    countMoves("move_resize_frame");
    countMoves("move_frame");
    st.installed = true;
    return "started";
  };
  st.stop = () => {
    for (const [obj, name, orig] of st.wrapped.reverse()) obj[name] = orig;
    st.wrapped = [];
    st.installed = false;
    const stats = {};
    for (const [name, list] of Object.entries(st.timings)) {
      const s = [...list].sort((a, b) => a - b);
      const pct = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
      stats[name] = {
        calls: s.length,
        mean_us: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
        p95_us: pct(0.95),
        max_us: s[s.length - 1],
      };
    }
    return JSON.stringify({ timings: stats, moves: st.moves, missing: st.missing });
  };
  globalThis.__perf = st;
  return "ready";
})();
