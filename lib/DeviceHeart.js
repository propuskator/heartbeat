const { STATES : { DISCONNECTED, READY } } = require('./constants/devices');
const { Logger }                           = require('./utils/Logger');

class DeviceHeart {
    constructor({ notificator, deviceId, userHash, state, mqtt, debug, ttl = 3000 }) {
        this.notificator = notificator;
        this.deviceId = deviceId;
        this.userHash = userHash;
        this.prevState = null;
        this.state = state;
        this.debug = debug || Logger('DeviceHeart');
        this.started = false;
        this.mqtt = mqtt;
        this.ttl = ttl;
    }

    start() {
        this.started = true;
        this.debug.info(`Device ${this.deviceId} start`);
        this.resetTimeout();
    }

    stop() {
        this.debug.info(`Device ${this.deviceId} stop`);
        clearTimeout(this.timeout);
    }

    setState(state) {
        this.prevState = this.state;
        this.state = state;
        if (this.prevState === this.state) return;

        const message = this.notificator.getMessage({
            prevState : this.prevState,
            nextState : this.state
        });

        if (message) this.notificator.notify(message);
    }

    resetTimeout() {
        // this.debug.debug(`resetTimeout ${this.deviceId}`);
        if (this.timeout) clearTimeout(this.timeout);

        this.timeout = setTimeout(() => {
            // this.debug.debug(`setTimeout ${this.deviceId}`);
            if (this.state === DISCONNECTED) return;
            this.mqtt.publish(`${this.userHash}/sweet-home/${this.deviceId}/$state`, DISCONNECTED);
        }, this.ttl);
    }

    doHeartbeatRevision() {
        // this.debug.debug(`doHeartbeatRevision ${this.deviceId}`);
        if (this.state !== READY) {
            this.mqtt.publish(`${this.userHash}/sweet-home/${this.deviceId}/$state`, READY);
        }

        if (this.started) {
            this.resetTimeout();
        } else {
            this.start();
        }
    }
}

module.exports = DeviceHeart;
