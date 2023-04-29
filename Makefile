UUID = "forge@jmmaranan.com"
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
MSGSRC = $(wildcard po/*.po)
MESSAGES = messages.js

.PHONY: all clean install schemas uninstall enable disable log debug patchcss

all: build install enable restart

# When developing locally
dev: disable uninstall build debug install enable restart log

prod: build install enable restart log

schemas: schemas/gschemas.compiled
	touch $@

schemas/gschemas.compiled: schemas/*.gschema.xml
	glib-compile-schemas schemas

patchcss:
	# TODO: add the script to update css tag when delivering theme.js

build: clean metadata.json schemas compilemsgs
	rm -rf temp
	mkdir -p temp
	cp metadata.json temp
	cp -r icons temp
	cp -r schemas temp
	cp -r config temp
	cp *.js temp
	cp *.css temp
	cp LICENSE temp
	cp css/index.js temp/css.js
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
	sed -i 's/var production = true/var production = false/' temp/settings.js
	sed -i 's/1.0-alpha/3999/' temp/metadata.json
	sed -i 's/1.1-alpha/4999/' temp/metadata.json

potfile: ./po/forge.pot

./po/forge.pot: $(MESSAGES)
	mkdir -p po
	xgettext --from-code=UTF-8 --output=po/forge.pot --package-name "Forge" $(MESSAGES)

compilemsgs: potfile $(MSGSRC:.po=.mo)
	for msg in $(MSGSRC); do \
		msgmerge -U $$msg ./po/forge.pot; \
	done;

clean:
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
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning

journal:
	journalctl -b 0 -r --since "1 hour ago"
