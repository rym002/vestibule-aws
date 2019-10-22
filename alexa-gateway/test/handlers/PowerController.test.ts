import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { createSandbox, SinonSpy } from 'sinon';
import wolHandler from '../../src/handlers/WOL';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { resetIotDataPublish } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { callHandler, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testMockErrorResponse, testSuccessfulMessage, verifyErrorResponse } from './TestHelper';

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
                await setupPoweredOff();
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
                await setupNotPlayingContent();
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
                await setupPoweredOff();
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
            const responseMockHandler = (topic: string | string[], mqttMock: MockMqttOperations) => {
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
            }
            after(function () {
                resetDirectiveMocks()
            })
            before(async function () {
                await setupNotPlayingContent();
            })
            beforeEach(function () {
                setupMqttMock(responseMockHandler, sandbox, messageContext)
            })
            afterEach(function () {
                resetIotDataPublish()
                sandbox.restore()
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('should map an error', async function () {
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
            })

        })
    })
})