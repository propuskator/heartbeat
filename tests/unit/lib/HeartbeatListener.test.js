jest.mock('homie-sdk/lib/Broker/mqtt');
jest.mock('../../../lib/DeviceHeart');
jest.mock('../../../lib/Notificator');

const EventEmitter = require('events');

const MQTTTransport = require('homie-sdk/lib/Broker/mqtt');

const HeartbeatListener = require('../../../lib/HeartbeatListener');
const DeviceHeart       = require('../../../lib/DeviceHeart');
const Notificator       = require('../../../lib/Notificator');

jest.useFakeTimers();

// partially mocked realization on MQTTTransport to have realization of "on" and "emit" methods
class MockMqtt extends EventEmitter {}

MockMqtt.prototype.connect = jest.fn();
MockMqtt.prototype.subscribe = jest.fn();

describe('HeartbeatListener', () => {
    describe('init', () => {
        describe('POSITIVE', () => {
            it('should connect to mqtt, subscribe to events and wait a while to recieve topics', () => {
                const mockMqtt = new MQTTTransport();
                const INIT_TIME = 1000;
                const HEARTBEAT_TIMEOUT = 30000;
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : mockMqtt,
                    initTime         : INIT_TIME,
                    heartbeatTimeout : HEARTBEAT_TIMEOUT,
                    debug            : { info: jest.fn() }
                });

                const result = heartbeatListener.init();

                jest.advanceTimersByTime(INIT_TIME);

                expect(result).resolves.toBeUndefined();
                expect(mockMqtt.connect).toHaveBeenCalled();
                expect(mockMqtt.on.mock.calls).toEqual(
                    expect.arrayContaining([
                        expect.arrayContaining([ 'connect', expect.any(Function) ]),
                        expect.arrayContaining([ 'error', expect.any(Function) ]),
                        expect.arrayContaining([ 'message', expect.any(Function) ])
                    ])
                );
                expect(mockMqtt.subscribe).toHaveBeenCalledWith(expect.any(Array));
            });
        });
    });

    describe('parseTopic', () => {
        describe('POSITIVE', () => {
            it('should successfully parse a topic', () => {
                const USER_HASH = 'test-user-hash';
                const BASE_TOPIC = 'sweet-home';
                const DEVICE_ID = 'test-device-id';
                const STATE_FIELD = '$state';
                const topic = `${USER_HASH}/${BASE_TOPIC}/${DEVICE_ID}/${STATE_FIELD}`;
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : {},
                    initTime         : 1000,
                    heartbeatTimeout : 30000,
                    debug            : {}
                });

                const result = heartbeatListener.parseTopic(topic);

                expect(result).toBeInstanceOf(Object);
                expect(result).toMatchObject({
                    userHash   : USER_HASH,
                    deviceId   : DEVICE_ID,
                    stateField : STATE_FIELD
                });
            });
        });
    });

    describe('handleStateMessage', () => {
        describe('POSITIVE', () => {
            it('should be called when mqtt client recieve state topic', () => {
                const mockMqtt = new MockMqtt();
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : mockMqtt,
                    initTime         : 1000,
                    heartbeatTimeout : 30000,
                    debug            : {
                        info : jest.fn()
                    }
                });

                heartbeatListener.handleStateMessage = jest.fn();

                const USER_HASH = 'test-user-hash';
                const BASE_TOPIC = 'sweet-home';
                const DEVICE_ID = 'test-device-id';
                const STATE_FIELD = '$state';
                const TOPIC = `${USER_HASH}/${BASE_TOPIC}/${DEVICE_ID}/${STATE_FIELD}`;
                const MESSAGE = 'ready';

                heartbeatListener.init();

                mockMqtt.emit('message', TOPIC, MESSAGE);

                expect(heartbeatListener.handleStateMessage).toHaveBeenCalledWith({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID,
                    message  : MESSAGE
                });
            });

            it('should create and start new device heart when new device state topic received', () => {
                const mockMqtt = new MockMqtt();
                const HEARTBEAT_TIMEOUT = 30000;
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : mockMqtt,
                    initTime         : 1000,
                    heartbeatTimeout : HEARTBEAT_TIMEOUT,
                    debug            : {
                        info : jest.fn()
                    }
                });
                const USER_HASH = 'test-user-hash';
                const DEVICE_ID = 'test-device-id';
                const MESSAGE = 'ready';

                heartbeatListener.handleStateMessage({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID,
                    message  : MESSAGE
                });

                const [ mockDeviceHeartInstance ] = DeviceHeart.mock.instances;
                const [ mockNotificatorInstance ] = Notificator.mock.instances;

                expect(DeviceHeart).toHaveBeenCalledWith({
                    notificator : mockNotificatorInstance,
                    mqtt        : mockMqtt,
                    ttl         : HEARTBEAT_TIMEOUT,
                    state       : MESSAGE,
                    userHash    : USER_HASH,
                    deviceId    : DEVICE_ID
                });
                expect(mockDeviceHeartInstance.start).toHaveBeenCalled();
            });

            it('should stop device heart instance when received device state topic with empty message', () => {
                const mockMqtt = new MockMqtt();
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : mockMqtt,
                    initTime         : 1000,
                    heartbeatTimeout : 30000,
                    debug            : {
                        info : jest.fn()
                    }
                });
                const USER_HASH = 'test-user-hash';
                const DEVICE_ID = 'test-device-id';
                const MESSAGE = 'ready';

                // arrange: create new device heart instance
                heartbeatListener.handleStateMessage({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID,
                    message  : MESSAGE
                });

                // act: call handleStateMessage for existing device heart instance with empty message
                heartbeatListener.handleStateMessage({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID,
                    message  : ''
                });

                const [ mockDeviceHeartInstance ] = DeviceHeart.mock.instances;

                expect(mockDeviceHeartInstance.stop).toHaveBeenCalled();
            });

            it('should update state for device heart instance when received device state topic repeatedly', () => {
                const mockMqtt = new MockMqtt();
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : mockMqtt,
                    initTime         : 1000,
                    heartbeatTimeout : 30000,
                    debug            : {
                        info : jest.fn()
                    }
                });
                const USER_HASH = 'test-user-hash';
                const DEVICE_ID = 'test-device-id';
                const MESSAGE = 'ready';

                // arrange: create new device heart instance
                heartbeatListener.handleStateMessage({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID,
                    message  : MESSAGE
                });

                // act: call handleStateMessage one more time to trigger state updating for created device heart
                heartbeatListener.handleStateMessage({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID,
                    message  : MESSAGE
                });

                const [ mockDeviceHeartInstance ] = DeviceHeart.mock.instances;

                expect(mockDeviceHeartInstance.setState).toHaveBeenCalled();
            });
        });
    });

    describe('handleHeartbeatMessage', () => {
        describe('POSITIVE', () => {
            it('should be called when mqtt client recieve heartbeat topic', () => {
                const mockMqtt = new MockMqtt();
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : mockMqtt,
                    initTime         : 1000,
                    heartbeatTimeout : 30000,
                    debug            : {
                        info : jest.fn()
                    }
                });

                heartbeatListener.handleHeartbeatMessage = jest.fn();

                const USER_HASH = 'test-user-hash';
                const BASE_TOPIC = 'sweet-home';
                const DEVICE_ID = 'test-device-id';
                const HEARTBEAT_FIELD = '$heartbeat';
                const TOPIC = `${USER_HASH}/${BASE_TOPIC}/${DEVICE_ID}/${HEARTBEAT_FIELD}`;
                const MESSAGE = '';

                heartbeatListener.init();

                mockMqtt.emit('message', TOPIC, MESSAGE);

                expect(heartbeatListener.handleHeartbeatMessage).toHaveBeenCalledWith({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID
                });
            });

            it('should call doHeartbeatRevision for existing device heart instance', () => {
                const mockMqtt = new MockMqtt();
                const heartbeatListener = new HeartbeatListener({
                    mqtt             : mockMqtt,
                    initTime         : 1000,
                    heartbeatTimeout : 30000,
                    debug            : {
                        info : jest.fn()
                    }
                });
                const USER_HASH = 'test-user-hash';
                const DEVICE_ID = 'test-device-id';
                const MESSAGE = 'ready';

                // arrange: create new device heart instance
                heartbeatListener.handleStateMessage({
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID,
                    message  : MESSAGE
                });

                heartbeatListener.handleHeartbeatMessage({ userHash: USER_HASH, deviceId: DEVICE_ID });

                const [ mockDeviceHeartInstance ] = DeviceHeart.mock.instances;

                expect(mockDeviceHeartInstance.doHeartbeatRevision).toHaveBeenCalled();
            });
        });
    });
});
