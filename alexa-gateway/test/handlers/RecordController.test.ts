import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert } from 'chai';
import 'mocha';
import * as mqtt from 'mqtt';
import { createSandbox, SinonSpy } from 'sinon';
import { resetDirectiveMocks, directiveMocks, mockEndpointState } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testPoweredOffEndpoint, testSuccessfulMessage, testMockErrorResponse, sharedStates, emptyParameters } from './TestHelper';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';

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
        beforeEach(function () {
            mockMqtt((topic, mqttMock) => {
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
            },sandbox)
        })
        afterEach(function () {
            sandbox.restore()
        })

        context('RECORDING', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing,...sharedStates.record.recording }, capabilities, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('StartRecording', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                const eventContext = getEventMessageContent('RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.notCalled(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('StopRecording', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                const eventContext = getEventMessageContent('NOT_RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
        })
        context('NOT_RECORDING', function () {
            before(async function () {
                await directiveMocks(emptyParameters);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing,...sharedStates.record.not_recording }, capabilities, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('StartRecording', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                const eventContext = getEventMessageContent('RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('StopRecording', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                const eventContext = getEventMessageContent('NOT_RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                sandbox.assert.notCalled(<SinonSpy<any, any>><unknown>mqtt.MqttClient)

            })
            it('should map an error', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
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