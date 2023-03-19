---
name: Bug report
about: Create a report to help us improve the extension
title: 'bug: short descript of the issue'
labels: bug
assignees: ''

---

## Description

**What is the bug?**

### Problem Explanation

Write a clear and concise description of what the bug is:

The bug happens when ...

### Expected Behavior

A clear and concise description of what you expected to happen, and how the actual outcome differs:

- Pano shouldn't ...
- It should behave ...

## Reprodution

**How one can find the bug?**

### Steps To Reproduce

Steps to reproduce, if applicable:

1. Open application ...
2. Put the focus on ...
3. Press the gnome shortcut `<super>` `<shift>` `j` and ...
4. See the bug happening in the ...

### Details

Mark with [ ] all that applies:

#### It happens with any application?

- [ ] Yes, it applies to any application.
- [ ] No. Only with the following applications:
  - VSCode, Terminal, ...
- [ ] It works with the following applications that I have tried:
  - Fill in a list with any application that applies

#### It happens only on one computer?

- [ ] I don't know.
- [ ] No. I have tried it on more than one computer.

#### It happens only with some specific gnome configuration?

- [ ] I don't think that the configuration matters.
- [ ] Yes. Only if the following config is set up:
  - Fill in a list with any configuration tha applies.

#### It happens only with some specific extension installed?

- [ ] I don't think that the installed extensions affect the bug/behavior.
- [ ] Yes. Only if the following gnome extension is installed:
  - Fill in a list with any extension tha applies.
  - Fill in also any detail about the extensions that applies.

## Diagnostics

**Under what conditions does it happen?**

Fill in all information that applies:

### Environment

- Distro version     : ...  (`uname -a`)
- GNOME Shell version: ...  (`gnome-shell --version`)
- Forge source       : ...  (e.g: git branch or extensions.gnome.org)
- Forge version      : ...  (`gnome-extensions show forge@jmmaranan.com`)

### Display Setup

Displays:

1. 2 x 1080p
2. Dual monitor vertical orientation
3. Notebook 1920x1080 60hz + 4k monitor

### Screenshots

If applicable, add screenshots to help explain your problem:

#### Screenshot 1 description

...

#### Screenshot 2 description

...

### Output and Logs

Also if possible, please provide latest logs like:

#### Gnome Logs

**Command:** `journalctl --since='1 hour ago' --follow /usr/bin/gnome-shell`

#### System from 1 hour ago

**Command:** `journalctl -b 0 -r --since '1 hour ago'`:

``` bash
$ journalctl --since=now --follow /usr/bin/gnome-shell
...
```

#### Extension Configuration

**Command:** `dconf dump /org/gnome/shell/extensions/forge/`

``` bash
$ dconf dump /org/gnome/shell/extensions/forge/
...
```

#### Enabled Extensions

**Command:** `gnome-extensions list --enabled --details`

``` bash
$ gnome-extensions list --enabled --details
...
```

#### Graphics information

**Command:** `lshw -C display`

``` bash
$ lshw -C display
...
```

#### Monitor information

**Command:** `xrandr --properties | grep -vE '(x|\s|\.|\d)+$'`

``` bash
$ xrandr --properties | grep -vE '(x|\s|\.|\d)+$'
...
```
