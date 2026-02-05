UUID = "forge@jmmaranan.com"
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
MSGSRC = $(wildcard po/*.po)

# Shell configuration - use POSIX /bin/sh for better portability
SHELL := /bin/sh
.SHELLFLAGS := -ec

# Tool detection (using POSIX redirection)
HAS_XGETTEXT := $(shell command -v xgettext >/dev/null 2>&1 && echo yes || echo no)
HAS_MSGFMT := $(shell command -v msgfmt >/dev/null 2>&1 && echo yes || echo no)

.PHONY: all clean install schemas uninstall enable disable log debug patchcss check-deps

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
	@echo "Generating developer metadata..."
	@echo "export const developers = [" > lib/prefs/metadata.js
	@git shortlog -sne --all \
	| (grep -vE 'dependabot|noreply' || true) \
	| awk -F'\t' '{ \
		rest = $$2; \
		n = index(rest, " <"); \
		if (n == 0) next; \
		name = substr(rest, 1, n - 1); \
		email_part = substr(rest, n + 2); \
		gsub(/>$$/, "", email_part); \
		if (email_part in seen) next; \
		seen[email_part] = 1; \
		gsub(/"/, "\\\"", name); \
		printf "  \"%s <%s>\",\n", name, email_part; \
	}' >> lib/prefs/metadata.js
	@echo "];" >> lib/prefs/metadata.js

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
			msg_base="$$(basename "$$msg" .mo)"; \
			msgf="temp/locale/$$msg_base"; \
			mkdir -p "$$msgf"; \
			mkdir -p "$$msgf/LC_MESSAGES"; \
			cp "$$msg" "$$msgf/LC_MESSAGES/forge.mo"; \
		fi; \
	done;

debug:
	sed -i 's/export const production = true/export const production = false/' temp/lib/shared/settings.js
	#sed -i 's|1.*-alpha|4999|' temp/metadata.json

potfile: ./po/forge.pot

# Conditional potfile generation based on xgettext availability
ifeq ($(HAS_XGETTEXT),yes)
./po/forge.pot: metadata ./prefs.js ./extension.js ./lib/**/*.js
	mkdir -p po
	xgettext --from-code=UTF-8 --output=po/forge.pot --package-name "Forge" ./prefs.js ./extension.js ./lib/**/*.js
else
./po/forge.pot:
	@echo "WARNING: xgettext not found, skipping pot file generation"
	@echo "Install gettext package for translation support"
	@mkdir -p po
	@touch ./po/forge.pot
endif

# Conditional compilation of messages based on msgfmt availability
ifeq ($(HAS_MSGFMT),yes)
./po/%.mo: ./po/%.po
	msgfmt -c $< -o $@

compilemsgs: potfile $(MSGSRC:.po=.mo)
	for msg in $(MSGSRC); do \
		msgmerge -U "$$msg" ./po/forge.pot; \
	done;
else
compilemsgs:
	@echo "WARNING: msgfmt not found, skipping translation compilation"
	@echo "Install gettext package for translation support"
endif

clean:
	rm -f lib/prefs/metadata.js "$(UUID).zip"
	rm -rf temp schemas/gschemas.compiled

check-deps:
	@echo "Checking build dependencies..."
	@command -v glib-compile-schemas >/dev/null 2>&1 || (echo "ERROR: glib-compile-schemas not found. Install glib2-devel or libglib2.0-dev" && exit 1)
	@command -v git >/dev/null 2>&1 || (echo "ERROR: git not found" && exit 1)
	@command -v zip >/dev/null 2>&1 || echo "WARNING: zip not found, 'make dist' will fail"
	@command -v xgettext >/dev/null 2>&1 || echo "WARNING: xgettext not found, translations will be skipped"
	@command -v msgfmt >/dev/null 2>&1 || echo "WARNING: msgfmt not found, translations will be skipped"
	@echo "All required dependencies found. Optional tools may be missing; see any warnings above."

enable:
	@if gnome-extensions list | grep -Fqx "$(UUID)"; then \
		gnome-extensions enable "$(UUID)" && echo "Extension enabled successfully"; \
	else \
		echo "WARNING: Extension not detected by GNOME Shell yet"; \
		echo "On Wayland: Log out and log back in, then run 'make enable'"; \
		echo "On X11: Press Alt+F2, type 'r', press Enter, then run 'make enable'"; \
	fi

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
	if xprop -root >/dev/null 2>&1; then \
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
