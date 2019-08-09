import { PlaybackController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import * as mqtt from 'mqtt';
import { createSandbox, SinonSpy } from 'sinon';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, emptyParameters, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupPoweredOff, sharedStates, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint, testStoppedEndpoint, testSuccessfulMessage } from './TestHelper';

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
                value: state
            }]
        }
    }
    context(('connected bridge'), function () {
        const sandbox = createSandbox()
        beforeEach(function () {
            mockMqtt((topic, mqttMock) => {
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
            }, sandbox)
        })
        afterEach(function () {
            sandbox.restore()
        })

        context('PLAYING', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing }, capabilities, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('Play should not sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.notCalled(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Pause should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
        })

        context('PAUSED', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.paused }, capabilities, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('Play should sent a message', async function () {
                const messageContext = getDirectiveMessageContext('Play');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Pause should not send a message', async function () {
                const messageContext = getDirectiveMessageContext('Pause');
                const eventContext = getEventMessageContent('PAUSED');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.notCalled(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Stop should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Stop');
                const eventContext = getEventMessageContent('STOPPED');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('StartOver should send a message', async function () {
                const messageContext = getDirectiveMessageContext('StartOver');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('FastForward should send a message', async function () {
                const messageContext = getDirectiveMessageContext('FastForward');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Next should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Next');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Previous should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Previous');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('Rewind should send a message', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                const eventContext = getEventMessageContent('PLAYING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('Rewind');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })

        })
        context('STOPPED', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.stopped }, capabilities, localEndpoint, true, vestibuleClientId);
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