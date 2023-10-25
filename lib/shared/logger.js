/*
 * This file is part of the Forge extension for GNOME
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

import { production } from "./settings.js";

export class Logger {
  static #settings;

  static LOG_LEVELS = {
    OFF: 0,
    FATAL: 1,
    ERROR: 2,
    WARN: 3,
    INFO: 4,
    DEBUG: 5,
    TRACE: 6,
    ALL: 7,
  };

  static init(settings) {
    this.#settings = settings;
  }

  static get #level() {
    if (this.#settings?.get_boolean?.("logging-enabled")) {
      return production
        ? Logger.LOG_LEVELS.OFF
        : this.#settings?.get_uint?.("log-level") ?? Logger.LOG_LEVELS.OFF;
    }
    return Logger.LOG_LEVELS.OFF;
  }

  // TODO: use console.* methods
  static format(msg, ...params) {
    return params.reduce((acc, val) => acc.replace("{}", val), msg);
  }

  static fatal(...args) {
    if (this.#level > Logger.LOG_LEVELS.OFF) log(`[Forge] [FATAL]`, ...args);
  }

  static error(...args) {
    if (this.#level > Logger.LOG_LEVELS.FATAL) log(`[Forge] [ERROR]`, ...args);
  }

  static warn(...args) {
    if (this.#level > Logger.LOG_LEVELS.ERROR) log(`[Forge] [WARN]`, ...args);
  }

  static info(...args) {
    if (this.#level > Logger.LOG_LEVELS.WARN) log(`[Forge] [INFO]`, ...args);
  }

  static debug(...args) {
    if (this.#level > Logger.LOG_LEVELS.INFO) log(`[Forge] [DEBUG]`, ...args);
  }

  static trace(...args) {
    if (this.#level > Logger.LOG_LEVELS.DEBUG) log(`[Forge] [TRACE]`, ...args);
  }

  static log(...args) {
    if (this.#level > Logger.LOG_LEVELS.OFF) log(`[Forge] [LOG]`, ...args);
  }
}
