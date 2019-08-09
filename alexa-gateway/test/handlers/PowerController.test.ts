import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import * as mqtt from 'mqtt';
import { createSandbox, SinonSpy } from 'sinon';
import wolHandler from '../../src/handlers/WOL';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { callHandler, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupNotPlayingContent, setupPoweredOff, testMockErrorResponse, testSuccessfulMessage, verifyErrorResponse } from './TestHelper';

describe('PowerController', function () {
    const capabilities: EndpointCapability = {
        'Alexa.PowerController': ['powerState']
    }
    const turnOnMessageContext: DirectiveMessageContext = {
        request: {},
        messageSuffix: 'TurnOn',
        header: {
            namespace: 'Alexa.PowerController',
            name: 'TurnOn',
            correlationToken: '123'
        }
    }

    const turnOffMessageContext: DirectiveMessageContext = {
        request: {},
        messageSuffix: 'TurnOff',
        header: {
            namespace: 'Alexa.PowerController',
            name: 'TurnOff',
            correlationToken: '123'
        }
    }
    const eventContext: EventMessageContext = {
        header: {
            namespace: 'Alexa',
            name: 'Response'
        },
        response: {},
        context: []
    }


    const wolSandbox = createSandbox()
    before(function () {
        wolSandbox.stub(wolHandler, 'sendEvent').usingPromise(Promise.resolve());
    })
    after(function () {
        wolSandbox.restore()
    })
    context('TurnOn', function () {
        const messageContext = turnOnMessageContext;
        context('powerState OFF', function () {
            before(async function () {
                await setupPoweredOff(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should call wol', async function () {
                await testSuccessfulMessage(messageContext, eventContext)
                wolSandbox.assert.called(<SinonSpy<any, any>>wolHandler.sendEvent)
            })
        })
        context('powerState ON', function () {
            before(async function () {
                await setupNotPlayingContent(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should error', async function () {
                const ret = await callHandler(messageContext, '');
                verifyErrorResponse(ret, {
                    errorType: 'Alexa',
                    errorPayload: {
                        type: 'INVALID_VALUE',
                        message: 'Endpoint is ON'
                    }
                }, '');
            })
        })
    })

    context('TurnOff', function () {
        const messageContext = turnOffMessageContext;
        context('powerState OFF', function () {
            before(async function () {
                await setupPoweredOff(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should fail', async function () {
                const ret = await callHandler(messageContext, '');
                verifyErrorResponse(ret, {
                    errorType: 'Alexa',
                    errorPayload: {
                        type: 'INVALID_VALUE',
                        message: 'Endpoint is OFF'
                    }
                }, '');

            })
        })
        context('powerState ON', function () {
            const sandbox = createSandbox()
            before(function () {
                mockMqtt((topic, mqttMock) => {
                    let resp: ResponseMessage<any> | undefined;
                    switch (topic) {
                        case generateReplyTopicName('TurnOff'):
                            resp = {
                                payload: {},
                                error: false
                            }
                            break;
                        case generateReplyTopicName(mockErrorSuffix):
                            resp = {
                                payload: errors.bridgeError,
                                error: true
                            }
                            break;
                    }
                    if (resp && 'string' == typeof topic) {
                        mqttMock.sendMessage(topic, resp);
                    }
                }, sandbox)
            })
            after(function () {
                sandbox.restore()
            })
            before(async function () {
                await setupNotPlayingContent(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('should map an error', async function () {
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })

        })
    })
})