#!/usr/bin/env python3
"""Show the sandbox's test monitor (monitor 0, the fixed-size --virtual-monitor) live in a window.

The scenarios run on a fixed-size virtual monitor that has no window of its own. This asks the
sandbox shell to screencast that monitor (org.gnome.Mutter.ScreenCast on the sandbox's private
bus) and plays the PipeWire stream in a window on the host desktop. The window stays open across
sandbox restarts (each scenario starts a fresh sandbox) and reconnects automatically.
Close the window (or Ctrl+C) to stop.

    sandbox/watch.py &
"""
import os
import sys

import gi

gi.require_version("Gst", "1.0")
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, GLib, Gst, Gtk  # noqa: E402

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import harness as h  # noqa: E402

SC = "org.gnome.Mutter.ScreenCast"


def log(*args):
    print(*args, flush=True)


def call(path, iface, method, args, reply):
    return h.bus().call_sync(SC, path, iface, method, args, GLib.VariantType(reply) if reply else None,
                             Gio.DBusCallFlags.NONE, 10000, None)


def sandbox_ready():
    """The bus address of a running, fully started sandbox, else None."""
    try:
        addr = open(os.path.join(h.SANDBOX_DIR, "bus-address")).read().strip()
        started = "GNOME Shell started" in open(os.path.join(h.SANDBOX_DIR, "nested.log"), errors="replace").read()
    except FileNotFoundError:
        return None
    return addr if addr and started else None


def test_monitor_connector():
    """Connector of the monitor the scenarios use (monitor 0 in the shell's numbering)."""
    geo = h.js("(() => { const g = global.display.get_monitor_geometry(0); return [g.width, g.height]; })()")
    state = h.bus().call_sync("org.gnome.Mutter.DisplayConfig", "/org/gnome/Mutter/DisplayConfig",
                              "org.gnome.Mutter.DisplayConfig", "GetCurrentState", None, None,
                              Gio.DBusCallFlags.NONE, 10000, None).unpack()
    for (connector, *_), modes, _props in state[1]:
        for mode in modes:
            if mode[6].get("is-current") and [mode[1], mode[2]] == geo:
                return connector, geo
    raise RuntimeError(f"no monitor with the test monitor's size {geo}")


class Watcher:
    def __init__(self):
        self.addr = None          # bus address of the sandbox we are showing
        self.session = None
        self.pipeline = None
        self.window = Gtk.Window(title="Forge sandbox: waiting for the sandbox")
        self.window.set_default_size(960, 540)
        self.window.connect("destroy", lambda *_: self.quit())
        self.waiting = Gtk.Label(label="Waiting for the sandbox (sandbox/launch.sh)…")
        self.window.add(self.waiting)
        self.window.show_all()
        self.loop = GLib.MainLoop()
        GLib.timeout_add(1000, self.poll)

    def set_child(self, widget, title):
        child = self.window.get_child()
        if child is not widget:
            if child:
                self.window.remove(child)
            self.window.add(widget)
        self.window.set_title(title)
        self.window.show_all()

    def disconnect(self, why):
        if self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
        if self.session:
            try:
                call(self.session, SC + ".Session", "Stop", None, None)
            except GLib.Error:
                pass
            self.session = None
        if self.addr:
            log(f"disconnected: {why}")
        self.addr = None
        h._bus = None          # the next sandbox has a new private bus
        self.set_child(self.waiting, "Forge sandbox: waiting for the sandbox")

    def poll(self):
        addr = sandbox_ready()
        if addr != self.addr:
            if self.addr:
                self.disconnect("the sandbox stopped or restarted")
            if addr:
                try:
                    self.connect(addr)
                except (GLib.Error, RuntimeError, OSError) as e:
                    log(f"not ready yet: {e}")
                    self.disconnect("connect failed")
        return GLib.SOURCE_CONTINUE

    def connect(self, addr):
        h._bus = None
        connector, (width, height) = test_monitor_connector()
        self.session = call("/org/gnome/Mutter/ScreenCast", SC, "CreateSession",
                            GLib.Variant("(a{sv})", ({},)), "(o)").unpack()[0]
        stream = call(self.session, SC + ".Session", "RecordMonitor",
                      GLib.Variant("(sa{sv})", (connector, {"cursor-mode": GLib.Variant("u", 1)})),
                      "(o)").unpack()[0]
        self.addr = addr
        title = f"Forge sandbox: test monitor ({width}x{height})"

        def on_stream_added(_conn, _sender, _path, _iface, _signal, params):
            node = params.unpack()[0]
            log(f"watching {connector} ({width}x{height}), PipeWire node {node}")
            self.pipeline = Gst.parse_launch(
                f"pipewiresrc path={node} always-copy=true do-timestamp=true ! videoconvert ! "
                f"gtksink name=sink sync=false")
            bus = self.pipeline.get_bus()
            bus.add_signal_watch()
            bus.connect("message::eos", lambda *_: self.disconnect("end of stream"))
            bus.connect("message::error", lambda *_: self.disconnect("stream error"))
            self.set_child(self.pipeline.get_by_name("sink").props.widget, title)
            self.pipeline.set_state(Gst.State.PLAYING)

        h.bus().signal_subscribe(SC, SC + ".Stream", "PipeWireStreamAdded", stream, None,
                                 Gio.DBusSignalFlags.NONE, on_stream_added)
        call(self.session, SC + ".Session", "Start", None, None)

    def quit(self):
        self.disconnect("window closed")
        self.loop.quit()


def main():
    Gst.init(None)
    Gtk.init(None)
    watcher = Watcher()
    try:
        watcher.loop.run()
    except KeyboardInterrupt:
        watcher.quit()


main()
