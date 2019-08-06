import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert } from 'chai';
import 'mocha';
import { SinonStub } from 'sinon';
import { resetDirectiveMocks, directiveMocks, mockEndpointState } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testPoweredOffEndpoint, testSuccessfulMessage, testMockErrorResponse, sharedStates } from './TestHelper';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';

describe('RecordController', () => {
    const capabilitites: EndpointCapability = {
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
    context(('connected bridge'), () => {
        let mqttSave: SinonStub<any[], any>;
        beforeEach(() => {
            mqttSave = mockMqtt((topic, mqttMock) => {
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
            })
        })
        afterEach(() => {
            mqttSave.restore()
        })

        context('RECORDING', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing,...sharedStates.record.recording }, capabilitites, localEndpoint, true, vestibuleClientId);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('StartRecording', async () => {
                const messageContext = getDirectiveMessageContext('StartRecording');
                const eventContext = getEventMessageContent('RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.notCalled)
            })
            it('StopRecording', async () => {
                const messageContext = getDirectiveMessageContext('StopRecording');
                const eventContext = getEventMessageContent('NOT_RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('should map an error', async () => {
                const messageContext = getDirectiveMessageContext('StopRecording');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                assert(mqttSave.called)
            })
        })
        context('NOT_RECORDING', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing,...sharedStates.record.not_recording }, capabilitites, localEndpoint, true, vestibuleClientId);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('StartRecording', async () => {
                const messageContext = getDirectiveMessageContext('StartRecording');
                const eventContext = getEventMessageContent('RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('StopRecording', async () => {
                const messageContext = getDirectiveMessageContext('StopRecording');
                const eventContext = getEventMessageContent('NOT_RECORDING');
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.notCalled)

            })
            it('should map an error', async () => {
                const messageContext = getDirectiveMessageContext('StartRecording');
                await testMockErrorResponse({ ...messageContext, messageSuffix: mockErrorSuffix });
                assert(mqttSave.called)
            })

        })
        context('Power Off', () => {
            before(async () => {
                await setupPoweredOff(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('should return NOT_IN_OPERATION', async () => {
                await testPoweredOffEndpoint(defaultMessageContext)
            })

        })
        context('Invalid Endpoint', () => {
            before(async () => {
                await setupInvalidEndpoint(capabilitites);
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('should return NO_SUCH_ENDPOINT', async () => {
                await testInvalidEndpoint(defaultMessageContext);
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
        it('should return BRIDGE_UNREACHABLE', async () => {
            await testDisconnectedBridge(defaultMessageContext);
        })
    })

})