import { VideoRecorder } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert, expect } from 'chai';
import 'mocha';
import { SinonStub } from 'sinon';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { callHandler, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockVideoErrorResponse, testPoweredOffEndpoint } from './TestHelper';

describe('VideoRecorder', () => {
    const capabilitites: EndpointCapability = {
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

    context(('connected bridge'), () => {
        let mqttSave: SinonStub<any[], any>;
        beforeEach(() => {
            mqttSave = mockMqtt((topic, mqttMock) => {
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
                if (resp && 'string' == typeof topic) {
                    mqttMock.sendMessage(topic, resp);
                }
            })
        })
        afterEach(() => {
            mqttSave.restore()
        })
        context('SearchAndRecord', () => {
            before(async () => {
                await setupNotPlayingContent(capabilitites)
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('should send a message', async () => {
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
                assert(mqttSave.called)
            })
            it('should map an error', async () => {
                const messageContext = defaultMessageContext;
                await testMockVideoErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                assert(mqttSave.called)
            })

        })
        context('Power Off', () => {
            before(async () => {
                await setupPoweredOff(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('should return NOT_IN_OPERATION', async () => {
                await testPoweredOffEndpoint(defaultMessageContext)
            })

        })
        context('Invalid Endpoint', () => {
            before(async () => {
                await setupInvalidEndpoint(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('should return NO_SUCH_ENDPOINT', async () => {
                await testInvalidEndpoint(defaultMessageContext);
            })
        })
    })
    context(('disconnected bridge'), () => {
        before(async () => {
            await setupDisconnectedBridge(capabilitites);
        })
        after((done) => {
            resetDirectiveMocks()
        })
        it('should return BRIDGE_UNREACHABLE', async () => {
            await testDisconnectedBridge(defaultMessageContext);
        })
    })

})