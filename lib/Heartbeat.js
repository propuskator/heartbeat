/* eslint-disable no-require-lodash/no-require-lodash,func-style */
const HomieServer = require('homie-sdk/lib/homie/HomieServer');
const HomieClient = require('homie-sdk/lib/homie/HomieClient');

const NOTIFICATION_ENTITY_TYPE = 'NOTIFICATION';

class Heartbeat {
    constructor({ homie, debug, heartbeatTimeout }) {
        // handlers~
        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);
        this.handleNewDeviceAdded = this.handleNewDeviceAdded.bind(this);
        this.handleDelete = this.handleDelete.bind(this);
        this._handleSendSystemNotificationError = this._handleSendSystemNotificationError.bind(this);
        // ~handlers

        this.debug = debug;

        this.deviceHearbeats = {};

        this.timeout = heartbeatTimeout || 30000;
        this.pingInterval = Math.round(this.timeout / 3);

        this.homie = null;
        this.homieServer = null;
        this.homieClient = null;
        this.heartbeatAttribute = null;

        if (homie) this.attachHomie(homie);
    }

    async _sendSystemNotification(message, { deviceId, logLevel = 'info' }) {
        this.debug.info('Send system notification', { message, deviceId, logLevel });

        await this.homieClient.createEntityRequest(NOTIFICATION_ENTITY_TYPE, {
            message,
            logLevel,
            type       : 'text',
            senderType : 'device',
            senderId   : deviceId
        });
    }

    _handleSendSystemNotificationError(error) {
        this.debug.warning('Send system notification', error);
    }

    _notifyOnDeviceStateChange(deviceId, newState, lastState) {
        if (!lastState) return;

        let message = '';

        // if the state of the device has been set and received state is not equal to previous
        if (newState === 'lost' && lastState !== 'lost') {
            message = 'Device was lost';
        }

        if (newState === 'ready' && lastState !== 'ready') {
            message = 'Device is ready';
        }

        if (newState === 'disconnected' && lastState !== 'disconnected') {
            message = 'Device was disconnected';
        }

        if (message) {
            this._sendSystemNotification(message, { deviceId })
                .catch(this._handleSendSystemNotificationError);
        }
    }

    startDeviceHeartbeat(id) {
        if (this.deviceHearbeats[id]) {
            this.deviceHearbeats[id].doHeartbeatRevision();

            return;
        }
        this.debug.info(`startDeviceHeartbeat ${id}`);
        let device;

        try {
            device = this.homieServer.getDeviceById(id);
        } catch (e) {
            this.debug.error(e);

            return;
        }

        const deviceHearbeat = this.deviceHearbeats[id] = {};
        const publishEventName = device._getPublishEventName();
        const publishHeartbeatEventName = device._getPublishHeartbeatEventName();
        let lastState = device.getState();

        const handlePublish = (data) => {
            const key = Object.keys(data)[0];

            this.debug.info(`startDeviceHeartbeat ${id} handlePublish 1, ${JSON.stringify(data)}`);
            this.debug.info(`startDeviceHeartbeat ${id} handlePublish 2, ${Object.keys(data)[0]}=${data[key]}`);

            if (key === 'state') {
                const value = data[key];

                this._notifyOnDeviceStateChange(id, value, lastState);
                doHeartbeatRevision(value);
            }
        };

        let started = false;
        let timeout;
        const resetTimeout = () => {
            clearTimeout(timeout);
            if (!started ||  (lastState !== 'ready' && lastState !== 'init')) return;
            timeout = setTimeout(() => {
                this.debug.info(`startDeviceHeartbeat ${id} timeout`);
                this.homie.publishToBroker(`${this.homie.deviceTopic}/${id}/$state`, 'disconnected');
            }, this.timeout);
        };
        let pingInterval;
        const ping = () => {
            this.debug.info(`startDeviceHeartbeat ${id} ping`);
            try {
                this.homie.publishToBroker(`${this.homie.deviceTopic}/${id}/${this.heartbeatAttribute}/set`, '', { retain: false });
            } catch (e) {
                console.log(e);
                throw e;
            }
        };
        const start = () => {
            if (started) return;
            started = true;
            this.debug.info(`startDeviceHeartbeat ${id} start`);
            ping();
            pingInterval = setInterval(ping, this.pingInterval);
            resetTimeout();
        };
        const stop = () => {
            if (!started) return;
            started = false;
            this.debug.info(`startDeviceHeartbeat ${id} stop`);
            clearInterval(pingInterval);
            clearTimeout(timeout);
        };
        const doHeartbeatRevision = (state) => {
            lastState = state;
            // eslint-disable-next-line no-param-reassign
            if (this.homie.online && (state === 'ready' || state === 'init' || state === 'disconnected')) {
                if (started) resetTimeout();
                else start();
            } else stop();
        };
        const handleHeartbeat = () => {
            this.debug.info(`startDeviceHeartbeat ${id} handleHeartbeat`);
            resetTimeout();
            this.homie.publishToBroker(`${this.homie.deviceSettingsTopic}/${id}/$last-heartbeat-at`, `${Date.now()}`);
            if (lastState === 'disconnected') {
                this.homie.publishToBroker(`${this.homie.deviceTopic}/${id}/$state`, 'ready');
            }
        };

        deviceHearbeat.remove = () => {
            this.debug.info(`startDeviceHeartbeat ${id} remove`);
            stop();
            this.homie.off(publishEventName, handlePublish);
            this.homie.off(publishHeartbeatEventName, handleHeartbeat);
            delete this.deviceHearbeats[id];
        };
        deviceHearbeat.doHeartbeatRevision = () => {
            doHeartbeatRevision(device.getState());
        };
        this.homie.on(publishEventName, handlePublish);
        this.homie.on(publishHeartbeatEventName, handleHeartbeat);
        deviceHearbeat.doHeartbeatRevision();
    }

    attachHomie(homie) {
        if (this.homie) throw new Error('Homie is already attached');
        this.homie = homie;
        this.homie.on('online', this.handleOnline);
        this.homie.on('offline', this.handleOffline);
        this.homie.on('new_device', this.handleNewDeviceAdded);
        this.homie.on('events.delete.success', this.handleDelete);
        this.homie.on('error', this.handleError);
        this.homieServer = new HomieServer({ homie: this.homie });
        this.homieClient = new HomieClient({ homie: this.homie });
        this.heartbeatAttribute = this.homie.heartbeatAttribute;
        if (this.homie.online) this.handleOnline();
    }

    detachHomie() {
        if (!this.homie) throw new Error('Homie is not attached');
        this.homieServer = null;
        this.homieClient = null;
        this.heartbeatAttribute = null;
        this.homie.off('online', this.handleOnline);
        this.homie.off('offline', this.handleOffline);
        this.homie.off('new_device', this.handleNewDeviceAdded);
        this.homie.off('events.delete.success', this.handleDelete);
        this.homie.off('error', this.handleError);
        this.homie = null;
    }

    // handlers~
    async handleOnline() {
        this.debug.info('handleOnline');
        for (const id of Object.keys(this.homie.getDevices())) this.startDeviceHeartbeat(id);
    }
    async handleOffline() {
        this.debug.info('handleOffline');
        for (const id of Object.keys(this.deviceHearbeats)) this.deviceHearbeats[id].doHeartbeatRevision();
    }
    async handleNewDeviceAdded({ deviceId }) {
        this.debug.info(`handleNewDeviceAdded ${deviceId}`);
        this.startDeviceHeartbeat(deviceId);
    }
    async handleDelete({ type, deviceId }) {
        if (type === 'DEVICE' && this.deviceHearbeats[deviceId]) {
            this.debug.info(`handleDelete ${deviceId}`);
            this.deviceHearbeats[deviceId].remove();
        }
    }
    async handleError(error) {
        this.debug.error(error);
    }
    // ~handlers
}

module.exports = Heartbeat;
