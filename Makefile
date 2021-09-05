UUID = "forge@jmmaranan.com"
INSTALL_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all clean install schemas uninstall enable disable log debug

all: build install enable restart

dev: build debug install enable restart log

schemas: schemas/gschemas.compiled
	touch $@

schemas/gschemas.compiled: schemas/*.gschema.xml
	glib-compile-schemas schemas

build: clean metadata.json schemas
	rm -rf temp
	mkdir -p temp
	cp metadata.json temp
	cp -r icons temp
	cp -r schemas temp
	cp *.js temp
	cp *.css temp

debug:
	sed -i 's/!loggingEnabled/false/' temp/logger.js

clean:
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
	make restart

dist: build
	cd temp && \
	zip -qr "../${UUID}.zip" .

restart:
	if bash -c 'xprop -root &> /dev/null'; then \
		busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting Gnome...")'; \
	else \
		gnome-session-quit --logout; \
	fi

log:
	journalctl -o cat -n 0 -f "$$(which gnome-shell)" | grep -v warning
