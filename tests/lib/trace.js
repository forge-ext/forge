// Debug aid: wrap Forge WindowManager methods to log each call with the focused window's frame
// and baseline (initRect). Install:  trace.js with __ON__=true ; remove with __ON__=false.
(() => {
  const wm = Main.extensionManager.lookup("forge@jmmaranan.com").stateObj.extWm;
  const names = [
    "_handleGrabOpBegin",
    "_handleResizing",
    "_handleGrabOpEnd",
    "resize",
    "renderTree",
  ];
  if (!wm.__traceOrig) wm.__traceOrig = {};
  globalThis.__trace = globalThis.__trace ?? [];
  const t0 = GLib.get_monotonic_time();
  if (__ON__) {
    globalThis.__trace = [];
    for (const n of names) {
      const orig = wm.__traceOrig[n] ?? wm[n];
      wm.__traceOrig[n] = orig;
      wm[n] = function (...args) {
        const mw = this.focusMetaWindow;
        const node = mw ? this.findNodeWindow(mw) : null;
        const f = mw?.get_frame_rect();
        const ir = node?.initRect;
        const res = orig.apply(this, args);
        globalThis.__trace.push(
          `${((GLib.get_monotonic_time() - t0) / 1000).toFixed(1)}ms ${n}` +
            (f ? ` frame.w=${f.width} frame.h=${f.height}` : "") +
            (ir ? ` base.w=${Math.round(ir.width)} base.h=${Math.round(ir.height)}` : " base=-") +
            (node ? ` p=${(node.percent ?? 0).toFixed(3)}` : "") +
            (node?.parentNode?.nodeType === "CON"
              ? ` con.p=${(node.parentNode.percent ?? 0).toFixed(3)}`
              : "") +
            (n === "resize" ? ` args=${args.join(",")}` : "")
        );
        return res;
      };
    }
    return "tracing on";
  }
  for (const n of Object.keys(wm.__traceOrig)) wm[n] = wm.__traceOrig[n];
  wm.__traceOrig = {};
  return "tracing off";
})();
