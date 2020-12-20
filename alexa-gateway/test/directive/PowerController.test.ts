import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { SinonSpy } from 'sinon';
import wolHandler from '../../src/directive/WOL';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { resetIotDataPublish } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
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


    beforeEach(function () {
        const sandbox = createContextSandbox(this)
        sandbox.stub(wolHandler, 'sendEvent').usingPromise(Promise.resolve());
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context('TurnOn', function () {
        const messageContext = turnOnMessageContext;
        context('powerState OFF', function () {
            beforeEach(async function () {
                await setupPoweredOff(getContextSandbox(this));
            })
            afterEach(() => {
                resetDirectiveMocks()
            })
            it('should call wol', async function () {
                await testSuccessfulMessage(messageContext, eventContext)
                getContextSandbox(this).assert.called(<SinonSpy<any, any>>wolHandler.sendEvent)
            })
        })
        context('powerState ON', function () {
            beforeEach(async function () {
                await setupNotPlayingContent(getContextSandbox(this));
            })
            afterEach(() => {
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
            beforeEach(async function () {
                await setupPoweredOff(getContextSandbox(this));
            })
            afterEach(() => {
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
            const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
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
                if (resp) {
                    mqttMock.sendMessage(topic, resp);
                }
            }
            beforeEach(async function () {
                await setupNotPlayingContent(getContextSandbox(this));
                setupMqttMock(responseMockHandler, getContextSandbox(this), messageContext)
            })
            afterEach(function () {
                resetIotDataPublish()
                resetDirectiveMocks()
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