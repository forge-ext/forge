#!/usr/bin/env node

/*
 * This file is part of the Forge GNOME extension
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

/*
 * Type-check with a recorded error budget.
 *
 * `tsc --noEmit` reports errors Forge has not fixed yet (see the type-check
 * section of ANTIGRAVITY_REMAINING_WORK.md). Gating CI on zero errors would
 * leave the job permanently red, so this script compares the current output
 * against types/typecheck-baseline.json:
 *
 *   - a new error, or one more copy of a known error, fails the run;
 *   - fewer errors pass, and ask for `--update` to lower the budget.
 *
 * Errors are matched on file + code + message, not line number, so edits that
 * shift lines around do not churn the baseline. Repeats of the same error in
 * one file are counted, so three new copies still fail.
 *
 * Usage:
 *   node scripts/typecheck-baseline.mjs           check against the budget
 *   node scripts/typecheck-baseline.mjs --update  rewrite the budget file
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "types", "typecheck-baseline.json");
const tscPath = path.join(root, "node_modules", "typescript", "bin", "tsc");
const update = process.argv.includes("--update");

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

function runTsc() {
  const result = spawnSync(process.execPath, [tscPath, "--noEmit", "--pretty", "false"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

/** @returns {Map<string, string[]>} error key -> file:line messages */
function groupErrors(output) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = ERROR_LINE.exec(line);
    if (!match) continue;
    const [, file, lineNo, column, code, message] = match;
    const key = `${file.replace(/\\/g, "/")} | ${code} | ${message.trim()}`;
    const where = `${file}:${lineNo}:${column}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(where);
  }
  return groups;
}

/** @param {Map<string, string[]>} groups */
function toBudget(groups) {
  return Object.fromEntries([...groups.keys()].sort().map((key) => [key, groups.get(key).length]));
}

function readBaseline() {
  if (!existsSync(baselinePath)) return {};
  return JSON.parse(readFileSync(baselinePath, "utf8"));
}

function main() {
  if (!existsSync(tscPath)) {
    console.error("typescript is not installed: run `npm install` first.");
    process.exit(1);
  }

  const { output } = runTsc();
  const groups = groupErrors(output);
  const actual = toBudget(groups);
  const total = Object.values(actual).reduce((sum, count) => sum + count, 0);

  if (update) {
    writeFileSync(baselinePath, `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`typecheck: recorded ${total} known error(s) in types/typecheck-baseline.json`);
    return;
  }

  const baseline = readBaseline();
  const regressions = [];

  for (const [key, count] of Object.entries(actual)) {
    const allowed = baseline[key] ?? 0;
    if (count > allowed) {
      const [file, code, message] = key.split(" | ");
      regressions.push({
        file,
        code,
        message,
        added: count - allowed,
        where: groups.get(key).slice(allowed),
      });
    }
  }

  if (regressions.length > 0) {
    const added = regressions.reduce((sum, r) => sum + r.added, 0);
    console.error(`typecheck: ${added} new type error(s) beyond the recorded budget\n`);
    for (const regression of regressions) {
      console.error(`  ${regression.where.join(", ")}: ${regression.code} ${regression.message}`);
    }
    console.error("\nAsking tsc for the full output:");
    console.error(output.trim());
    process.exit(1);
  }

  const budgetTotal = Object.values(baseline).reduce((sum, count) => sum + count, 0);
  const fixed = budgetTotal - total;
  if (fixed > 0) {
    console.log(`typecheck: no new errors. ${total} known error(s) left (down ${fixed}).`);
    console.log("typecheck: lower the budget with `node scripts/typecheck-baseline.mjs --update`.");
  } else {
    console.log(`typecheck: no new errors. ${total} known error(s) left.`);
  }
}

main();
