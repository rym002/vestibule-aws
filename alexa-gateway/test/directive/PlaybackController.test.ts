import { PlaybackController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, EndpointState, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, resetIotDataPublish, resetIotDataUpdateThingShadow, vestibuleClientId } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupPoweredOff, sharedStates, testAsyncShadowMessage, testAsyncShadowNoUpdateMessage, testDisconnectedBridge, testInvalidEndpoint, testPoweredOffEndpoint, testStoppedEndpoint, testSuccessfulMessage } from './TestHelper';

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
    function getDesiredState(state: PlaybackStateReporter.States): EndpointState {
        return {
            'Alexa.PlaybackStateReporter': {
                playbackState: {
                    state: state
                }
            }
        }
    }
    beforeEach(async function(){
        const sandbox = createContextSandbox(this)
        await directiveMocks(sandbox);
    })
    afterEach(function(){
        resetDirectiveMocks()
        restoreSandbox(this)
    })
    context(('connected bridge'), function () {
        const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
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
        afterEach(function () {
            resetIotDataPublish()
            resetIotDataUpdateThingShadow()
        })

        context('PLAYING', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing }, localEndpoint, true, vestibuleClientId);
            })
            it('Play should not sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowNoUpdateMessage(sandbox, messageContext, eventContext)
            })
            it('Pause should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('PAUSED'))
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('STOPPED'))
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
        })

        context('PAUSED', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.paused }, localEndpoint, true, vestibuleClientId);
            })
            it('Play should sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('PLAYING'))
            })
            it('Pause should not send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowNoUpdateMessage(sandbox, messageContext, eventContext)
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('STOPPED'))
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
        })
        context('STOPPED', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.stopped }, localEndpoint, true, vestibuleClientId);
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