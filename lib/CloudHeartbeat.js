const HomieCloud = require('homie-sdk/lib/homie/HomieCloud');
const Heartbeat = require('./Heartbeat');

class CloudHeartbeat extends HomieCloud {
    constructor({ transport, debug, heartbeatTimeout }) {
        super({ transport });
        this.debug = debug;
        this.heartbeatsStore = {};
        this.heartbeatTimeout = heartbeatTimeout;
        this.handleNewHomie = this.handleNewHomie.bind(this);
        this.on('new_homie', this.handleNewHomie);
    }
    handleNewHomie(rootTopic, homie) {
        this.heartbeatsStore[rootTopic] = new Heartbeat({
            homie,
            debug            : this.debug,
            heartbeatTimeout : this.heartbeatTimeout
        });
    }
}

module.exports = CloudHeartbeat;
