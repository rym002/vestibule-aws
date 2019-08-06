import { ChannelController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert } from 'chai';
import 'mocha';
import { SinonStub } from 'sinon';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupNotWatchingTv, setupPoweredOff, setupWatchingTv, sharedStates, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testNotWatchingTvEndpoint, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('ChannelController', () => {
    const skipChannelsHeader = {
        namespace: 'Alexa.ChannelController',
        name: 'SkipChannels',
        correlationToken: '123'
    }

    const changeChannelHeader = {
        namespace: 'Alexa.ChannelController',
        name: 'ChangeChannel',
        correlationToken: '123'
    }
    const changeChannelRequest: ChannelController.ChangeChannelRequest = {
        channel: {
            number: '1',
            callSign: "CALL"
        }
    }
    const skipChannelsRequest: ChannelController.SkipChannelsRequest = {
        channelCount: 1
    }

    const capabilitites: EndpointCapability = {
        "Alexa.ChannelController": ['channel']
    }
    const changeChannelMessageSuffix = 'changeChannel';
    const skipChannelsMessageSuffix = 'skipChannels'
    const skipChannelsContext: DirectiveMessageContext = {
        request: skipChannelsRequest,
        messageSuffix: skipChannelsMessageSuffix,
        header: skipChannelsHeader
    }

    const changeChannelContext: DirectiveMessageContext = {
        request: changeChannelRequest,
        messageSuffix: changeChannelMessageSuffix,
        header: changeChannelHeader
    }

    const eventContext: EventMessageContext = {
        context: [{
            namespace: 'Alexa.ChannelController',
            name: 'channel',
            value: sharedStates.channel['Alexa.ChannelController']!.channel!
        }],
        header: {
            namespace: 'Alexa',
            name: 'Response'
        },
        response: {}
    }

    context(('connected bridge'), () => {
        let mqttSave: SinonStub<any[], any>;
        beforeEach(() => {
            mqttSave = mockMqtt((topic, mqttMock) => {
                let resp: ResponseMessage<any> | undefined;
                const channelTopic = generateReplyTopicName(changeChannelMessageSuffix);
                const skipTopic = generateReplyTopicName(skipChannelsMessageSuffix);
                if (topic == channelTopic
                    || topic == skipTopic) {
                    resp = {
                        payload: {},
                        stateChange: {
                            'Alexa.ChannelController': changeChannelRequest
                        },
                        error: false
                    }
                } else if (topic == generateReplyTopicName(mockErrorSuffix)) {
                    resp = {
                        payload: errors.bridgeError,
                        error: true
                    }

                }
                if (resp && 'string' == typeof topic) {
                    mqttMock.sendMessage(topic, resp);
                }
            })
        })
        afterEach(() => {
            mqttSave.restore()
        })

        context('Watching TV', () => {
            before(async () => {
                await setupWatchingTv(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            context('SkipChannels', () => {
                const messageContext = skipChannelsContext;
                it('should send a request to change channel', async () => {
                    await testSuccessfulMessage(messageContext, eventContext)
                    assert(mqttSave.called)
                })
                it('should map an error', async () => {
                    await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                    assert(mqttSave.called)
                })
            })
            context('ChangeChannel', () => {
                const messageContext = changeChannelContext;
                it('should change channel if not on the current channel', async () => {
                    await testSuccessfulMessage(messageContext, eventContext)
                    assert(mqttSave.called)
                })
                it('should return success if its on the same channel', async () => {
                    await testSuccessfulMessage({
                        ...messageContext,
                        request: {
                            channel: sharedStates.channel['Alexa.ChannelController']!.channel!
                        }
                    }, eventContext)
                    assert(mqttSave.notCalled)
                })
                it('should map an error', async () => {
                    await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                    assert(mqttSave.called)
                })
            })
        })
        context('Not Watching TV', () => {
            before(async () => {
                await setupNotWatchingTv(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            context('SkipChannels', () => {
                const messageContext = skipChannelsContext;
                it('should return NOT_SUPPORTED_IN_CURRENT_MODE', async () => {
                    await testNotWatchingTvEndpoint(messageContext);
                })
            })
            context('ChangeChannel', () => {
                const messageContext = changeChannelContext;
                it('should send a message', async () => {
                    await testSuccessfulMessage(messageContext, eventContext)
                    assert(mqttSave.called)
                })

            })
        })
        context('Power Off', () => {
            before(async () => {
                await setupPoweredOff(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            context('SkipChannels', () => {
                const messageContext = skipChannelsContext;
                it('should return NOT_IN_OPERATION', async () => {
                    await testPoweredOffEndpoint(messageContext)
                })
            })
            context('ChangeChannel', () => {
                const messageContext = changeChannelContext;
                it('should return NOT_IN_OPERATION', async () => {
                    await testPoweredOffEndpoint(messageContext)
                })

            })

        })
        context('Invalid Endpoint', () => {
            before(async () => {
                await setupInvalidEndpoint(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            context('SkipChannels', () => {
                const messageContext = skipChannelsContext;
                it('should return NO_SUCH_ENDPOINT', async () => {
                    await testInvalidEndpoint(messageContext);
                })
            })
            context('ChangeChannel', () => {
                const messageContext = changeChannelContext;
                it('should return NO_SUCH_ENDPOINT', async () => {
                    await testInvalidEndpoint(messageContext);
                })
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
        context('SkipChannels', () => {
            const messageContext = skipChannelsContext;
            it('should return BRIDGE_UNREACHABLE', async () => {
                await testDisconnectedBridge(messageContext);
            })
        })
        context('ChangeChannel', () => {
            const messageContext = changeChannelContext;
            it('should return BRIDGE_UNREACHABLE', async () => {
                await testDisconnectedBridge(messageContext);
            })

        })
    })
})
