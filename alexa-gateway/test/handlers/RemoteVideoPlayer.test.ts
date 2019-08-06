import { RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert } from 'chai';
import 'mocha';
import { SinonStub } from 'sinon';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('RemoteVideoPlayer', () => {
    const capabilitites: EndpointCapability = {
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

    const eventContext:EventMessageContext={
        header: {
            namespace: 'Alexa',
            name: 'Response'
        },
        response: {},
        context:[]
    }

    context(('connected bridge'), () => {
        let mqttSave: SinonStub<any[], any>;
        beforeEach(() => {
            mqttSave = mockMqtt((topic, mqttMock) => {
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
            })
        })
        afterEach(() => {
            mqttSave.restore()
        })
        context('SearchAndPlay',()=>{
            before(async () => {
                await setupNotPlayingContent(capabilitites)
            })
            after((done) => {
                resetDirectiveMocks()
            })
            it('should send a message', async () => {
                const messageContext = defaultMessageContext;
                await testSuccessfulMessage(messageContext, eventContext)
                assert(mqttSave.called)
            })
            it('should map an error', async () => {
                const messageContext = defaultMessageContext;
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