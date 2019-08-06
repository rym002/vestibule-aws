import { EndpointState, ErrorHolder, generateEndpointId, ResponseMessage, Shadow, SubType } from '@vestibule-link/iot-types';
import { IotData, SSM } from 'aws-sdk';
import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { match, SinonStub } from 'sinon';
import { DirectiveMessage } from '../src/handlers';
import { getShadow, sendMessage } from '../src/iot';
import { getIotTestParameters, localEndpoint, messageId, mockIotDataPublish, mockIotDataUpdateThingShadow, mockShadow, resetIotDataGetThingShadow, resetIotDataPublish, resetIotDataUpdateThingShadow, vestibuleClientId } from './mock/IotDataMock';
import { mockMqtt } from './mock/MqttMock';
import { mockSSM, resetSSM } from './mock/SSMMocks';
import { sharedStates } from './handlers/TestHelper';

use(chaiAsPromised);

describe('IOT', () => {
    before(() => {
        mockSSM((params: SSM.Types.GetParametersByPathRequest) => {
            return {
                Parameters: getIotTestParameters(params.Path)
            };
        });
    })
    after(() => {
        resetSSM();
    })
    context('Shadow', () => {
        context('Message', () => {
            const desiredState: EndpointState = {
                "Alexa.PlaybackStateReporter": {
                    'playbackState': 'PLAYING'
                }
            }
            afterEach(() => {
                resetIotDataUpdateThingShadow();
            })
            it('should send an async message', async () => {
                const updateShadowSpy = mockIotDataUpdateThingShadow((params: IotData.UpdateThingShadowRequest): IotData.UpdateThingShadowResponse => {
                    return {
                    }
                })
                const resp = await sendMessage(
                    vestibuleClientId,
                    {
                        desired: desiredState
                    },
                    messageId,
                    localEndpoint
                )
                const shadow: Shadow = {
                    state: {
                        desired: {
                            endpoints: {
                                [generateEndpointId(localEndpoint)]: {
                                    states: desiredState
                                }
                            }
                        }
                    }
                }
                assert(updateShadowSpy.calledWith(match.has('thingName', vestibuleClientId)));
                assert(updateShadowSpy.calledWith(match.has('payload', JSON.stringify(shadow))));
                expect(resp).to.have.property('shadow').eql(shadow);
            })
            context('Sync Messages', () => {
                let mqttSave: SinonStub<any[], any>;
                before(() => {
                    mqttSave = mockMqtt((topic, mqttMock) => {
                        if (topic == '$aws/things/' + vestibuleClientId + '/shadow/update/accepted') {
                            const respShadow: Shadow = {
                                state: {
                                    reported: {
                                        endpoints: {
                                            [generateEndpointId(localEndpoint)]: {
                                                states: desiredState
                                            }
                                        }
                                    }
                                }
                            }
                            mqttMock.sendMessage(topic, respShadow);
                        }
                    })
                })
                after(() => {
                    mqttSave.restore()
                })
                beforeEach(() => {
                    const updateShadowSpy = mockIotDataUpdateThingShadow((params: IotData.UpdateThingShadowRequest): IotData.UpdateThingShadowResponse => {
                        return {
                        }
                    })
                })
                it('should return a shadow', async () => {
                    const resp = await sendMessage(
                        vestibuleClientId,
                        {
                            desired: desiredState,
                            sync: true
                        },
                        messageId,
                        localEndpoint
                    )
                    expect(resp).to.have.property('shadow').to.have.property('state').to.have.property('reported')
                })
                it('should throw timeout', async () => {
                    await expect(sendMessage(
                        vestibuleClientId + '_bad',
                        {
                            desired: desiredState,
                            sync: true
                        },
                        '123',
                        localEndpoint
                    )).to.rejected.and.eventually.to.include({
                        errorType: 'Alexa'
                    }).have.property('errorPayload')
                        .have.property('message', 'No Reponse From Endpoint')

                })
            })
        })
        context('Lookup', () => {
            const testResp: Shadow = {
                state: {
                    reported: {
                        endpoints: {
                            '123': {
                                capabilities: {
                                    "Alexa.PlaybackController": ['Play']
                                }
                            }
                        }
                    }
                }
            }
            afterEach(() => {
                resetIotDataGetThingShadow();
            })
            it('should return the thing shadow', async () => {
                const shadowSpy = mockShadow(testResp, vestibuleClientId)
                const resp = await getShadow('vestibule-bridge-' + vestibuleClientId);
                assert(shadowSpy.calledWith({
                    thingName: 'vestibule-bridge-' + vestibuleClientId
                }))
                expect(resp).eql(testResp);
            })

            it('should throw error', async () => {
                const shadowSpy = mockShadow(testResp, vestibuleClientId + '_bad')
                await expect(getShadow(vestibuleClientId)).to.be.rejected
                    .and.eventually.to.include({
                        errorType: 'Alexa'
                    }).have.property('errorPayload');
            })

        })
    })
    context('Topic', () => {
        const payload: SubType<DirectiveMessage, 'Alexa.PlaybackController'> = {
            name: 'Play',
            namespace: 'Alexa.PlaybackController',
            payload: {},
            header: {
                messageId: '123',
                name: 'Play',
                namespace: 'Alexa.PlaybackController',
                payloadVersion: '3'
            },
            endpoint: {
                endpointId: generateEndpointId(localEndpoint),
                scope: {
                    type: 'BearerToken',
                    token: ''
                }
            }
        }

        afterEach(() => {
            resetIotDataPublish()
        })
        it('should send an async message', async () => {
            const publishSpy = mockIotDataPublish((params: IotData.PublishRequest) => {
                return {}
            })

            const resp = await sendMessage(
                vestibuleClientId,
                {
                    request: payload
                },
                messageId,
                localEndpoint
            )
            assert(publishSpy.calledWith(match.has('topic', 'vestibule-bridge/testClientId/alexa/directive/testProvider/testHost/Alexa.PlaybackController/Play')));
            assert(publishSpy.calledWith(match.has('payload', JSON.stringify({
                payload: payload.payload,
                replyTopic: {}
            }))));
        })
        context('Sync', async () => {
            let mqttSave: SinonStub<any[], any>;
            before(() => {
                mqttSave = mockMqtt((topic, mqttMock) => {
                    let resp: ResponseMessage<any> | undefined;
                    if (topic == 'vestibule-bridge/' + vestibuleClientId + '/alexa/event/' + messageId + '-success') {
                        resp = {
                            payload: 'test',
                            stateChange: {
                                ...sharedStates.playback.playing
                            },
                            error: false
                        }
                    } else if (topic == 'vestibule-bridge/' + vestibuleClientId + '/alexa/event/' + messageId + '-error') {
                        const error: ErrorHolder = {
                            errorType: 'Alexa',
                            errorPayload: {
                                type: 'ENDPOINT_BUSY',
                                message: 'Test Error'
                            }
                        }
                        resp = {
                            payload: error,
                            error: true
                        }
                    }

                    if (resp && 'string' == typeof topic) {
                        mqttMock.sendMessage(topic, resp);
                    }
                })
            })
            after(() => {
                mqttSave.restore()
            })
            beforeEach(() => {
                const publishSpy = mockIotDataPublish((params: IotData.PublishRequest) => {
                    return {}
                })
            })
            it('should send a sync message', async () => {
                const resp = await sendMessage(
                    vestibuleClientId,
                    {
                        request: payload,
                        sync: true
                    },
                    messageId + '-success',
                    localEndpoint
                )
                expect(resp).to.have.property('response')
                    .to.have.property('payload', 'test')
                expect(resp).to.have.property('shadow')
                    .to.have.property('state')
                    .to.have.property('reported')
                    .to.have.property('endpoints')
                    .to.have.property(generateEndpointId(localEndpoint))
                    .to.have.property('states')
                    .to.eql(sharedStates.playback.playing)
                expect(resp).to.have.property('shadow')
                    .to.have.property('metadata')
                    .to.have.property('reported')
                    .to.have.property('endpoints')
                    .to.have.property(generateEndpointId(localEndpoint))
                    .to.have.property('states')
                    .to.have.property('Alexa.PlaybackStateReporter')
                    .to.have.property('playbackState')
                    .to.have.property('timestamp', Math.floor(Date.now() / 1000))
            })
            it('should throw error from error response', async () => {
                await expect(sendMessage(
                    vestibuleClientId,
                    {
                        request: payload,
                        sync: true
                    },
                    messageId + '-error',
                    localEndpoint
                )).to.rejected.and.eventually.to.include({
                    errorType: 'Alexa'
                }).have.property('errorPayload')
                    .have.property('message', 'Test Error')
            })
            it('should timeout', async () => {
                await expect(sendMessage(
                    vestibuleClientId,
                    {
                        request: payload,
                        sync: true
                    },
                    messageId + '-timeout',
                    localEndpoint
                )).to.rejected.and.eventually.to.include({
                    errorType: 'Alexa'
                }).have.property('errorPayload')
                    .have.property('message', 'No Reponse From Endpoint')
            })
        })
    })
})
