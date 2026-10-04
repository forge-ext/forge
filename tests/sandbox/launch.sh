#!/usr/bin/env bash
# Start an isolated nested GNOME Shell running Forge built from $FORGE_SRC.
#
# Isolation: the nested shell gets its own D-Bus session bus (dbus-run-session), its own
# extensions directory (XDG_DATA_HOME) and keyfile-backed settings (GSETTINGS_BACKEND=keyfile),
# so the host session's dconf and extensions are never touched.
#
#   sandbox/launch.sh [WxH]     default 1920x1080: the fixed-size virtual monitor (monitor 0)
#                               the scenarios run on. To watch it live: sandbox/watch.py &
#   SANDBOX_PROFILE=real sandbox/launch.sh
#                               mirror this machine's session (see below)
#   SANDBOX_BACKEND=devkit sandbox/launch.sh
#                               also open the Mutter devkit viewer (needs mutter-dev-bin). It
#                               shows an extra monitor, not the test monitor; do NOT disable that
#                               monitor (the nested shell exits if you do).
set -euo pipefail
source "$(dirname "$0")/env.sh"
SIZE=${1:-1920x1080}
# SANDBOX_BACKEND=headless (default): no window of its own; watch it with sandbox/watch.py.
# SANDBOX_BACKEND=devkit: also opens the Mutter devkit viewer, which shows a second monitor
# whose size follows the viewer window (the scenarios still run on the fixed-size monitor 0).
BACKEND=${SANDBOX_BACKEND:-headless}
[[ $BACKEND == headless || $BACKEND == devkit ]] || { echo "SANDBOX_BACKEND must be headless or devkit"; exit 1; }
# SANDBOX_PROFILE=real: mirror this machine's session as closely as possible: its monitor size
# (unless WxH is given), its session mode (e.g. Ubuntu's dock and desktop icons), its enabled/disabled
# extension lists and its Forge settings. The real settings are only read, and copied into the
# sandbox's own keyfile settings.
# SANDBOX_SECOND_MONITOR=WxH adds a second virtual monitor (monitor 1), e.g. for moves between monitors
EXTRA=${SANDBOX_SECOND_MONITOR:+--virtual-monitor $SANDBOX_SECOND_MONITOR}
PROFILE=${SANDBOX_PROFILE:-plain}
MODE=user
if [[ $PROFILE == real ]]; then
  # The session mode of the running session, if gnome-shell has one installed (e.g. ubuntu)
  MODE=$(gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
           --method org.freedesktop.DBus.Properties.Get org.gnome.Shell Mode 2>/dev/null \
         | grep -oP "'\K[a-z-]+" || true)
  [[ -n $MODE && -e /usr/share/gnome-shell/modes/$MODE.json ]] || MODE=user
  if [[ -z ${1:-} ]]; then
    SIZE=$(gdbus call --session --dest org.gnome.Mutter.DisplayConfig --object-path /org/gnome/Mutter/DisplayConfig \
             --method org.gnome.Mutter.DisplayConfig.GetCurrentState \
           | grep -oP "\\('\\K[0-9]+x[0-9]+(?=@[0-9.]+', [0-9]+, [0-9]+, [0-9.]+, [0-9.]+, \\[[^]]*\\], \\{[^}]*'is-current': <true>)" | head -1)
    [[ -n $SIZE ]] || { echo "could not read this session's monitor size"; exit 1; }
  fi
  HOST_ENABLED=$(gsettings get org.gnome.shell enabled-extensions)
  HOST_DISABLED=$(gsettings get org.gnome.shell disabled-extensions)
  HOST_FORGE=$(dconf dump /org/gnome/shell/extensions/forge/)
elif [[ $PROFILE != plain ]]; then
  echo "SANDBOX_PROFILE must be plain or real"; exit 1
fi

for _ in $(seq 20); do [[ -z $(sandbox_pids) ]] && break; sleep 0.5; done
[[ -z $(sandbox_pids) ]] || { echo "sandbox already running (pid $(sandbox_pids))"; exit 1; }
[[ -e $FORGE_SRC/.git ]] || { echo "FORGE_SRC=$FORGE_SRC is not a git checkout of forge"; exit 1; }

# SANDBOX_DIR is wiped on every launch: only accept a directory that looks like one of ours.
case $SANDBOX_DIR in
  "$HOME"/?*|/tmp/?*) ;;
  *) echo "refusing: SANDBOX_DIR=$SANDBOX_DIR must be under \$HOME or /tmp"; exit 1 ;;
esac
[[ ! -e $SANDBOX_DIR || -e $SANDBOX_DIR/forge-version || -z $(ls -A "$SANDBOX_DIR") ]] \
  || { echo "refusing: $SANDBOX_DIR exists and isn't a sandbox directory (no forge-version file)"; exit 1; }
