/* eslint-disable indent */

jest.mock('homie-sdk/lib/Broker/mqtt');

const MQTTTransport = require('homie-sdk/lib/Broker/mqtt');

const { STATES: { LOST, DISCONNECTED, READY } } = require('../../../lib/constants/devices');
const Notificator                               = require('../../../lib/Notificator');

describe('Notificator', () => {
    describe('getMessage', () => {
        describe('POSITIVE', () => {
            it.each`
                prevState        | nextState              | expected
                ${READY}         | ${LOST}                | ${'Device was lost'}
                ${LOST}          | ${READY}               | ${'Device is ready'}
                ${READY}         | ${DISCONNECTED}        | ${'Device was disconnected'}
                ${READY}         | ${READY}               | ${''}
                ${LOST}          | ${LOST}                | ${''}
                ${DISCONNECTED}  | ${DISCONNECTED}        | ${''}
            `('returns "$expected" when prevState is "$prevState" and nextState is "$nextState"',
                ({ prevState, nextState, expected }) => {
                    const notificator = new Notificator({
                        mqtt     : {},
                        userHash : 'test-user-hash',
                        deviceId : 'test-device-id'
                    });

                    const message = notificator.getMessage({ prevState, nextState });

                    expect(message).toBe(expected);
                }
            );
        });
    });

    describe('notify', () => {
        describe('POSITIVE', () => {
            it('should publish message to broker', () => {
                const mockMqtt = new MQTTTransport();
                const USER_HASH = 'test-user-hash';
                const DEVICE_ID = 'test-device-id';
                const notificator = new Notificator({
                    mqtt     : mockMqtt,
                    userHash : USER_HASH,
                    deviceId : DEVICE_ID
                });
                const MESSAGE = 'test-message';

                notificator.notify(MESSAGE);

                expect(mockMqtt.publish).toHaveBeenCalledWith(
                    expect.stringMatching(new RegExp(`${USER_HASH}/notifications/[^/]+/create`)),
                    JSON.stringify({
                        type       : 'text',
                        senderType : 'heartbeat',
                        senderId   : DEVICE_ID,
                        logLevel   : 'info',
                        message    : MESSAGE
                    }),
                    { retain: false }
                );
            });
        });
    });
});
