import assert from "node:assert/strict";
import test from "node:test";

import { isDesktopWindowTitle } from "../lib/shared/desktop-window.js";

test("matches the current DING desktop title", () => {
  assert.equal(isDesktopWindowTitle("Desktop Icons 1"), true);
  assert.equal(isDesktopWindowTitle("Desktop Icons 3"), true);
});

test("matches the position-encoded DING title", () => {
  assert.equal(isDesktopWindowTitle("@!0,0;BDHF"), true);
  assert.equal(isDesktopWindowTitle("@!-1920,1080;BDH"), true);
});

test("leaves ordinary windows alone", () => {
  const titles = [
    "Terminal",
    "Desktop Icons",
    "Desktop Icons 1 extra",
    "my Desktop Icons 1",
    "@!x,y;BDHF",
    "",
  ];
  for (const title of titles) {
    assert.equal(isDesktopWindowTitle(title), false, `unexpected match: ${title}`);
  }
});

test("tolerates a missing title", () => {
  assert.equal(isDesktopWindowTitle(null), false);
  assert.equal(isDesktopWindowTitle(undefined), false);
  assert.equal(isDesktopWindowTitle(42), false);
});
