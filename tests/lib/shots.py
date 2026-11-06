"""Screenshots of the sandbox's test monitor for issue and PR write-ups.

    shot(path)                          full test monitor (monitor 0)
    later(path, after_s)                a function for hold_keys()/drag_edge(during=...) that
                                        takes a screenshot `after_s` seconds into the action
    annotate(src, dst, boxes)           draw labelled boxes: [(x, y, w, h, colour, label), ...]
    side_by_side(dst, [(path, caption), ...], width=...)  one image with captions (before/after)
"""
import os
import time

import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

import harness as h  # noqa: E402

FONT = "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf"
RED, GREEN, AMBER = (220, 38, 38), (22, 163, 74), (217, 119, 6)


def _font(size):
    for path in (FONT, "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def shot(path):
    """Screenshot of monitor 0 (the test monitor) to `path` (PNG)."""
    geo = h.js("(() => { const g = global.display.get_monitor_geometry(0); return [g.x, g.y, g.width, g.height]; })()")
    path = os.path.abspath(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ok, _ = h.bus().call_sync(
        "org.gnome.Shell.Screenshot", "/org/gnome/Shell/Screenshot", "org.gnome.Shell.Screenshot",
        "ScreenshotArea", GLib.Variant("(iiiibs)", (*geo, False, path)), GLib.VariantType("(bs)"),
        Gio.DBusCallFlags.NONE, 10000, None).unpack()
    if not ok:
        raise RuntimeError(f"screenshot failed: {path}")
    return path


def later(path, after_s):
    """For hold_keys()/drag_edge(during=...): screenshot `after_s` s into the action."""
    def take():
        time.sleep(after_s)
        shot(path)
    return take


def annotate(src, dst, boxes, width=None):
    """Draw boxes [(x, y, w, h, colour, label)] (monitor coordinates) on src, save to dst,
    optionally scaled to `width` px."""
    img = Image.open(src).convert("RGB")
    draw = ImageDraw.Draw(img)
    font = _font(max(18, img.width // 70))
    for x, y, w, hh, colour, label in boxes:
        draw.rectangle([x, y, x + w, y + hh], outline=colour, width=max(4, img.width // 400))
        if label:
            tw, th = draw.textbbox((0, 0), label, font=font)[2:]
            # inside the image, even for a box at its right edge
            lx, ly = min(x + 8, img.width - tw - 12), max(0, y + 8)
            draw.rectangle([lx - 6, ly - 4, lx + tw + 6, ly + th + 8], fill=colour)
            draw.text((lx, ly), label, fill=(255, 255, 255), font=font)
    if width and img.width != width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(dst, optimize=True)
    return dst


def side_by_side(dst, items, width=1600, gap=16):
    """items: [(path, caption)] -> one image, each panel `width / len(items)` wide, captions on top."""
    panel_w = (width - gap * (len(items) - 1)) // len(items)
    panels = []
    font = _font(28)
    for path, caption in items:
        img = Image.open(path).convert("RGB")
        img = img.resize((panel_w, round(img.height * panel_w / img.width)), Image.LANCZOS)
        cap_h = 48
        panel = Image.new("RGB", (panel_w, img.height + cap_h), (255, 255, 255))
        ImageDraw.Draw(panel).text((8, 8), caption, fill=(20, 20, 20), font=font)
        panel.paste(img, (0, cap_h))
        panels.append(panel)
    out = Image.new("RGB", (width, max(p.height for p in panels)), (255, 255, 255))
    x = 0
    for p in panels:
        out.paste(p, (x, 0))
        x += p.width + gap
    out.save(dst, optimize=True)
    return dst
