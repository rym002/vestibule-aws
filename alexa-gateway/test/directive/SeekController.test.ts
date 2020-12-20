import { SeekController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, resetIotDataPublish, vestibuleClientId } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { callHandler, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupPoweredOff, sharedStates, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint } from './TestHelper';

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
    beforeEach(function () {
        const sandbox = createContextSandbox(this)
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context(('connected bridge'), function () {
        const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
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
            if (resp) {
                mqttMock.sendMessage(topic, resp);
            }
        }

        context('AdjustSeekPosition', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                await directiveMocks(sandbox);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing }, localEndpoint, true, vestibuleClientId);
                setupMqttMock(responseMockHandler, sandbox, defaultMessageContext)
            })
            afterEach(function () {
                resetDirectiveMocks()
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
            beforeEach(async function () {
                await setupPoweredOff(getContextSandbox(this));
            })
            afterEach(() => {
                resetDirectiveMocks()
            })
            it('should return NOT_IN_OPERATION', async function () {
                await testPoweredOffEndpoint(defaultMessageContext)
            })

        })
        context('Invalid Endpoint', function () {
            beforeEach(async function () {
                await setupInvalidEndpoint(getContextSandbox(this));
            })
            afterEach(() => {
                resetDirectiveMocks()
            })
            it('should return NO_SUCH_ENDPOINT', async function () {
                await testInvalidEndpoint(defaultMessageContext);
            })
        })
    })
    context(('disconnected bridge'), function () {
        beforeEach(async function () {
            await setupDisconnectedBridge(getContextSandbox(this));
        })
        afterEach(() => {
            resetDirectiveMocks()
        })
        it('should return BRIDGE_UNREACHABLE', async function () {
            await testDisconnectedBridge(defaultMessageContext);
        })
    })

})