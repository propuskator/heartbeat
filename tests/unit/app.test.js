jest.mock('homie-sdk/lib/Broker/mqtt');
jest.mock('../../lib/HeartbeatListener');
jest.mock('../../lib/utils/Logger', () => {
    return {
        Logger : jest.fn()
    };
});
jest.mock('homie-sdk/lib/utils/debugger');
jest.mock('../../lib/CloudHeartbeat');

const MQTTTransport = require('homie-sdk/lib/Broker/mqtt');
const Debugger      = require('homie-sdk/lib/utils/debugger');

const logger            = require('../../lib/utils/Logger');
const { start }         = require('../../app');
const HeartbeatListener = require('../../lib/HeartbeatListener');
const CloudHeartbeat    = require('../../lib/CloudHeartbeat');

describe('App', () => {
    describe('start', () => {
        describe('POSITIVE', () => {
            it('should init heartbeat listener when config mode is optimized', () => {
                const MODE = 'optimized';
                const MQTT_URI = 'mqtt://test-host';
                const MQTT_USERNAME = 'test-username';
                const MQTT_PASSWORD = 'test-password';
                const DEBUG = '*';
                const HEARTBEAT_TIMEOUT = 1000;
                const config = {
                    mode : MODE,
                    mqtt : {
                        uri      : MQTT_URI,
                        username : MQTT_USERNAME,
                        password : MQTT_PASSWORD
                    },
                    debug     : DEBUG,
                    heartbeat : {
                        timeout : HEARTBEAT_TIMEOUT
                    }
                };
                const mockLoggerInstance = jest.fn();

                logger.Logger.mockReturnValue(mockLoggerInstance);

                start(config);

                const [ mockMqttTransportInstance ] = MQTTTransport.mock.instances;
                const [ mockHeartbeatListenerInstance ] = HeartbeatListener.mock.instances;

                expect(MQTTTransport).toHaveBeenCalledWith({
                    uri      : MQTT_URI,
                    username : MQTT_USERNAME,
                    password : MQTT_PASSWORD
                });
                expect(HeartbeatListener).toHaveBeenCalledWith({
                    mqtt             : mockMqttTransportInstance,
                    heartbeatTimeout : HEARTBEAT_TIMEOUT,
                    debug            : mockLoggerInstance
                });
                expect(mockHeartbeatListenerInstance.init).toHaveBeenCalled();
            });

            it('should init cloud heartbeat when config mode is not optimized', () => {
                const MODE = 'old_homie';
                const MQTT_URI = 'mqtt://test-host';
                const MQTT_USERNAME = 'test-username';
                const MQTT_PASSWORD = 'test-password';
                const DEBUG = '*';
                const HEARTBEAT_TIMEOUT = 1000;
                const config = {
                    mode : MODE,
                    mqtt : {
                        uri      : MQTT_URI,
                        username : MQTT_USERNAME,
                        password : MQTT_PASSWORD
                    },
                    debug     : DEBUG,
                    heartbeat : {
                        timeout : HEARTBEAT_TIMEOUT
                    }
                };

                start(config);

                const [ mockMqttTransportInstance ] = MQTTTransport.mock.instances;
                const [ mockDebuggerInstance ] = Debugger.mock.instances;
                const [ mockCloudHeartbeatInstance ] = CloudHeartbeat.mock.instances;

                expect(MQTTTransport).toHaveBeenCalledWith({
                    uri      : MQTT_URI,
                    username : MQTT_USERNAME,
                    password : MQTT_PASSWORD
                });
                expect(Debugger).toHaveBeenCalledWith(DEBUG);
                expect(mockDebuggerInstance.initEvents).toHaveBeenCalled();
                expect(CloudHeartbeat).toHaveBeenCalledWith({
                    transport        : mockMqttTransportInstance,
                    debug            : mockDebuggerInstance,
                    heartbeatTimeout : HEARTBEAT_TIMEOUT
                });
                expect(mockCloudHeartbeatInstance.init).toHaveBeenCalled();
            });
        });
    });
});
