#!/usr/bin/env bash
# Stop the nested sandbox shell (never touches the host session's gnome-shell).
source "$(dirname "$0")/env.sh"
for p in $(sandbox_pids); do echo "stopping sandbox gnome-shell $p"; kill -TERM "$p"; done
