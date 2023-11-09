jest.mock('homie-sdk/lib/Broker/mqtt');
jest.mock('../../../lib/Notificator');

const MQTTTransport = require('homie-sdk/lib/Broker/mqtt');

const DeviceHeart = require('../../../lib/DeviceHeart');
const { STATES }  = require('../../../lib/constants/devices');
const Notificator = require('../../../lib/Notificator');

jest.useFakeTimers();

describe('HeartbeatListener', () => {
    describe('resetTimeout', () => {
        describe('POSITIVE', () => {
            it('should publish disconnected value to state topic when current state is not disconnected', () => {
                const DEVICE_ID = 'test-device-id';
                const USER_HASH = 'test-user-hash';
                const STATE = STATES.READY;
                const mockMqtt = new MQTTTransport();
                const TTL = 3000;
                const deviceHeart = new DeviceHeart({
                    deviceId : DEVICE_ID,
                    userHash : USER_HASH,
                    state    : STATE,
                    mqtt     : mockMqtt,
                    ttl      : TTL
                });
                const EXPECTED_STATE_TOPIC = `${USER_HASH}/sweet-home/${DEVICE_ID}/$state`;
                const EXPECTED_STATE_VALUE = STATES.DISCONNECTED;

                deviceHeart.resetTimeout();

                jest.advanceTimersByTime(TTL);

                expect(mockMqtt.publish).toHaveBeenCalledWith(EXPECTED_STATE_TOPIC, EXPECTED_STATE_VALUE);
            });
        });
    });

    describe('doHeartbeatRevision', () => {
        describe('POSITIVE', () => {
            it(
                'should publish ready state when current state is not ready ' +
                'and reset timeout when device heart is started',
                () => {
                    const DEVICE_ID = 'test-device-id';
                    const USER_HASH = 'test-user-hash';
                    const STATE = STATES.DISCONNECTED;
                    const mockMqtt = new MQTTTransport();
                    const TTL = 3000;
                    const deviceHeart = new DeviceHeart({
                        deviceId : DEVICE_ID,
                        userHash : USER_HASH,
                        state    : STATE,
                        mqtt     : mockMqtt,
                        ttl      : TTL
                    });
                    const EXPECTED_STATE_TOPIC = `${USER_HASH}/sweet-home/${DEVICE_ID}/$state`;
                    const EXPECTED_STATE_VALUE = STATES.READY;

                    deviceHeart.resetTimeout = jest.fn();

                    deviceHeart.start();
                    deviceHeart.doHeartbeatRevision();

                    expect(mockMqtt.publish).toHaveBeenCalledWith(EXPECTED_STATE_TOPIC, EXPECTED_STATE_VALUE);
                    expect(deviceHeart.resetTimeout).toHaveBeenCalled();
                });

            it('should call start method when device heart is not started', () => {
                const DEVICE_ID = 'test-device-id';
                const USER_HASH = 'test-user-hash';
                const STATE = STATES.DISCONNECTED;
                const mockMqtt = new MQTTTransport();
                const TTL = 3000;
                const deviceHeart = new DeviceHeart({
                    deviceId : DEVICE_ID,
                    userHash : USER_HASH,
                    state    : STATE,
                    mqtt     : mockMqtt,
                    ttl      : TTL
                });

                deviceHeart.start = jest.fn();

                deviceHeart.doHeartbeatRevision();

                expect(deviceHeart.start).toHaveBeenCalled();
            });
        });
    });

    describe('setState', () => {
        describe('POSITIVE', () => {
            it('should notify when new states differs from previous and notificator returns message to send', () => {
                const notificator = new Notificator();
                const DEVICE_ID = 'test-device-id';
                const USER_HASH = 'test-user-hash';
                const STATE = STATES.DISCONNECTED;
                const mockMqtt = new MQTTTransport();
                const TTL = 3000;
                const deviceHeart = new DeviceHeart({
                    notificator,
                    deviceId : DEVICE_ID,
                    userHash : USER_HASH,
                    state    : STATE,
                    mqtt     : mockMqtt,
                    ttl      : TTL
                });
                const MESSAGE = 'test-message';

                notificator.getMessage = jest.fn().mockReturnValue(MESSAGE);
                notificator.notify = jest.fn();

                deviceHeart.setState(STATES.READY);

                expect(notificator.notify).toHaveBeenCalledWith(MESSAGE);
            });
        });

        describe('NEGATIVE', () => {
            it('should not notify when new state is equal to previous and notificator returns message to send', () => {
                const notificator = new Notificator();
                const DEVICE_ID = 'test-device-id';
                const USER_HASH = 'test-user-hash';
                const STATE = STATES.DISCONNECTED;
                const mockMqtt = new MQTTTransport();
                const TTL = 3000;
                const deviceHeart = new DeviceHeart({
                    notificator,
                    deviceId : DEVICE_ID,
                    userHash : USER_HASH,
                    state    : STATE,
                    mqtt     : mockMqtt,
                    ttl      : TTL
                });
                const MESSAGE = 'test-message';

                notificator.getMessage = jest.fn().mockReturnValue(MESSAGE);
                notificator.notify = jest.fn();

                deviceHeart.setState(STATE);

                expect(notificator.notify).not.toHaveBeenCalledWith(MESSAGE);
            });
        });
    });
});
