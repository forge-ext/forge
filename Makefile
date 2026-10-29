UUID = forge@jmmaranan.com
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
MSGSRC = $(wildcard po/*.po)

# gettext is only needed to refresh translations, not to run the extension.
HAVE_MSGFMT := $(shell command -v msgfmt 2>/dev/null)
HAVE_MSGMERGE := $(shell command -v msgmerge 2>/dev/null)
HAVE_XGETTEXT := $(shell command -v xgettext 2>/dev/null)

.PHONY: all clean install reinstall schemas uninstall enable disable log debug patchcss metadata potfile compilemsgs

# Targets like "build: clean ..." rely on prerequisite order; with -j the
# clean step races and deletes freshly compiled schemas.
.NOTPARALLEL:

all: build install enable restart

dev: build debug install

prod: build install enable restart log

schemas: schemas/gschemas.compiled
	touch $@

schemas/gschemas.compiled: schemas/*.gschema.xml
	@command -v glib-compile-schemas >/dev/null 2>&1 || { \
		echo "glib-compile-schemas not found; install glib2-devel (Fedora) or libglib2.0-dev (Debian)"; \
		exit 1; \
	}
	glib-compile-schemas schemas

patchcss:
	# TODO: add the script to update css tag when delivering theme.js

metadata:
	echo "export const developers = Object.entries([" > lib/prefs/metadata.js
	# In a ZIP/tarball checkout there is no .git, and a bare `git shortlog`
	# reads stdin forever. Pass HEAD so git fails fast, and keep a fallback entry.
	@if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
		git shortlog -sne HEAD >> lib/prefs/metadata.js 2>/dev/null || true; \
	else \
		echo '  { name: "Forge contributors", email: "forge@jmmaranan.com" },' >> lib/prefs/metadata.js; \
	fi
	awk '!/dependabot|noreply/' lib/prefs/metadata.js > lib/prefs/metadata.js.tmp && mv lib/prefs/metadata.js.tmp lib/prefs/metadata.js
	sed -i 's/^[[:space:]]*[0-9]*[[:space:]]*\(.*\) <\(.*\)>/  {name:"\1", email:"\2"},/g' lib/prefs/metadata.js
	echo "].reduce((acc, x) => ({ ...acc, [x.email]: acc[x.email] ?? x.name }), {})).map(([email, name]) => name + ' <' + email + '>')" >> lib/prefs/metadata.js

build: clean metadata.json schemas compilemsgs metadata
	rm -rf temp
	mkdir -p temp
	cp metadata.json temp
	cp -r resources temp
	cp -r schemas temp
	cp -r config temp
	cp -r lib temp
	cp *.js temp
	cp *.css temp
	cp LICENSE temp
	mkdir -p temp/locale
	for msg in $(MSGSRC:.po=.mo); do \
		if [ -f "$$msg" ]; then \
			msgf=temp/locale/`basename $$msg .mo`; \
			mkdir -p $$msgf/LC_MESSAGES; \
			cp $$msg $$msgf/LC_MESSAGES/forge.mo; \
		fi; \
	done;

./po/%.mo: ./po/%.po
	msgfmt -c $< -o $@

debug:
	sed -i 's/export const production = true/export const production = false/' temp/lib/shared/settings.js
	#sed -i 's|1.*-alpha|4999|' temp/metadata.json

ifeq ($(strip $(HAVE_XGETTEXT)),)
potfile:
	@echo "xgettext not found; keeping the existing po/forge.pot"
else
potfile: ./po/forge.pot

./po/forge.pot: metadata ./prefs.js ./extension.js ./lib/**/*.js
	mkdir -p po
	xgettext --from-code=UTF-8 --output=po/forge.pot --package-name "Forge" ./prefs.js ./extension.js ./lib/**/*.js
endif

ifeq ($(strip $(HAVE_MSGFMT)),)
compilemsgs:
	@echo "msgfmt not found; building without compiled translations"
else ifeq ($(strip $(HAVE_MSGMERGE)),)
compilemsgs: $(MSGSRC:.po=.mo)
	@echo "msgmerge not found; compiling the existing translations only"
else
compilemsgs: potfile $(MSGSRC:.po=.mo)
	for msg in $(MSGSRC); do \
		msgmerge -U $$msg ./po/forge.pot; \
	done;
endif

clean:
	rm -f lib/prefs/metadata.js
	rm -f "$(UUID).zip"
	rm -rf temp schemas/gschemas.compiled

enable:
	gnome-extensions enable "$(UUID)"

disable:
	gnome-extensions disable "$(UUID)" || echo "Nothing to disable"

install: build
	@test -n "$(INSTALL_PATH)" || { echo "INSTALL_PATH is empty"; exit 1; }
	rm -rf "$(INSTALL_PATH)"
	mkdir -p "$(INSTALL_PATH)"
	cp -r temp/. "$(INSTALL_PATH)/"

# Disable first so GNOME is not loading modules from a directory that is about
# to be replaced, then re-enable after the new files are in place.
reinstall: disable install enable

uninstall:
	rm -rf $(INSTALL_PATH)

purge:
	rm -rf .config/forge

# When releasing
dist: build
	cd temp && \
	zip -qr "../${UUID}.zip" .

restart:
	if bash -c 'xprop -root &> /dev/null'; then \
		killall -HUP gnome-shell; \
	else \
		gnome-session-quit --logout; \
	fi

horizontal-line:
	@printf '%.s─' $$(seq 1 $$(tput cols)) && echo || true # Prints a line of dashes #

log: GNOME_SHELL_CMD=$(shell command -v gnome-shell)
log: horizontal-line
	@echo 'HINT: type [Ctrl]+[C] to return to the prompt.'
	journalctl --user --follow --output=short-iso --lines=10 --since='10 seconds ago' --grep 'warning|g_variant' "$(GNOME_SHELL_CMD)"

journal:
	journalctl -b 0 -r --since "1 hour ago"

test-nested: horizontal-line
	env GNOME_SHELL_SLOWDOWN_FACTOR=2 \
		MUTTER_DEBUG_DUMMY_MODE_SPECS=1500x1000 \
		MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1 \
		GDK_BACKEND=wayland \
		WAYLAND_DISPLAY=wayland-forge \
		dbus-run-session -- gnome-shell --nested --wayland --wayland-display=wayland-forge

# Usage: 
#   make test-open &
#   make test-open CMD=gnome-text-editor
#   make test-open CMD=gnome-terminal ARGS='--app-id app.x'
#   make test-open CMD=gnome-gnome-www-browser
#   make test-open CMD=firefox ARGS='--safe-mode' ENVVARS='MOZ_DBUS_REMOTE=1 MOZ_ENABLE_WAYLAND=1'
#
test-open: CMD=gnome-text-editor
test-open:
	GDK_BACKEND=wayland WAYLAND_DISPLAY=wayland-forge $(ENVVARS) $(CMD) $(ARGS)&

# When developing locally
test: disable uninstall clean build debug install enable test-nested

# X-Window testing need gnome-shell restart
test-x: disable uninstall purge build debug install enable restart log

format:
	npm run format

lint:
	npm test

check:
	npx prettier --check "./**/*.{js,jsx,ts,tsx,json}"
