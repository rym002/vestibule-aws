import { Launcher } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert } from 'chai';
import 'mocha';
import { SinonStub } from 'sinon';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testMockVideoErrorResponse, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('Launcher', () => {
    const capabilitites: EndpointCapability = {
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

    context(('connected bridge'), () => {
        let mqttSave: SinonStub<any[], any>;
        beforeEach(() => {
            mqttSave = mockMqtt((topic, mqttMock) => {
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
                if (resp && 'string' == typeof topic) {
                    mqttMock.sendMessage(topic, resp);
                }
            })
        })
        afterEach(() => {
            mqttSave.restore()
        })

        context('LaunchTarget', () => {
            before(async () => {
                await setupNotPlayingContent(capabilitites)
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('should send a message', async () => {
                await testSuccessfulMessage(defaultMessageContext, eventContext)
                assert(mqttSave.called)
            })
            it('should map a alexa error', async () => {
                await testMockErrorResponse({ ...defaultMessageContext, messageSuffix: mockErrorSuffix });
                assert(mqttSave.called)
            })
            it('should map a video error', async () => {
                await testMockVideoErrorResponse({ ...defaultMessageContext, messageSuffix: mockErrorSuffix + 'Video' });
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