#!/usr/bin/env bash
# Run an application inside the sandbox (its Wayland display, D-Bus bus and settings only).
set -euo pipefail
source "$(dirname "$0")/env.sh"
export DBUS_SESSION_BUS_ADDRESS="$(cat "$SANDBOX_DIR/bus-address")"
export WAYLAND_DISPLAY=$SANDBOX_DISPLAY GDK_BACKEND=wayland
export XDG_DATA_HOME=$SANDBOX_DIR/data XDG_CONFIG_HOME=$SANDBOX_DIR/config GSETTINGS_BACKEND=keyfile
unset DISPLAY
exec "$@"
