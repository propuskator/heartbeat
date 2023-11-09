const Debugger      = require('homie-sdk/lib/utils/debugger');
const MQTTTransport = require('homie-sdk/lib/Broker/mqtt');

const CloudHeartbeat    = require('./lib/CloudHeartbeat');
const HeartbeatListener = require('./lib/HeartbeatListener');
const { Logger }        = require('./lib/utils/Logger');

function start(config) {
    const transport = new MQTTTransport({
        uri      : config.mqtt.uri,
        username : config.mqtt.username,
        password : config.mqtt.password
    });

    const { heartbeat: { timeout: heartbeatTimeout } } = config;

    if (config.mode === 'optimized') {
        const heartbeatListener = new HeartbeatListener({
            mqtt     : transport,
            initTime : config.initTime,
            heartbeatTimeout,
            debug    : Logger('HeartbeatListener')
        });

        heartbeatListener.init();
    } else {
        const debug = new Debugger(config.debug);

        debug.initEvents();

        const cloudHeartbeat = new CloudHeartbeat({
            transport,
            debug,
            heartbeatTimeout
        });

        cloudHeartbeat.init();
    }
}

module.exports = {
    start
};
