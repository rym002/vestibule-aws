import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { SinonSpy } from 'sinon';
import { getContextSandbox } from '../mocks/Sandbox';
import wolHandler from '../../src/directive/WOL';
import { MockMqttOperations } from '../mocks/MqttMock';
import { callHandler, connectedEndpointId, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testMockErrorResponse, testSuccessfulMessage, verifyErrorResponse } from './TestHelper';

describe('PowerController', function () {
    const clientId = 'PowerController'
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
        const sandbox = getContextSandbox(this)
        sandbox.stub(wolHandler, 'sendEvent').usingPromise(Promise.resolve());
    })
    context('TurnOn', function () {
        const messageContext = turnOnMessageContext;
        context('powerState OFF', function () {
            beforeEach(async function () {
                await setupPoweredOff(getContextSandbox(this), clientId);
            })
            it('should call wol', async function () {
                await testSuccessfulMessage(messageContext, eventContext, clientId)
                getContextSandbox(this).assert.called(<SinonSpy<any, any>>wolHandler.sendEvent)
            })
        })
        context('powerState ON', function () {
            beforeEach(async function () {
                await setupNotPlayingContent(getContextSandbox(this), clientId);
            })
            it('should error', async function () {
                const ret = await callHandler(messageContext, connectedEndpointId, clientId);
                verifyErrorResponse(ret, {
                    errorType: 'Alexa',
                    errorPayload: {
                        type: 'INVALID_VALUE',
                        message: 'Endpoint is ON'
                    }
                }, connectedEndpointId);
            })
        })
    })

    context('TurnOff', function () {
        const messageContext = turnOffMessageContext;
        context('powerState OFF', function () {
            beforeEach(async function () {
                await setupPoweredOff(getContextSandbox(this), clientId);
            })
            it('should fail', async function () {
                const ret = await callHandler(messageContext, connectedEndpointId, clientId);
                verifyErrorResponse(ret, {
                    errorType: 'Alexa',
                    errorPayload: {
                        type: 'INVALID_VALUE',
                        message: 'Endpoint is OFF'
                    }
                }, connectedEndpointId);

            })
        })
        context('powerState ON', function () {
            const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
                let resp: ResponseMessage<any> | undefined;
                switch (topic) {
                    case generateReplyTopicName('TurnOff', clientId):
                        resp = {
                            payload: {},
                            error: false
                        }
                        break;
                    case generateReplyTopicName(mockErrorSuffix, clientId):
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
                await setupNotPlayingContent(getContextSandbox(this), clientId);
                setupMqttMock(responseMockHandler, getContextSandbox(this), messageContext, clientId)
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('should map an error', async function () {
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix }, clientId);
            })

        })
    })
})