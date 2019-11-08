import { KeypadController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { createSandbox } from 'sinon';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { resetIotDataPublish } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testMockVideoErrorResponse, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('KeypadController', function () {
    const capabilities: EndpointCapability = {
        'Alexa.KeypadController': ['UP', 'DOWN']
    }

    const req: KeypadController.SendKeystrokeRequest = {
        keystroke: 'UP'
    }
    const defaultMessageContext: DirectiveMessageContext = {
        request: req,
        messageSuffix: 'SendKeystroke',
        header: {
            namespace: 'Alexa.KeypadController',
            name: 'SendKeystroke',
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
                case generateReplyTopicName('SendKeystroke'):
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

        context('SendKeystroke', function () {
            before(async function () {
                await setupNotPlayingContent()
            })
            after(() => {
                resetDirectiveMocks()
            })
            beforeEach(function () {
                setupMqttMock(responseMockHandler, sandbox, defaultMessageContext)
            })
            afterEach(function () {
                resetIotDataPublish()
            })
            it('should send a message', async function () {
                await testSuccessfulMessage(defaultMessageContext, eventContext)
            })
            it('should map a alexa error', async function () {
                await testMockErrorResponse({ ...defaultMessageContext, messageSuffix: mockErrorSuffix });
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