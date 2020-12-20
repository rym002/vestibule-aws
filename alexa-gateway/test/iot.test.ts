import { EndpointState, endpointTopicPrefix, ErrorHolder, ResponseMessage, Shadow, SubType } from '@vestibule-link/iot-types';
import { IotData, SSM } from 'aws-sdk';
import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { match } from 'sinon';
import { DirectiveMessage, SHADOW_PREFIX } from '../src/directive/DirectiveTypes';
import { getShadow, sendMessage } from '../src/iot';
import { sharedStates } from './directive/TestHelper';
import { getIotTestParameters, localEndpoint, messageId, mockIotDataPublish, mockIotDataUpdateThingShadow, mockShadow, resetIotDataGetThingShadow, resetIotDataPublish, resetIotDataUpdateThingShadow, vestibuleClientId } from './mock/IotDataMock';
import { mockMqtt } from './mock/MqttMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from './mock/Sandbox';
import { mockSSM, resetSSM } from './mock/SSMMocks';

use(chaiAsPromised);

describe('IOT', function () {
    beforeEach(function () {
        const sandbox = createContextSandbox(this)
        mockSSM(sandbox, (params: SSM.Types.GetParametersByPathRequest) => {
            return {
                Parameters: getIotTestParameters(params.Path)
            };
        });
    })
    afterEach(function () {
        restoreSandbox(this)
        resetSSM();
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
            afterEach(function () {
                resetIotDataUpdateThingShadow();
            })
            it('should send an async message', async function () {
                const updateShadowSpy = mockIotDataUpdateThingShadow(getContextSandbox(this), (params: IotData.UpdateThingShadowRequest): IotData.UpdateThingShadowResponse => {
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
                const shadow: Shadow<EndpointState> = {
                    state: {
                        desired: desiredState
                    }
                }
                assert(updateShadowSpy.calledWith(match.has('thingName', vestibuleClientId)));
                assert(updateShadowSpy.calledWith(match.has('payload', JSON.stringify(shadow))));
                expect(resp).to.have.property('shadow').eql(shadow);
            })
            context('Sync Messages', function () {
                beforeEach(function () {
                    const sandbox = getContextSandbox(this)
                    mockMqtt(sandbox, (topic, mqttMock) => {
                        if (topic == `$aws/things/${vestibuleClientId}/shadow/name/${localEndpoint}/update/accepted`) {
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
                it('should throw timeout', async function () {
                    getContextSandbox(this).clock.tickAsync('00:02')
                    const message = sendMessage(
                        vestibuleClientId + '_bad',
                        {
                            desired: desiredState,
                            sync: true
                        },
                        '123',
                        localEndpoint
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
            afterEach(function () {
                resetIotDataGetThingShadow();
            })
            it('should return the thing shadow', async function () {
                const shadows = new Map<string, Shadow<any>>()
                shadows.set(localEndpoint, testResp)
                const shadowSpy = mockShadow(getContextSandbox(this), shadows, vestibuleClientId)
                const resp = await getShadow(`${SHADOW_PREFIX}${vestibuleClientId}`, localEndpoint);
                assert(shadowSpy.calledWith({
                    thingName: `${SHADOW_PREFIX}${vestibuleClientId}`,
                    shadowName: localEndpoint
                }), 'Get Shadow Not Called')
                expect(resp).eql(testResp);
            })

            it('should throw error', async function () {
                const shadows = new Map<string, Shadow<any>>()
                shadows.set(localEndpoint, testResp)
                const shadowSpy = mockShadow(getContextSandbox(this), shadows, vestibuleClientId + '_bad')
                await expect(getShadow(`${SHADOW_PREFIX}${vestibuleClientId}`, localEndpoint)).to.be.rejected
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
                endpointId: localEndpoint,
                scope: {
                    type: 'BearerToken',
                    token: ''
                }
            }
        }

        afterEach(function () {
            resetIotDataPublish()
        })
        it('should send an async message', async function () {
            const publishSpy = mockIotDataPublish(getContextSandbox(this), (params: IotData.PublishRequest) => {
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
            const topicPrefix = endpointTopicPrefix(vestibuleClientId, 'alexa', localEndpoint)
            assert(publishSpy.calledWith(match.has('topic', `${topicPrefix}directive/Alexa.PlaybackController/Play`)),
                'Invalid Topic Name');
            assert(publishSpy.calledWith(match.has('payload', JSON.stringify({
                payload: payload.payload,
                replyTopic: {}
            }))), 'Invalid payload published on topic');
        })
        context('Sync', async function () {
            beforeEach(function () {
                const sandbox = getContextSandbox(this)
                mockMqtt(sandbox, (topic, mqttMock) => {
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
                const publishSpy = mockIotDataPublish(sandbox, (params: IotData.PublishRequest) => {
                    return {}
                })
            })
            it('should send a sync message', async function () {
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
            it('should timeout', async function () {
                getContextSandbox(this).clock.tickAsync('00:02')
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