rm -rf "$SANDBOX_DIR"
mkdir -p "$SANDBOX_DIR/data/gnome-shell/extensions/$FORGE_UUID" "$SANDBOX_DIR/config" "$SANDBOX_DIR/data/dbus-1/services"
# The document portal mounts a FUSE file system at $XDG_RUNTIME_DIR/doc, which the sandbox shares with
# your session (whose own portal is mounted there). Keep the sandbox's bus from starting one: apps then
# see no document portal instead of one that hangs (the VS Code snap waits on it forever).
printf '[D-BUS Service]\nName=org.freedesktop.portal.Documents\nExec=/bin/false\n' \
  > "$SANDBOX_DIR/data/dbus-1/services/org.freedesktop.portal.Documents.service"

# Build. Only `make build` / `make dist`: forge's default target runs `killall -HUP gnome-shell`.
# </dev/null because `make metadata` runs `git shortlog`, which otherwise waits on stdin.
# `make build` also regenerates po/*.po. Put them back afterwards, unless you had changed them.
PO_DIRTY=$(git -C "$FORGE_SRC" status --porcelain -- po/)
( cd "$FORGE_SRC" && make dist </dev/null >/dev/null )      # dist depends on build
if [[ -z $PO_DIRTY ]]; then
  git -C "$FORGE_SRC" checkout -- po/
else
  echo "note: po/ had uncommitted changes, so it was left as the build wrote it"
fi
unzip -q -o "$FORGE_SRC/$FORGE_UUID.zip" -d "$SANDBOX_DIR/data/gnome-shell/extensions/$FORGE_UUID"
# Sandbox-only helper that enables unsafe mode (org.gnome.Shell.Eval) for the test driver.
cp -r "$REPRO_ROOT/sandbox/sandbox-unsafe@local" "$SANDBOX_DIR/data/gnome-shell/extensions/"
git -C "$FORGE_SRC" log -1 --format='forge: %h %s (%D)' > "$SANDBOX_DIR/forge-version"

export XDG_DATA_HOME=$SANDBOX_DIR/data XDG_CONFIG_HOME=$SANDBOX_DIR/config GSETTINGS_BACKEND=keyfile
if [[ $PROFILE == real ]]; then
  python3 - "$HOST_ENABLED" "$HOST_DISABLED" "$HOST_FORGE" "$SANDBOX_DIR/data/gnome-shell/extensions/$FORGE_UUID/schemas" <<'PY'
import ast, configparser, subprocess, sys
enabled, disabled, forge, schemadir = sys.argv[1:]
enabled = [e for e in ast.literal_eval(enabled.replace("@as ", "")) if e != "forge@jmmaranan.com"]
enabled += ["forge@jmmaranan.com", "sandbox-unsafe@local"]
subprocess.run(["gsettings", "set", "org.gnome.shell", "enabled-extensions", str(enabled)], check=True)
subprocess.run(["gsettings", "set", "org.gnome.shell", "disabled-extensions", disabled], check=True)
cfg = configparser.ConfigParser(interpolation=None, strict=False)
cfg.optionxform = str
cfg.read_string(forge)
schemas = {"/": "org.gnome.shell.extensions.forge", "keybindings": "org.gnome.shell.extensions.forge.keybindings"}
for group in cfg.sections():
    if group not in schemas:
        continue
    for key, value in cfg[group].items():
        # A key this build doesn't have (e.g. left over from an older Forge) is skipped
        r = subprocess.run(["gsettings", "--schemadir", schemadir, "set", schemas[group], key, value],
                           capture_output=True, text=True)
        if r.returncode:
            print(f"real profile: skipped Forge setting {key}: {r.stderr.strip()}")
print(f"real profile: {len(enabled) - 1} extensions enabled, Forge settings copied")
PY
else
  gsettings set org.gnome.shell enabled-extensions "['$FORGE_UUID', 'sandbox-unsafe@local']"
fi
gsettings set org.gnome.mutter dynamic-workspaces false        # forge: no dynamic workspaces
gsettings set org.gnome.desktop.wm.preferences num-workspaces 4
gsettings set org.gnome.shell welcome-dialog-last-shown-version '999'
# The helper extension (and Forge) load on any GNOME Shell version
gsettings set org.gnome.shell disable-extension-version-validation true

setsid dbus-run-session -- bash -c '
  echo "$DBUS_SESSION_BUS_ADDRESS" > "'"$SANDBOX_DIR"'/bus-address"
  exec gnome-shell --wayland --mode='"$MODE"' --'"$BACKEND"' --virtual-monitor '"$SIZE"' '"$EXTRA"' \
       --wayland-display '"$SANDBOX_DISPLAY"'
' > "$SANDBOX_DIR/nested.log" 2>&1 < /dev/null &

for _ in $(seq 60); do
  [[ -s $SANDBOX_DIR/bus-address ]] && grep -q 'GNOME Shell started' "$SANDBOX_DIR/nested.log" 2>/dev/null && break
  sleep 0.5
done
grep -q 'GNOME Shell started' "$SANDBOX_DIR/nested.log" || { echo "sandbox failed to start; see $SANDBOX_DIR/nested.log"; exit 1; }
sleep 2
cat "$SANDBOX_DIR/forge-version"
echo "sandbox ready: bus $(cat "$SANDBOX_DIR/bus-address")"
