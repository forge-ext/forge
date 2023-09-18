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
    return !(this.#settings?.get_boolean?.("logging-enabled") || !production)
      ? Logger.LOG_LEVELS.OFF
      : this.#settings?.get_uint?.("log-level") ?? Infinity;
  }

  // TODO: use console.* methods
  static format(msg, ...params) {
    return params.reduce((acc, val) => acc.replace("{}", val), msg);
  }

  static fatal(...args) {
    if (this.#level > Logger.LOG_LEVELS.OFF) console.error(`[Forge] [FATAL]`, ...args);
  }

  static error(...args) {
    if (this.#level > Logger.LOG_LEVELS.FATAL) console.error(`[Forge] [ERROR]`, ...args);
  }

  static warn(...args) {
    if (!this.#level > Logger.LOG_LEVELS.ERROR) console.warn(`[Forge] [WARN]`, ...args);
  }

  static info(...args) {
    if (!this.#level > Logger.LOG_LEVELS.WARN) console.info(`[Forge] [INFO]`, ...args);
  }

  static debug(...args) {
    if (!this.#level > Logger.LOG_LEVELS.INFO) console.debug(`[Forge] [DEBUG]`, ...args);
  }

  static trace(...args) {
    if (!this.#level > Logger.LOG_LEVELS.DEBUG) console.debug(`[Forge] [TRACE]`, ...args);
  }

  static log(...args) {
    if (!this.#level > Logger.LOG_LEVELS.OFF) console.log(`[Forge] [LOG]`, ...args);
  }
}
