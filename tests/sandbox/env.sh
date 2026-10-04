# Shared settings for the sandbox scripts (sourced, not executed).
REPRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Forge source checkout to build and test. Default: the checkout this directory is part of (when it
# lives in forge's tests/), otherwise a sibling ../forge clone (standalone copy of these tests).
if [[ -z ${FORGE_SRC:-} ]]; then
  if [[ -f $REPRO_ROOT/../extension.js && -f $REPRO_ROOT/../metadata.json ]]; then
    FORGE_SRC="$(cd "$REPRO_ROOT/.." && pwd)"
  else
    FORGE_SRC="$(cd "$REPRO_ROOT/.." && pwd)/forge"
  fi
fi
# Where the throwaway sandbox state lives (extensions dir, keyfile settings, logs, bus address).
SANDBOX_DIR="${SANDBOX_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/forge-sandbox/sandbox}"
FORGE_UUID=forge@jmmaranan.com
SANDBOX_DISPLAY=${SANDBOX_DISPLAY:-wayland-forge}
# Print PIDs of this sandbox's gnome-shell only: never the real session's shell, nor another
# sandbox whose display name merely starts with the same text (wayland-forge vs wayland-forge2).
sandbox_pids() { for p in $(pgrep -x gnome-shell); do tr '\0' ' ' < "/proc/$p/cmdline" | grep -qE -- "wayland-display $SANDBOX_DISPLAY( |\$)" && echo "$p"; done; }
