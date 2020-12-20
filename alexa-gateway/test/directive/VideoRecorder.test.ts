import { VideoRecorder } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { resetIotDataPublish } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { callHandler, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockVideoErrorResponse, testPoweredOffEndpoint } from './TestHelper';

describe('VideoRecorder', function () {
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
                case generateReplyTopicName('SearchAndRecord'):
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
                case generateReplyTopicName(mockErrorSuffix):
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
                await setupNotPlayingContent(getContextSandbox(this))
                setupMqttMock(responseMockHandler, getContextSandbox(this), defaultMessageContext)
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
                expect(event)
                    .to.have.property('context')
                    .to.have.property('properties');
            })
            it('should map an error', async function () {
                const messageContext = defaultMessageContext;
                await testMockVideoErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
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