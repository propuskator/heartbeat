require('colors');

const { createLogger, format, transports } = require('winston');
const { SPLAT } = require('triple-beam');

const { combine, timestamp, label, printf } = format;

const LEVELS = {
    SILENT  : 'silent',
    ERROR   : 'error',
    WARN    : 'warning',
    INFO    : 'info',
    VERBOSE : 'verbose',
    DEBUG   : 'debug',
    SILLY   : 'silly'
};

const COLORS_BY_LEVEL = {
    [LEVELS.ERROR]   : 'red',
    [LEVELS.WARN]    : 'yellow',
    [LEVELS.INFO]    : 'gray',
    [LEVELS.VERBOSE] : 'cyan',
    [LEVELS.DEBUG]   : 'blue',
    [LEVELS.SILLY]   : 'magenta'
};

const DEFAULT_LEVEL = process.env.VERBOSE || LEVELS.INFO;
const IS_PLAIN_FORMAT = process.env.LOG_FORMAT === 'plain';

let MAX_LABEL_LENGTH = 0;
const MAX_LEVEL_LENGTH = 7;
const COLOR_PREFIX_LENGTH = IS_PLAIN_FORMAT ? 10 : 0;

function addSpacesToEnd(text) {
    const fixedLength = MAX_LABEL_LENGTH + COLOR_PREFIX_LENGTH;

    return text.length > fixedLength ? text.slice(0, fixedLength) : `${text}${' '.repeat(fixedLength - text.length)}`;
}

function addSpacesToStart(text) {
    const fixedLength = MAX_LEVEL_LENGTH + COLOR_PREFIX_LENGTH;

    return text.length > fixedLength ? text.slice(0, fixedLength) : `${' '.repeat(fixedLength - text.length)}${text}`;
}

function formatObject(param, meta) {
    let payload = param;

    if (typeof param === 'object') payload = `${JSON.stringify(param)}`;
    if (meta[SPLAT]) payload += `: ${meta[SPLAT].map(JSON.stringify).join(' ')}`;

    return payload;
}

function myFormatDev(service) {
    return printf(({ timestamp: time, level, message, ...meta }) => {
        const coloredLevel = addSpacesToStart(level[COLORS_BY_LEVEL[level]]);

        return `${time} ${coloredLevel}: [ ${addSpacesToEnd(service.green)} ] ${formatObject(
            message,
            meta
        )}`;
    });
}

function myFormatProd(service) {
    return printf(({ timestamp: time, level, message, ...meta }) => {
        return JSON.stringify({
            service,
            time,
            level,
            message : formatObject(message, meta)
        });
    });
}

function table(tableData, dump) {
    if (process.env.VERBOSE === 'silent') return;
    if (Array.isArray(tableData)) {
        if (tableData.length) console.log('');
        if (tableData.length) console.table(tableData, dump);
    } else {
        console.log('');
        console.table([ tableData ], dump);
    }
}

const myFormat = IS_PLAIN_FORMAT ? myFormatDev : myFormatProd;

function isSilent(service) {
    const { VERBOSE, LOUD_SERVICES, SILENT_SERVICES } = process.env;

    if (VERBOSE === 'silent') return true;
    if (SILENT_SERVICES && SILENT_SERVICES.includes(service)) return true;
    if (LOUD_SERVICES && !LOUD_SERVICES.includes(service)) return true;

    return false;
}

/**
 * Initialize logger
 * @param {String} service - String: name of file/module, where logger should be initialized
 * @param {String} level - String: deps of logs, which should be printed
 * @returns {Object} - Object: an instance of logger
 */

module.exports.Logger = function loggerManager(service = '', level = DEFAULT_LEVEL) {
    if (MAX_LABEL_LENGTH < service.length) MAX_LABEL_LENGTH = service.length;

    const logger = createLogger({
        label,
        level,
        format     : combine(timestamp({ format: 'DD/MM HH:mm:ss.SSS' }), myFormat(service)),
        silent     : isSilent(service),
        transports : [ new transports.Console() ],
        levels     : {
            error   : 0,
            warning : 1,
            info    : 2,
            verbose : 3,
            debug   : 4,
            silly   : 5
        }
    });

    logger.table = table;

    return logger;
};

module.exports.LEVELS = LEVELS;
