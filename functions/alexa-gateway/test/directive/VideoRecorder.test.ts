import { VideoRecorder } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { getContextSandbox } from '../mocks/Sandbox';
import { MockMqttOperations } from '../mocks/MqttMock';
import { callHandler, connectedEndpointId, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockVideoErrorResponse, testPoweredOffEndpoint } from './TestHelper';

describe('VideoRecorder', function () {
    const clientId = 'VideoRecorder'
    const capabilities: EndpointCapability = {
        'Alexa.VideoRecorder': true
    }
    const req: VideoRecorder.RequestPayload = {
        entities: [{
            type: 'Genre',
            value: 'test',
            externalIds: {}
        }],
        quantifier: {
            name: 'ALL'
        },
        timeWindow: {
            start: new Date(),
            end: new Date()
        }
    }
    const defaultMessageContext: DirectiveMessageContext = {
        request: req,
        messageSuffix: 'SearchAndRecord',
        header: {
            namespace: 'Alexa.VideoRecorder',
            name: 'SearchAndRecord',
            correlationToken: '123'
        }
    }

    const eventContext: EventMessageContext = {
        header: {
            namespace: 'Alexa.VideoRecorder',
            name: 'Alexa.SearchAndRecordResponse'
        },
        response: {
            recordingStatus: 'SCHEDULED'
        },
        context: []
    }

    context(('connected bridge'), function () {
        const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
                case generateReplyTopicName('SearchAndRecord', clientId):
                    resp = {
                        payload: {
                            recordingStatus: 'SCHEDULED'
                        },
                        stateChange: {
                            'Alexa.VideoRecorder': {
                                isExtendedRecordingGUIShown: false,
                                storageLevel: 10
                            }
                        },
                        error: false
                    }
                    break;
                case generateReplyTopicName(mockErrorSuffix, clientId):
                    resp = {
                        payload: errors.videoError,
                        error: true
                    }
                    break;
            }
            if (resp) {
                mqttMock.sendMessage(topic, resp);
            }
        }
        context('SearchAndRecord', function () {
            beforeEach(async function () {
                await setupNotPlayingContent(getContextSandbox(this), clientId)
                setupMqttMock(responseMockHandler, getContextSandbox(this), defaultMessageContext, clientId)
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
                expect(event)
                    .to.have.property('context')
                    .to.have.property('properties');
            })
            it('should map an error', async function () {
                const messageContext = defaultMessageContext;
                await testMockVideoErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix }, clientId);
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