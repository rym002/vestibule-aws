import { RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { createSandbox } from 'sinon';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { resetIotDataPublish } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('RemoteVideoPlayer', function () {
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
        const sandbox = createSandbox()
        const responseMockHandler = (topic: string | string[], mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
                case generateReplyTopicName('SearchAndPlay'):
                    resp = {
                        payload: {},
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
        })
        context('SearchAndPlay', function () {
            const messageContext = defaultMessageContext;
            beforeEach(function () {
                setupMqttMock(responseMockHandler, sandbox, messageContext)
            })
            afterEach(function () {
                resetIotDataPublish()
            })
            before(async function () {
                await setupNotPlayingContent(capabilities)
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('should map an error', async function () {
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
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