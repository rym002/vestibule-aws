import { assert } from 'chai';
import 'mocha';
import { setupDisconnectedBridge, testDisconnectedBridge, DirectiveMessageContext, setupInvalidEndpoint, testInvalidEndpoint, testPoweredOffEndpoint, setupPoweredOff, sharedStates, generateReplyTopicName, mockErrorSuffix, errors, testSuccessfulMessage, EventMessageContext, testStoppedEndpoint, testMockErrorResponse } from './TestHelper';
import { resetDirectiveMocks, directiveMocks, mockEndpointState } from '../mock/DirectiveMocks';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';
import { SinonStub } from 'sinon';
import { mockMqtt } from '../mock/MqttMock';
import { PlaybackController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';

describe('PlaybackController', () => {
    const capabilitites: EndpointCapability = {
        "Alexa.PlaybackController": ["FastForward", "Next", "Pause", "Play", "Previous", "Rewind", "StartOver", "Stop"]
    }

    const defaultMessageContext: DirectiveMessageContext = {
        request: {},
        messageSuffix: '',
        header: {
            namespace: 'Alexa.PlaybackController',
            correlationToken: '123'
        }
    }

    function getDirectiveMessageContext(name: PlaybackController.Operations): DirectiveMessageContext {
        return {
            ...defaultMessageContext, header: {
                namespace: 'Alexa.PlaybackController',
                name: name
            },
            messageSuffix: name
        }
    }

    function getEventMessageContent(state: PlaybackStateReporter.States): EventMessageContext {
        return {
            header: {
                namespace: 'Alexa',
                name: 'Response'
            },
            response: {},
            context: [{
                namespace: 'Alexa.PlaybackStateReporter',
                name: 'playbackState',
                value: state
            }]
        }
    }
    context(('connected bridge'), () => {
        let mqttSave: SinonStub<any[], any>;
        beforeEach(() => {
            mqttSave = mockMqtt((topic, mqttMock) => {
                let resp: ResponseMessage<any> | undefined;
                switch (topic) {
                    case generateReplyTopicName('Play'):
                    case generateReplyTopicName('StartOver'):
                    case generateReplyTopicName('FastForward'):
                    case generateReplyTopicName('Next'):
                    case generateReplyTopicName('Previous'):
                    case generateReplyTopicName('Rewind'):
                        resp = {
                            payload: {},
                            stateChange: {
                                'Alexa.PlaybackStateReporter': {
                                    playbackState: 'PLAYING'
                                }
                            },
                            error: false
                        }
                        break;
                    case generateReplyTopicName('Pause'):
                        resp = {
                            payload: {},
                            stateChange: {
                                'Alexa.PlaybackStateReporter': {
                                    playbackState: 'PAUSED'
                                }
                            },
                            error: false
                        }
                        break;
                    case generateReplyTopicName('Stop'):
                        resp = {
                            payload: {},
                            stateChange: {
                                'Alexa.PlaybackStateReporter': {
                                    playbackState: 'STOPPED'
                                }
                            },
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
            })
        })
        afterEach(() => {
            mqttSave.restore()
        })

        context('PLAYING', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing }, capabilitites, localEndpoint, true, vestibuleClientId);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('Play should not sent a message', async () => {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.notCalled)
            })
            it('Pause should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Stop should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('StartOver should send a message', async () => {
                const messageContext = getDirectiveMessageContext('StartOver');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('FastForward should send a message', async () => {
                const messageContext = getDirectiveMessageContext('FastForward');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Next should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Next');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Previous should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Previous');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Rewind should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Rewind');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('should map an error', async () => {
                const messageContext = getDirectiveMessageContext('Rewind');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                assert(mqttSave.called)
            })
        })

        context('PAUSED', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.paused }, capabilitites, localEndpoint, true, vestibuleClientId);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('Play should sent a message', async () => {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Pause should not send a message', async () => {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.notCalled)
            })
            it('Stop should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('StartOver should send a message', async () => {
                const messageContext = getDirectiveMessageContext('StartOver');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('FastForward should send a message', async () => {
                const messageContext = getDirectiveMessageContext('FastForward');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Next should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Next');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Previous should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Previous');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('Rewind should send a message', async () => {
                const messageContext = getDirectiveMessageContext('Rewind');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('should map an error', async () => {
                const messageContext = getDirectiveMessageContext('Rewind');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                assert(mqttSave.called)
            })

        })
        context('STOPPED', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.stopped }, capabilitites, localEndpoint, true, vestibuleClientId);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('Play should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('Play');
                testStoppedEndpoint(messageContext);
            })
            it('Pause should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('Pause');
                testStoppedEndpoint(messageContext);
            })
            it('Stop should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('Stop');
                testStoppedEndpoint(messageContext);
            })
            it('StartOver should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('StartOver');
                testStoppedEndpoint(messageContext);
            })
            it('FastForward should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('FastForward');
                testStoppedEndpoint(messageContext);
            })
            it('Next should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('Next');
                testStoppedEndpoint(messageContext);
            })
            it('Previous should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('Previous');
                testStoppedEndpoint(messageContext);
            })
            it('Rewind should return Content is stopped', async () => {
                const messageContext = getDirectiveMessageContext('Rewind');
                testStoppedEndpoint(messageContext);
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