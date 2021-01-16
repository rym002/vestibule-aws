import { RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { getContextSandbox } from '../mocks/Sandbox';
import { MockMqttOperations } from '../mocks/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('RemoteVideoPlayer', function () {
    const clientId = 'ChannelController'
    const capabilities: EndpointCapability = {
        'Alexa.RemoteVideoPlayer': true
    }
    const req: RemoteVideoPlayer.RequestPayload = {
        entities: [{
            type: 'Genre',
            value: 'test',
            externalIds: {}
        }],
        timeWindow: {
            start: new Date(),
            end: new Date()
        }
    }
    const defaultMessageContext: DirectiveMessageContext = {
        request: req,
        messageSuffix: 'SearchAndPlay',
        header: {
            namespace: 'Alexa.RemoteVideoPlayer',
            name: 'SearchAndPlay',
            correlationToken: '123'
        }
    }

    const eventContext: EventMessageContext = {
        header: {
            namespace: 'Alexa',
            name: 'Response'
        },
        response: {},
        context: []
    }

    context(('connected bridge'), function () {
        const responseMockHandler = (topic: string, mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
                case generateReplyTopicName('SearchAndPlay', clientId):
                    resp = {
                        payload: {},
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
        context('SearchAndPlay', function () {
            const messageContext = defaultMessageContext;
            beforeEach(async function () {
                await setupNotPlayingContent(getContextSandbox(this), clientId)
                setupMqttMock(responseMockHandler, getContextSandbox(this), messageContext, clientId)
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(messageContext, eventContext, clientId)
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