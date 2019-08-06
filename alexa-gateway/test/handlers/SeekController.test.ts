import { SeekController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert, expect } from 'chai';
import 'mocha';
import { SinonStub } from 'sinon';
import { resetDirectiveMocks, directiveMocks, mockEndpointState } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testPoweredOffEndpoint, sharedStates, EventMessageContext, testSuccessfulMessage, callHandler } from './TestHelper';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';

describe('SeekController', () => {
    const capabilitites: EndpointCapability = {
        'Alexa.SeekController': true
    }
    const defaultMessageContext: DirectiveMessageContext = {
        request: <SeekController.RequestPayload>{
            deltaPositionMilliseconds: 1000
        },
        messageSuffix: 'AdjustSeekPosition',
        header: {
            namespace: 'Alexa.SeekController',
            name: 'AdjustSeekPosition',
            correlationToken: '123'
        }
    }
    const eventContext: EventMessageContext = {
        header: {
            namespace: 'Alexa.SeekController',
            name: 'StateReport'
        },
        context: [],
        response: {
            properties: [{
                name: 'positionMilliseconds',
                value: 2000
            }]
        }
    }
    context(('connected bridge'), () => {
        let mqttSave: SinonStub<any[], any>;
        beforeEach(() => {
            mqttSave = mockMqtt((topic, mqttMock) => {
                let resp: ResponseMessage<any> | undefined;
                switch (topic) {
                    case generateReplyTopicName('AdjustSeekPosition'):
                        resp = {
                            payload: eventContext.response,
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

        context('AdjustSeekPosition', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing }, capabilitites, localEndpoint, true, vestibuleClientId);

            })
            after((done) => {
                resetDirectiveMocks()
            })

            it('should send a message', async () => {
                const event = await callHandler(defaultMessageContext, '');
                expect(event)
                    .to.have.property('event')
                    .to.have.property('header')
                    .to.have.property('namespace', eventContext.header.namespace);
                expect(event)
                    .to.have.property('event')
                    .to.have.property('header')
                    .to.have.property('name', eventContext.header.name);
                expect(event)
                    .to.have.property('event')
                    .to.have.property('payload').eql(eventContext.response);
                assert(mqttSave.called)
            })
            it('should map an error', async () => {
                const messageContext = defaultMessageContext
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