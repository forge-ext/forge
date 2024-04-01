UUID = "forge@jmmaranan.com"
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
MSGSRC = $(wildcard po/*.po)

.PHONY: all clean install schemas uninstall enable disable log debug patchcss

all: build install enable restart

# When developing locally
test-x: disable uninstall build debug install enable restart log

test-wayland: clean build debug install test-shell log

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
	sed -i 's|1.*-alpha|4999|' temp/metadata.json

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
	gnome-extensions disable "$(UUID)"

install:
	mkdir -p $(INSTALL_PATH)
	cp -r temp/* $(INSTALL_PATH)

uninstall:
	rm -rf $(INSTALL_PATH)
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

log:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v -E 'warning|g_variant'

journal:
	journalctl -b 0 -r --since "1 hour ago"

test-shell:
	env GNOME_SHELL_SLOWDOWN_FACTOR=2 \
		MUTTER_DEBUG_DUMMY_MODE_SPECS=1500x1000 \
	  MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1 \
		dbus-run-session -- gnome-shell --nested --wayland --wayland-display=wayland-forge

# Usage: 
#   make test-shell-open &
#   make test-shell-open CMD=gnome-text-editor
#   make test-shell-open CMD=gnome-terminal ARGS='--app-id app.x'
#   make test-shell-open CMD=firefox ARGS='--safe-mode' ENVVARS='MOZ_DBUS_REMOTE=1 MOZ_ENABLE_WAYLAND=1'
#
test-shell-open: CMD=nautilus
test-shell-open:
	GDK_BACKEND=wayland WAYLAND_DISPLAY=wayland-forge $(ENVVARS) $(CMD) $(ARGS)&

format:
	npm run format

# npx prettier --list-different "./**/*.{js,jsx,ts,tsx,json}"
lint:
	npm test
