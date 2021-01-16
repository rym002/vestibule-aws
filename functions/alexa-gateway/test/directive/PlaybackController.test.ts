import { PlaybackController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, EndpointState, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { getContextSandbox } from '../mocks/Sandbox';
import { directiveMocks } from '../mocks/DirectiveMocks';
import { MockMqttOperations } from '../mocks/MqttMock';
import { connectedEndpointId, DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupPoweredOff, sharedStates, testAsyncShadowMessage, testAsyncShadowNoUpdateMessage, testDisconnectedBridge, testInvalidEndpoint, testPoweredOffEndpoint, testStoppedEndpoint, testSuccessfulMessage } from './TestHelper';
import { mockEndpointState } from '../mocks/StateMocks'

describe('PlaybackController', function () {
    const clientId = 'PlaybackController'
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
    beforeEach(async function () {
        const sandbox = getContextSandbox(this)
        await directiveMocks(sandbox);
    })
    context(('connected bridge'), function () {
        const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
                case generateReplyTopicName('StartOver', clientId):
                case generateReplyTopicName('FastForward', clientId):
                case generateReplyTopicName('Next', clientId):
                case generateReplyTopicName('Previous', clientId):
                case generateReplyTopicName('Rewind', clientId):
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

        context('PLAYING', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing }, connectedEndpointId, true, clientId);
            })
            it('Play should not sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowNoUpdateMessage(sandbox, messageContext, eventContext, clientId)
            })
            it('Pause should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('PAUSED'), clientId)
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('STOPPED'), clientId)
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
        })

        context('PAUSED', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.paused }, connectedEndpointId, true, clientId);
            })
            it('Play should sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('PLAYING'), clientId)
            })
            it('Pause should not send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowNoUpdateMessage(sandbox, messageContext, eventContext, clientId)
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('STOPPED'), clientId)
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                const sandbox = getContextSandbox(this);
                setupMqttMock(responseMockHandler, sandbox, messageContext, clientId)
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })
        })
        context('STOPPED', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.stopped }, connectedEndpointId, true, clientId);
            })
            it('Play should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                testStoppedEndpoint(messageContext, clientId);
            })
            it('Pause should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                testStoppedEndpoint(messageContext, clientId);
            })
            it('Stop should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                testStoppedEndpoint(messageContext, clientId);
            })
            it('StartOver should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                testStoppedEndpoint(messageContext, clientId);
            })
            it('FastForward should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                testStoppedEndpoint(messageContext, clientId);
            })
            it('Next should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                testStoppedEndpoint(messageContext, clientId);
            })
            it('Previous should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                testStoppedEndpoint(messageContext, clientId);
            })
            it('Rewind should return Content is stopped', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                testStoppedEndpoint(messageContext, clientId);
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