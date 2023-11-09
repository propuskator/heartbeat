const { randomUUID } = require('crypto');

const { STATES: { LOST, DISCONNECTED, READY } } = require('./constants/devices');
const { Logger }                                = require('./utils/Logger');


class Notificator {
    constructor({ mqtt, debug, userHash, deviceId }) {
        this.mqtt = mqtt;
        this.debug = debug || Logger('Notificator');
        this.userHash = userHash;
        this.deviceId = deviceId;
    }

    getMessage({ prevState, nextState }) {
        let message = '';

        if (nextState === LOST && prevState !== LOST) {
            message = 'Device was lost';
        }

        if (nextState === READY && prevState !== READY) {
            message = 'Device is ready';
        }

        if (nextState === DISCONNECTED && prevState !== DISCONNECTED) {
            message = 'Device was disconnected';
        }

        this.debug.debug(`Message to send ${message}`);

        return message;
    }

    notify(message) {
        const id = randomUUID();
        const data = {
            type       : 'text',
            senderType : 'heartbeat',
            senderId   : this.deviceId,
            logLevel   : 'info',
            message
        };

        this.debug.info('notify', data);

        this.mqtt.publish(`${this.userHash}/notifications/${id}/create`, JSON.stringify(data), { retain: false });
    }
}

module.exports = Notificator;
