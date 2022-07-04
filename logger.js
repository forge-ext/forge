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

"use strict";

// Gnome-shell imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// App imports
const Settings = Me.imports.settings;

var LOG_LEVELS = {
  OFF: 0,
  FATAL: 1,
  ERROR: 2,
  WARN: 3,
  INFO: 4,
  DEBUG: 5,
  TRACE: 6,
  ALL: 7,
};

function logContext(msg, ...params) {
  let formattedMessage = msg;
  params.forEach((val) => {
    formattedMessage = formattedMessage.replace("{}", val);
  });
  log(`Forge: ${formattedMessage}`);
}

function getLogLevel() {
  let settings = Settings.getSettings();
  let loggingEnabled = settings.get_boolean("logging-enabled") || !Settings.production;
  let loggingLevel = settings.get_uint("log-level");
  if (!loggingEnabled) {
    loggingLevel = LOG_LEVELS.OFF;
  }
  return loggingLevel;
}

function fatal(msg, ...params) {
  if (getLogLevel() > LOG_LEVELS.OFF) logContext(`[FATAL] ${msg}`, ...params);
}

function error(msg, ...params) {
  if (getLogLevel() > LOG_LEVELS.FATAL) logContext(`[ERROR] ${msg}`, ...params);
}

function warn(msg, ...params) {
  if (getLogLevel() > LOG_LEVELS.ERROR) logContext(`[WARN] ${msg}`, ...params);
}

function info(msg, ...params) {
  if (getLogLevel() > LOG_LEVELS.WARN) logContext(`[INFO] ${msg}`, ...params);
}

function debug(msg, ...params) {
  if (getLogLevel() > LOG_LEVELS.INFO) logContext(`[DEBUG] ${msg}`, ...params);
}

function trace(msg, ...params) {
  if (getLogLevel() > LOG_LEVELS.DEBUG) logContext(`[TRACE] ${msg}`, ...params);
}
