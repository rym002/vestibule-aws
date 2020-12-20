import { RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { resetIotDataPublish } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

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
            if (resp) {
                mqttMock.sendMessage(topic, resp);
            }
        }
        context('SearchAndPlay', function () {
            const messageContext = defaultMessageContext;
            beforeEach(async function () {
                await setupNotPlayingContent(getContextSandbox(this))
                setupMqttMock(responseMockHandler, getContextSandbox(this), messageContext)
            })
            afterEach(function () {
                resetIotDataPublish()
                resetDirectiveMocks()
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(messageContext, eventContext)
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