const ExtensionUtils = imports.misc.extensionUtils;

const LOG_LEVELS = {
    "OFF" : 0,
    "FATAL": 1,
    "ERROR": 2,
    "WARN": 3,
    "INFO": 4,
    "DEBUG": 5,
    "TRACE": 6,
    "ALL": 7
};

function logContext(msg) {
    log(`replaceme ${msg}`);
}

function getLogLevel() {
    let settings = ExtensionUtils.getSettings();
    let loggingLevel = settings.get_uint("log-level");
    return loggingLevel;
}

function fatal(msg) {
    if (getLogLevel() > LOG_LEVELS.OFF)
        logContext(`[FATAL] ${msg}`);
}

function error(msg) {
    if (getLogLevel() > LOG_LEVELS.FATAL)
        logContext(`[ERROR] ${msg}`);
}

function warn(msg) {
    if (getLogLevel() > LOG_LEVELS.ERROR)
        logContext(`[WARN] ${msg}`);
}

function info(msg) {
    if (getLogLevel() > LOG_LEVELS.WARN)
        logContext(`[INFO] ${msg}`);
}

function debug(msg) {
    if (getLogLevel() > LOG_LEVELS.INFO)
        logContext(`[DEBUG] ${msg}`);
}

function trace(msg) {
    if (getLogLevel() > LOG_LEVELS.DEBUG)
        logContext(`[TRACE] ${msg}`);
}
