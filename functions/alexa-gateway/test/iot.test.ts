import { EndpointState, endpointTopicPrefix, ErrorHolder, ResponseMessage, Shadow, SubType } from '@vestibule-link/iot-types';
import { mqtt } from 'aws-iot-device-sdk-v2';
import { IotData } from 'aws-sdk';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { getContextSandbox } from '../../../mocks/Sandbox';
import { ssmMock } from '../../../mocks/SSMMocks';
import { DirectiveMessage, SHADOW_PREFIX } from '../src/directive/DirectiveTypes';
import { getShadow, sendMessage } from '../src/iot';
import { sharedStates } from './directive/TestHelper';
import { getIotTestParameters, mockIotDataPublish, mockIotDataUpdateThingShadow, mockShadow } from './mocks/IotDataMock';
import { mockMqtt } from './mocks/MqttMock';

use(chaiAsPromised);

describe('IOT', function () {
    const clientId = 'IOT'
    const messageId = 'testMessage'
    const endpointId = 'testEndpoint'
    beforeEach(function () {
        const sandbox = getContextSandbox(this)
        ssmMock(sandbox, [getIotTestParameters]);
    })
    context('Shadow', function () {
        context('Message', function () {
            const desiredState: EndpointState = {
                "Alexa.PlaybackStateReporter": {
                    'playbackState': {
                        state: 'PLAYING'
                    }
                }
            }
            it('should send an async message', async function () {
                const sandbox = getContextSandbox(this)
                const updateShadowSpy = mockIotDataUpdateThingShadow(getContextSandbox(this), (params: IotData.UpdateThingShadowRequest): IotData.UpdateThingShadowResponse => {
                    return {
                    }
                })
                const resp = await sendMessage(
                    clientId,
                    {
                        desired: desiredState
                    },
                    messageId,
                    endpointId
                )
                const shadow: Shadow<EndpointState> = {
                    state: {
                        desired: desiredState
                    },
                    clientToken: messageId
                }
                const expectedParams = {
                    thingName: clientId,
                    shadowName: endpointId,
                    payload: JSON.stringify(shadow)
                }
                sandbox.assert.calledWith(updateShadowSpy, expectedParams, sandbox.match.func);
                expect(resp).to.have.property('shadow').eql(shadow);
            })
            context('Sync Messages', function () {
                beforeEach(function () {
                    const sandbox = getContextSandbox(this)
                    mockMqtt(sandbox, (topic, mqttMock) => {
                        if (topic == `$aws/things/${clientId}/shadow/name/${endpointId}/update/accepted`) {
                            const respShadow: Shadow<EndpointState> = {
                                state: {
                                    reported: desiredState
                                }
                            }
                            mqttMock.sendMessage(topic, respShadow);
                        }
                    })
                    const updateShadowSpy = mockIotDataUpdateThingShadow(sandbox, (params: IotData.UpdateThingShadowRequest): IotData.UpdateThingShadowResponse => {
                        return {
                        }
                    })
                })
                afterEach(function () {
                })
                it('should return a shadow', async function () {
                    const resp = await sendMessage(
                        clientId,
                        {
                            desired: desiredState,
                            sync: true
                        },
                        messageId,
                        endpointId
                    )
                    expect(resp).to.have.property('shadow').to.have.property('state').to.have.property('reported')
                })
                it('should throw timeout', async function () {
                    getContextSandbox(this).clock.tickAsync('00:02')
                    const message = sendMessage(
                        clientId + '_bad',
                        {
                            desired: desiredState,
                            sync: true
                        },
                        '123',
                        endpointId
                    )
                    await expect(message).to.rejected.and.eventually.to.include({
                        errorType: 'Alexa'
                    }).have.property('errorPayload')
                        .have.property('message', 'No Reponse From Endpoint')

                })
            })
        })
        context('Lookup', function () {
            const testResp: Shadow<EndpointState> = {
                state: {
                    reported: {
                        'Alexa.PlaybackStateReporter': {
                            playbackState: {
                                state: 'PLAYING'
                            }
                        }
                    }
                }
            }
            it('should return the thing shadow', async function () {
                const sandbox = getContextSandbox(this)
                const shadows = new Map<string, Shadow<any>>()
                shadows.set(endpointId, testResp)
                const shadowSpy = mockShadow(getContextSandbox(this), shadows, clientId)
                const resp = await getShadow(`${SHADOW_PREFIX}${clientId}`, endpointId);
                sandbox.assert.calledWith(shadowSpy, {
                    thingName: `${SHADOW_PREFIX}${clientId}`,
                    shadowName: endpointId
                }, sandbox.match.func)
                expect(resp).eql(testResp);
            })

            it('should throw error', async function () {
                const shadows = new Map<string, Shadow<any>>()
                shadows.set(endpointId, testResp)
                const shadowSpy = mockShadow(getContextSandbox(this), shadows, clientId + '_bad')
                await expect(getShadow(`${SHADOW_PREFIX}${clientId}`, endpointId)).to.be.rejected
                    .and.eventually.to.include({
                        errorType: 'Alexa'
                    }).have.property('errorPayload');
            })

        })
    })
    context('Topic', function () {
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
                endpointId: endpointId,
                scope: {
                    type: 'BearerToken',
                    token: ''
                }
            }
        }

        it('should send an async message', async function () {
            const sandbox = getContextSandbox(this)
            const publishSpy = mockIotDataPublish(getContextSandbox(this), (params: IotData.PublishRequest) => {
                return {}
            })

            const resp = await sendMessage(
                clientId,
                {
                    request: payload
                },
                messageId,
                endpointId
            )
            const topicPrefix = endpointTopicPrefix(clientId, 'alexa', endpointId)
            const expectedRequest: IotData.PublishRequest = {
                topic: `${topicPrefix}directive/Alexa.PlaybackController/Play`,
                payload: JSON.stringify({
                    payload: payload.payload,
                    replyTopic: {}
                }),
                qos: mqtt.QoS.AtMostOnce
            }
            sandbox.assert.calledWith(publishSpy, expectedRequest, sandbox.match.func);
        })
        context('Sync', async function () {
            beforeEach(function () {
                const sandbox = getContextSandbox(this)
                mockMqtt(sandbox, (topic, mqttMock) => {
                    let resp: ResponseMessage<any> | undefined;
                    if (topic == 'vestibule-bridge/' + clientId + '/alexa/event/' + messageId + '-success') {
                        resp = {
                            payload: 'test',
                            stateChange: {
                                ...sharedStates.playback.playing
                            },
                            error: false
                        }
                    } else if (topic == 'vestibule-bridge/' + clientId + '/alexa/event/' + messageId + '-error') {
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
                const publishSpy = mockIotDataPublish(sandbox, (params: IotData.PublishRequest) => {
                    return {}
                })
            })
            it('should send a sync message', async function () {
                const resp = await sendMessage(
                    clientId,
                    {
                        request: payload,
                        sync: true
                    },
                    messageId + '-success',
                    endpointId
                )
                expect(resp).to.have.property('response')
                    .to.have.property('payload', 'test')
                expect(resp).to.have.property('shadow')
                    .to.have.property('state')
                    .to.have.property('reported')
                    .to.eql(sharedStates.playback.playing)
                expect(resp).to.have.property('shadow')
                    .to.have.property('metadata')
                    .to.have.property('reported')
                    .to.have.property('Alexa.PlaybackStateReporter')
                    .to.have.property('playbackState')
                    .to.have.property('state')
                    .to.have.property('timestamp', Math.floor(Date.now() / 1000))
            })
            it('should throw error from error response', async function () {
                await expect(sendMessage(
                    clientId,
                    {
                        request: payload,
                        sync: true
                    },
                    messageId + '-error',
                    endpointId
                )).to.rejected.and.eventually.to.include({
                    errorType: 'Alexa'
                }).have.property('errorPayload')
                    .have.property('message', 'Test Error')
            })
            it('should timeout', async function () {
                getContextSandbox(this).clock.tickAsync('00:02')
                await expect(sendMessage(
                    clientId,
                    {
                        request: payload,
                        sync: true
                    },
                    messageId + '-timeout',
                    endpointId
                )).to.rejected.and.eventually.to.include({
                    errorType: 'Alexa'
                }).have.property('errorPayload')
                    .have.property('message', 'No Reponse From Endpoint')
            })
        })
    })
})
