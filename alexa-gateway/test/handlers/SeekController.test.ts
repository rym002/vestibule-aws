import { SeekController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, resetIotDataPublish, vestibuleClientId } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { callHandler, DirectiveMessageContext, emptyParameters, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupPoweredOff, sharedStates, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint } from './TestHelper';

describe('SeekController', function () {
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
        const sandbox = createSandbox()
        const responseMockHandler = (topic: string | string[], mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
                case generateReplyTopicName('AdjustSeekPosition'):
                    resp = {
                        payload: eventContext.response,
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
        afterEach(function () {
            sandbox.restore()
        })

        context('AdjustSeekPosition', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing }, capabilities, localEndpoint, true, vestibuleClientId);

            })
            after(() => {
                resetDirectiveMocks()
            })
            beforeEach(function () {
                setupMqttMock(responseMockHandler, sandbox, defaultMessageContext)
            })
            afterEach(function () {
                resetIotDataPublish()
            })

            it('should send a message', async function () {
                const event = await callHandler(defaultMessageContext, '');
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
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
            })
        })
        context('Power Off', function () {
            before(async function () {
                await setupPoweredOff(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should return NOT_IN_OPERATION', async function () {
                await testPoweredOffEndpoint(defaultMessageContext)
            })

        })
        context('Invalid Endpoint', function () {
            before(async function () {
                await setupInvalidEndpoint(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should return NO_SUCH_ENDPOINT', async function () {
                await testInvalidEndpoint(defaultMessageContext);
            })
        })
    })
    context(('disconnected bridge'), function () {
        before(async function () {
            await setupDisconnectedBridge(capabilities);
        })
        after(() => {
            resetDirectiveMocks()
        })
        it('should return BRIDGE_UNREACHABLE', async function () {
            await testDisconnectedBridge(defaultMessageContext);
        })
    })

})