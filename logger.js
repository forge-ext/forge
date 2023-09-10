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

  #settings;

  constructor(settings) {
    this.#settings = settings;
  }

  get #level() {
    let loggingEnabled = this.#settings.get_boolean("logging-enabled") || !production;
    return !loggingEnabled ? Logger.LOG_LEVELS.OFF : this.#settings.get_uint("log-level");
  }

  // TODO: use console.* methods
  logContext(msg, ...params) {
    let formattedMessage = msg;
    params.forEach((val) => {
      formattedMessage = formattedMessage.replace("{}", val);
    });
    log(`Forge: ${formattedMessage}`);
  }

  fatal(msg, ...params) {
    if (this.#level > Logger.LOG_LEVELS.OFF) this.logContext(`[FATAL] ${msg}`, ...params);
  }

  error(msg, ...params) {
    if (this.#level > Logger.LOG_LEVELS.FATAL) this.logContext(`[ERROR] ${msg}`, ...params);
  }

  warn(msg, ...params) {
    if (this.#level > Logger.LOG_LEVELS.ERROR) this.logContext(`[WARN] ${msg}`, ...params);
  }

  info(msg, ...params) {
    if (this.#level > Logger.LOG_LEVELS.WARN) this.logContext(`[INFO] ${msg}`, ...params);
  }

  debug(msg, ...params) {
    if (this.#level > Logger.LOG_LEVELS.INFO) this.logContext(`[DEBUG] ${msg}`, ...params);
  }

  trace(msg, ...params) {
    if (this.#level > Logger.LOG_LEVELS.DEBUG) this.logContext(`[TRACE] ${msg}`, ...params);
  }
}
