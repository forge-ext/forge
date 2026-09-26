// Print Forge's tree for the sandbox monitor: containers with layout/percent, windows with frames.
(() => {
  const wm = Main.extensionManager.lookup("forge@jmmaranan.com").stateObj.extWm;
  const out = [];
  const r = (x) => (x ? `[${[x.x, x.y, x.width, x.height].map(Math.round).join(",")}]` : "-");
  const walk = (n, d) => {
    if (n.nodeType === "WINDOW") {
      const f = n.nodeValue.get_frame_rect();
      out.push(
        `${"  ".repeat(d)}WIN ${n.nodeValue.get_id() % 1000} "${n.nodeValue
          .get_title()
          .slice(0, 18)}" p=${(n.percent ?? 0).toFixed(3)} frame=${r(f)} rect=${r(n.rect)}${
          n.isFloat() ? " FLOAT" : ""
        }${n.isGrabTile() ? " GRAB_TILE" : ""}${n.nodeValue.minimized ? " MINIMIZED" : ""}`
      );
    } else {
      out.push(
        `${"  ".repeat(d)}${n.nodeType} ${n.layout ?? ""} p=${(n.percent ?? 0).toFixed(3)} rect=${r(
          n.rect
        )}`
      );
      n.childNodes.forEach((c) => walk(c, d + 1));
    }
  };
  wm.tree.getNodeByType("MONITOR").forEach((m) => walk(m, 0));
  return out.join("\n");
})();
