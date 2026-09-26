// Simulate a mouse drag inside the SANDBOX shell with a Clutter virtual pointer, recording
// window frames and Forge node percents at each step. Parameters are substituted by
// harness.drag_edge():
//   __X0__ __Y0__ (press point), __DX__ __DY__ (total move), __STEPS__, __STEP_MS__
(() => {
  const X0 = __X0__,
    Y0 = __Y0__,
    DX = __DX__,
    DY = __DY__,
    STEPS = __STEPS__,
    STEP_MS = __STEP_MS__;
  const wm = Main.extensionManager.lookup("forge@jmmaranan.com").stateObj.extWm;
  const seat = global.stage.context.get_backend().get_default_seat();
  const dev = seat.create_virtual_device(0 /* CLUTTER_POINTER_DEVICE */);
  const now = () => GLib.get_monotonic_time();
  // numeric id of a window's nearest tabbed/stacked container (0: none); those windows share space
  const groupIds = (globalThis.__groupIds ??= new WeakMap());
  const groupOf = (n) => {
    for (let p = n.parentNode; p; p = p.parentNode) {
      if (p.layout === "TABBED" || p.layout === "STACKED") {
        if (!groupIds.has(p))
          groupIds.set(p, (globalThis.__groupNext = (globalThis.__groupNext ?? 0) + 1));
        return groupIds.get(p);
      }
    }
    return 0;
  };
  const snap = (tag) => {
    const wins = wm.tree
      .getNodeByType("WINDOW")
      .filter(
        (n) =>
          n.nodeValue.get_workspace() === global.workspace_manager.get_active_workspace() &&
          !n.nodeValue.minimized
      )
      .map((n) => {
        const f = n.nodeValue.get_frame_rect();
        return `${n.nodeValue.get_id() % 1000}:x=${f.x},y=${f.y},w=${f.width},h=${f.height},p=${(
          n.percent ?? 0
        ).toFixed(3)},g=${groupOf(n)}`;
      });
    st.log.push(
      `${((now() - st.t0) / 1000).toFixed(0)}ms ${tag} focus=${
        global.display.focus_window?.get_id() % 1000
      } grabOp=${wm.grabOp ?? "-"} | ${wins.join(" | ")}`
    );
  };
  const st = (globalThis.__drag = { t0: now(), log: [], done: false });
  const ids = [
    global.display.connect("grab-op-begin", (_d, w, op) =>
      snap(`SIGNAL grab-op-begin op=${op} win=${w?.get_id() % 1000}`)
    ),
    global.display.connect("grab-op-end", (_d, w, op) =>
      snap(`SIGNAL grab-op-end op=${op} win=${w?.get_id() % 1000}`)
    ),
  ];
  const seq = [];
  seq.push(() => {
    dev.notify_absolute_motion(now(), X0, Y0);
    snap("moved to start");
  });
  let pressed = false;
  seq.push(() => {
    dev.notify_button(now(), 1, 1);
    pressed = true;
    snap("button pressed");
  });
  for (let i = 1; i <= STEPS; i++)
    seq.push(() => {
      dev.notify_absolute_motion(now(), X0 + (DX * i) / STEPS, Y0 + (DY * i) / STEPS);
      snap(`step ${i}`);
    });
  seq.push(() => {
    snap("before release");
  });
  seq.push(() => {
    dev.notify_button(now(), 1, 0);
    pressed = false;
    snap("button released");
  });
  for (let i = 1; i <= 4; i++) seq.push(() => snap(`after release +${i * STEP_MS * 3}ms`));
  // Always release the button and disconnect, even if a step throws
  const finish = () => {
    if (pressed) dev.notify_button(now(), 1, 0);
    ids.forEach((id) => global.display.disconnect(id));
    st.done = true;
  };
  let k = 0;
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, STEP_MS, () => {
    try {
      if (k < seq.length) {
        seq[k++]();
        return GLib.SOURCE_CONTINUE;
      }
    } catch (e) {
      st.log.push(`ERROR ${e}`);
    }
    finish();
    return GLib.SOURCE_REMOVE;
  });
  return "started";
})();
