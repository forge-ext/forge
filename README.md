# A Gnome-Shell Extension Template

Install nodejs for npx:

```bash
npx degit github.com/jmmaranan/gnome-shell-ext-template my-extension

# Replace all `replaceme` before developing

# build it for local development, will install on $HOME/.local/share.
# Ctrl + C to stop journal log
cd my-extension
./build.sh

# Remove extension
make uninstall

# See Makefile for command options

```

## Gnome-Shell Extensions Notes

* All about Gnome Extensions: https://wiki.gnome.org/Projects/GnomeShell/Extensions/
* GJS API Docs: https://gjs-docs.gnome.org/
* Useful explanation for `imports.ui` components: https://mathematicalcoffee.blogspot.com/2012/09/gnome-shell-javascript-source.html
* Gnome Developer Site: https://developer.gnome.org/references
