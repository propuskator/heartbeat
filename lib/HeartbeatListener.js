const DeviceHeart = require('./DeviceHeart');
const Notificator = require('./Notificator');

class HeartbeatListener {
    constructor({ mqtt, initTime, heartbeatTimeout, debug }) {
        this.mqtt = mqtt;
        this.initTime = initTime || 2000;
        this.debug = debug;
        this.topicsToSubscribe = [
            '+/sweet-home/+/$state',
            '+/sweet-home/+/$heartbeat'
        ];
        this.state = {};
        this.heartbeatTimeout = heartbeatTimeout || 30000;

        this._handleConnected = this._handleConnected.bind(this);
        this._handleError = this._handleError.bind(this);
        this._handleMessage = this._handleMessage.bind(this);
    }

    init() {
        this.debug.info('Init start');
        this.mqtt.connect();

        this.mqtt.on('connect', this._handleConnected);
        this.mqtt.on('error', this._handleError);
        this.mqtt.on('message', this._handleMessage);

        this.mqtt.subscribe(this.topicsToSubscribe);

        // time to receive all topics from broker
        return new Promise((resolve) =>
            setTimeout(() => {
                this.debug.info('Init finish');

                resolve();
            }, this.initTime)
        );
    }

    _handleConnected() {
        this.debug.info('mqtt.connected');
    }

    _handleError(error) {
        this.debug.warning('mqtt.error', error);

        throw error;
    }

    _handleMessage(topic, messageBuffer) {
        const { userHash, deviceId, stateField } = this.parseTopic(topic);
        const message = messageBuffer.toString();

        switch (stateField) {
            case '$state':
                this.handleStateMessage({ userHash, deviceId, message });
                break;
            case '$heartbeat':
                this.handleHeartbeatMessage({ userHash, deviceId });
                break;
            default:
                break;
        }
    }

    handleStateMessage({ userHash, deviceId, message }) {
        this.debug.info({ deviceId, message });

        if (!message && this.state?.[userHash]?.[deviceId]) {
            this._stopDevice({ userHash, deviceId });
        } else if (!this.state?.[userHash]?.[deviceId]) {
            this._startNewDevice({ userHash, deviceId, message });
        } else {
            this._updateDeviceState({ userHash, deviceId, message });
        }
    }

    _startNewDevice({ userHash, deviceId, message }) {
        if (!this.state[userHash]) this.state[userHash] = {};
        this.state[userHash][deviceId] = {};

        const notificator = new Notificator({
            mqtt : this.mqtt,
            deviceId,
            userHash
        });

        this.state[userHash][deviceId].heart = new DeviceHeart({
            notificator,
            mqtt  : this.mqtt,
            ttl   : this.heartbeatTimeout,
            state : message,
            userHash,
            deviceId
        });
        this.state[userHash][deviceId].heart.start();
    }

    _stopDevice({ userHash, deviceId }) {
        this.state[userHash][deviceId].heart.stop();
        delete this.state[userHash][deviceId];
    }

    _updateDeviceState({ userHash, deviceId, message }) {
        this.state[userHash][deviceId].heart.setState(message);
    }

    handleHeartbeatMessage({ userHash, deviceId }) {
        if (!this.state?.[userHash]?.[deviceId]) return;

        this.state[userHash][deviceId].heart.doHeartbeatRevision();
    }

    parseTopic(topic) {
        const [ userHash, , deviceId, stateField ] = topic.split('/');

        return {
            userHash,
            deviceId,
            stateField
        };
    }
}

module.exports = HeartbeatListener;
