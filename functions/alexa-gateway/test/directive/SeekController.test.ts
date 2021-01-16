import { SeekController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { getContextSandbox } from '../mocks/Sandbox';
import { directiveMocks } from '../mocks/DirectiveMocks';
import { MockMqttOperations } from '../mocks/MqttMock';
import { callHandler, connectedEndpointId, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupPoweredOff, sharedStates, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint } from './TestHelper';
import { mockEndpointState } from '../mocks/StateMocks'
describe('SeekController', function () {
    const clientId = 'SeekController'
    const capabilities: EndpointCapability = {
        'Alexa.SeekController': true
    }
    const defaultMessageContext: DirectiveMessageContext = {
        request: <SeekController.RequestPayload>{
            deltaPositionMilliseconds: 1000
        },
        messageSuffix: 'AdjustSeekPosition',
        header: {
            namespace: 'Alexa.SeekController',
            name: 'AdjustSeekPosition',
            correlationToken: '123'
        }
    }
    const eventContext: EventMessageContext = {
        header: {
            namespace: 'Alexa.SeekController',
            name: 'StateReport'
        },
        context: [],
        response: {
            properties: [{
                name: 'positionMilliseconds',
                value: 2000
            }]
        }
    }
    context(('connected bridge'), function () {
        const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
                case generateReplyTopicName('AdjustSeekPosition', clientId):
                    resp = {
                        payload: eventContext.response,
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

        context('AdjustSeekPosition', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                await directiveMocks(sandbox);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing }, connectedEndpointId, true, clientId);
                setupMqttMock(responseMockHandler, sandbox, defaultMessageContext, clientId)
            })

            it('should send a message', async function () {
                const event = await callHandler(defaultMessageContext, connectedEndpointId, clientId);
                expect(event)
                    .to.have.property('event')
                    .to.have.property('header')
                    .to.have.property('namespace', eventContext.header.namespace);
                expect(event)
                    .to.have.property('event')
                    .to.have.property('header')
                    .to.have.property('name', eventContext.header.name);
                expect(event)
                    .to.have.property('event')
                    .to.have.property('payload').eql(eventContext.response);
            })
            it('should map an error', async function () {
                const messageContext = defaultMessageContext
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix }, clientId);
            })
        })
        context('Power Off', function () {
            beforeEach(async function () {
                await setupPoweredOff(getContextSandbox(this), clientId);
            })
            it('should return NOT_IN_OPERATION', async function () {
                await testPoweredOffEndpoint(defaultMessageContext, clientId)
            })

        })
        context('Invalid Endpoint', function () {
            beforeEach(async function () {
                await setupInvalidEndpoint(getContextSandbox(this), clientId);
            })
            it('should return NO_SUCH_ENDPOINT', async function () {
                await testInvalidEndpoint(defaultMessageContext, clientId);
            })
        })
    })
    context(('disconnected bridge'), function () {
        beforeEach(async function () {
            await setupDisconnectedBridge(getContextSandbox(this), clientId);
        })
        it('should return BRIDGE_UNREACHABLE', async function () {
            await testDisconnectedBridge(defaultMessageContext, clientId);
        })
    })

})