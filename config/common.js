const confme = require('confme');

const config = confme(
    `${__dirname}/common.json`,
    `${__dirname}/common.validation.json`
);

module.exports = config;
