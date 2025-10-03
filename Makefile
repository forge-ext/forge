UUID = "forge@jmmaranan.com"
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
MSGSRC = $(wildcard po/*.po)

.PHONY: all clean install schemas uninstall enable disable log debug patchcss

all: build install enable restart

dev: build debug install

prod: build install enable restart log

schemas: schemas/gschemas.compiled
	touch $@

schemas/gschemas.compiled: schemas/*.gschema.xml
	glib-compile-schemas schemas

patchcss:
	# TODO: add the script to update css tag when delivering theme.js

metadata:
	echo "export const developers = Object.entries([" > lib/prefs/metadata.js
	git shortlog -sne || echo "" >> lib/prefs/metadata.js
	awk -i inplace '!/dependabot|noreply/' lib/prefs/metadata.js
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
		msgf=temp/locale/`basename $$msg .mo`; \
		mkdir -p $$msgf; \
		mkdir -p $$msgf/LC_MESSAGES; \
		cp $$msg $$msgf/LC_MESSAGES/forge.mo; \
	done;

./po/%.mo: ./po/%.po
	msgfmt -c $< -o $@

debug:
	sed -i 's/export const production = true/export const production = false/' temp/lib/shared/settings.js
	#sed -i 's|1.*-alpha|4999|' temp/metadata.json

potfile: ./po/forge.pot

./po/forge.pot: metadata ./prefs.js ./extension.js ./lib/**/*.js
	mkdir -p po
	xgettext --from-code=UTF-8 --output=po/forge.pot --package-name "Forge" ./prefs.js ./extension.js ./lib/**/*.js

compilemsgs: potfile $(MSGSRC:.po=.mo)
	for msg in $(MSGSRC); do \
		msgmerge -U $$msg ./po/forge.pot; \
	done;

clean:
	rm -f lib/prefs/metadata.js
	rm "$(UUID).zip" || echo "Nothing to delete"
	rm -rf temp schemas/gschemas.compiled

enable:
	gnome-extensions enable "$(UUID)"

disable:
	gnome-extensions disable "$(UUID)" || echo "Nothing to disable"

install:
	mkdir -p $(INSTALL_PATH)
	cp -r temp/* $(INSTALL_PATH)

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
