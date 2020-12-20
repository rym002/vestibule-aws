import { Launcher } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { resetIotDataPublish } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testMockVideoErrorResponse, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('Launcher', function () {
    const capabilities: EndpointCapability = {
        'Alexa.Launcher': true
    }

    const req: Launcher.Targets = {
        name: 'DVR',
        identifier: 'amzn1.alexa-ask-target.shortcut.69247'
    }
    const defaultMessageContext: DirectiveMessageContext = {
        request: req,
        messageSuffix: 'LaunchTarget',
        header: {
            namespace: 'Alexa.Launcher',
            name: 'LaunchTarget',
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
                case generateReplyTopicName('LaunchTarget'):
                    resp = {
                        payload: {},
                        error: false
                    }
                    break;
                case generateReplyTopicName(mockErrorSuffix + 'Video'):
                    resp = {
                        payload: errors.videoError,
                        error: true
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

        context('LaunchTarget', function () {
            beforeEach(async function () {
                await setupNotPlayingContent(getContextSandbox(this))
                setupMqttMock(responseMockHandler, getContextSandbox(this), defaultMessageContext)
            })
            afterEach(function () {
                resetDirectiveMocks()
                resetIotDataPublish()
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(defaultMessageContext, eventContext)
            })
            it('should map a alexa error', async function () {
                await testMockErrorResponse({ ...defaultMessageContext, messageSuffix: mockErrorSuffix });
            })
            it('should map a video error', async function () {
                await testMockVideoErrorResponse({ ...defaultMessageContext, messageSuffix: mockErrorSuffix + 'Video' });
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