import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import 'mocha';
import { createSandbox } from 'sinon';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, resetIotDataPublish, vestibuleClientId } from '../mock/IotDataMock';
import { MockMqttOperations } from '../mock/MqttMock';
import { DirectiveMessageContext, emptyParameters, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupMqttMock, setupPoweredOff, sharedStates, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('RecordController', function () {
    const capabilities: EndpointCapability = {
        'Alexa.RecordController': ['RecordingState']
    }

    const defaultMessageContext: DirectiveMessageContext = {
        request: {},
        messageSuffix: '',
        header: {
            namespace: 'Alexa.RecordController',
            correlationToken: '123'
        }
    }

    function getDirectiveMessageContext(name: RecordController.Operations): DirectiveMessageContext {
        return {
            ...defaultMessageContext, header: {
                namespace: 'Alexa.RecordController',
                name: name
            },
            messageSuffix: name
        }
    }

    function getEventMessageContent(state: RecordController.States): EventMessageContext {
        return {
            header: {
                namespace: 'Alexa',
                name: 'Response'
            },
            response: {},
            context: [{
                namespace: 'Alexa.RecordController',
                name: 'RecordingState',
                value: state
            }]
        }
    }
    context(('connected bridge'), function () {
        const sandbox = createSandbox()
        const responseMockHandler = (topic: string | string[], mqttMock: MockMqttOperations) => {
            let resp: ResponseMessage<any> | undefined;
            switch (topic) {
                case generateReplyTopicName('StartRecording'):
                    resp = {
                        payload: {},
                        stateChange: {
                            'Alexa.RecordController': {
                                RecordingState: 'RECORDING'
                            }
                        },
                        error: false
                    }
                    break;
                case generateReplyTopicName('StopRecording'):
                    resp = {
                        payload: {},
                        stateChange: {
                            'Alexa.RecordController': {
                                RecordingState: 'NOT_RECORDING'
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
            resetIotDataPublish();
        })

        context('RECORDING', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing, ...sharedStates.record.recording }, capabilities, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('StartRecording', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('StopRecording', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('NOT_RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
            })
        })
        context('NOT_RECORDING', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing, ...sharedStates.record.not_recording }, capabilities, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('StartRecording', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
                const eventContext = getEventMessageContent('RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('StopRecording', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                const eventContext = getEventMessageContent('NOT_RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                setupMqttMock(responseMockHandler, sandbox, messageContext)
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