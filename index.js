const { start }    = require('./app');
const configCommon = require('./config/common');

function main() {
    try {
        start({
            mode      : configCommon.mode,
            mqtt      : configCommon.mqtt,
            debug     : configCommon.debug,
            heartbeat : configCommon.heartbeat,
            initTime  : configCommon.initTime
        });
    } catch (err) {
        console.error(err);

        process.exit(1);
    }
}

main();
