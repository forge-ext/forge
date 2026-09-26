#!/usr/bin/env python3
"""Run JavaScript inside the SANDBOX gnome-shell via org.gnome.Shell.Eval on its private bus.

    sandbox/sb_eval.py 'JS expression'        sandbox/sb_eval.py - < script.js
Refuses to run unless the address is a private dbus-run-session bus, so it can never reach the
host session's shell.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
from harness import js_raw  # noqa: E402

code = sys.stdin.read() if sys.argv[1:] == ["-"] else " ".join(sys.argv[1:])
ok, out = js_raw(code)
print(out if ok else f"EVAL ERROR: {out}")
sys.exit(0 if ok else 1)
