import { PlaybackController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { createSandbox } from 'sinon';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, resetIotDataPublish, vestibuleClientId } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { DirectiveMessageContext, emptyParameters, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupPoweredOff, sharedStates, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint, testStoppedEndpoint, testSuccessfulMessage } from './TestHelper';

describe('PlaybackController', function () {
    const capabilities: EndpointCapability = {
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
                value: { state: state }
            }]
        }
    }
    context(('connected bridge'), function () {
        const sandbox = createSandbox()
        const responseMockHandler = (topic: string | string[], mqttMock: MockMqttOperations) => {
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
                                playbackState: { state: 'PLAYING' }
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
                                playbackState: { state: 'PAUSED' }
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
                                playbackState: { state: 'STOPPED' }
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
        }
        afterEach(function () {
            sandbox.restore()
            resetIotDataPublish()
        })

        context('PLAYING', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing }, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('Play should not sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Pause should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PAUSED');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('STOPPED');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
            })
        })

        context('PAUSED', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.paused }, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('Play should sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Pause should not send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PAUSED');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('STOPPED');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
            })

        })
        context('STOPPED', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.stopped }, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('Play should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                testStoppedEndpoint(messageContext);
            })
            it('Pause should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                testStoppedEndpoint(messageContext);
            })
            it('Stop should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                testStoppedEndpoint(messageContext);
            })
            it('StartOver should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                testStoppedEndpoint(messageContext);
            })
            it('FastForward should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                testStoppedEndpoint(messageContext);
            })
            it('Next should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                testStoppedEndpoint(messageContext);
            })
            it('Previous should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                testStoppedEndpoint(messageContext);
            })
            it('Rewind should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                testStoppedEndpoint(messageContext);
            })

        })
        context('Power Off', function () {
            before(async function () {
                await setupPoweredOff();
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
                await setupInvalidEndpoint();
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
            await setupDisconnectedBridge();
        })
        after(() => {
            resetDirectiveMocks()
        })
        it('should return BRIDGE_UNREACHABLE', async function () {
            await testDisconnectedBridge(defaultMessageContext);
        })
    })
})