import { Alexa, Directive, Event, Message } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, endpointTopicPrefix, ErrorHolder, SubType } from "@vestibule-link/iot-types";
import { IotData } from 'aws-sdk';
import { expect } from 'chai';
import { SinonSandbox } from 'sinon';
import { generateValidToken } from '../../../../mocks/CognitoMock';
import { SHADOW_PREFIX } from '../../src/directive/DirectiveTypes';
import { handler } from '../../src';
import { directiveMocks } from '../mocks/DirectiveMocks';
import { mockIotDataPublish, mockIotDataUpdateThingShadow } from "../mocks/IotDataMock";
import { fakeCallback, FakeContext } from '../../../../mocks/LambdaMock';
import { mockMqtt, MockMqttOperations } from '../mocks/MqttMock';
import { mockEndpointState } from '../mocks/StateMocks'

const messageId = 'testMessage'
export const connectedEndpointId = 'connectedEndpoint'
export const disconnectedEndpointId = 'disconnectedEndpoint'
const invalidEndpointId = 'invalidEndpoint'
interface SharedStates {
    playback: {
        playing: EndpointState
        paused: EndpointState
        stopped: EndpointState
    }
    power: {
        on: EndpointState
        off: EndpointState
    }
    record: {
        recording: EndpointState
        not_recording: EndpointState
    }
    channel: EndpointState
}

export const sharedStates: SharedStates = {
    playback: {
        playing: {
            'Alexa.PlaybackStateReporter': {
                playbackState: { state: "PLAYING" }
            }
        },
        paused: {
            'Alexa.PlaybackStateReporter': {
                playbackState: { state: "PAUSED" }
            }
        },
        stopped: {
            'Alexa.PlaybackStateReporter': {
                playbackState: { state: "STOPPED" }
            }
        }
    },
    power: {
        on: {
            "Alexa.PowerController": {
                powerState: "ON"
            }
        },
        off: {
            "Alexa.PowerController": {
                powerState: "OFF"
            }
        }
    },
    channel: {
        "Alexa.ChannelController": {
            channel: {
                affiliateCallSign: 'TESTA',
                callSign: 'TESTC',
                number: '10'
            }
        }
    },
    record: {
        recording: {
            'Alexa.RecordController': {
                RecordingState: 'RECORDING'
            }
        },
        not_recording: {
            'Alexa.RecordController': {
                RecordingState: 'NOT_RECORDING'
            }
        }
    }
}

export async function generateEndpoint(endpointId: string, clientId: string): Promise<Message.EndpointRequest> {
    return {
        endpointId,
        scope: await generateValidScope(clientId)
    }
}

export function verifyErrorResponse(event: Event.Message, errorHolder: ErrorHolder, endpointId: string) {
    expect(event)
        .to.have.property('event')
        .to.have.property('payload').eql(errorHolder.errorPayload)
    expect(event)
        .to.have.property('event')
        .to.have.property('header')
        .to.have.property('namespace', errorHolder.errorType)
    expect(event)
        .to.have.property('event')
        .to.have.property('header')
        .to.have.property('name', 'ErrorResponse')
    expect(event)
        .to.have.property('event')
        .to.have.property('endpoint')
        .to.have.property('endpointId', endpointId)
}

export function verifyVideoErrorResponse(event: Event.Message, errorHolder: ErrorHolder) {
    expect(event)
        .to.have.property('event')
        .to.have.property('payload').eql(errorHolder.errorPayload)
    expect(event)
        .to.have.property('event')
        .to.have.property('header')
        .to.have.property('namespace', errorHolder.errorType)
    expect(event)
        .to.have.property('event')
        .to.have.property('header')
        .to.have.property('name', 'ErrorResponse')
}

interface SharedErrors {
    notConnected: ErrorHolder
    invalidEndpoint: ErrorHolder
    disconnectedBridge: ErrorHolder
    notWatchingTv: ErrorHolder
    stoppedEndpoint: ErrorHolder
    bridgeError: ErrorHolder
    videoError: ErrorHolder
}
export const errors: SharedErrors = {
    notConnected: {
        errorType: 'Alexa',
        errorPayload: {
            message: 'Endpoint Not Connected',
            type: 'NOT_IN_OPERATION'
        }
    },
    invalidEndpoint: {
        errorType: 'Alexa',
        errorPayload: {
            message: 'Unknown Endpoint',
            type: 'NO_SUCH_ENDPOINT'
        }
    },
    disconnectedBridge: {
        errorType: 'Alexa',
        errorPayload: {
            message: 'Bridge not connected',
            type: 'BRIDGE_UNREACHABLE'
        }
    },
    notWatchingTv: {
        errorType: 'Alexa',
        errorPayload: {
            message: 'Not Watching TV',
            type: 'NOT_SUPPORTED_IN_CURRENT_MODE'
        }
    },
    stoppedEndpoint: {
        errorType: 'Alexa',
        errorPayload: {
            type: 'NOT_SUPPORTED_IN_CURRENT_MODE',
            message: 'Content is stopped'
        }
    },
    bridgeError: {
        errorType: 'Alexa',
        errorPayload: {
            message: 'Mock Bridge Error Response',
            type: 'VALUE_OUT_OF_RANGE'
        }
    },
    videoError: {
        errorType: 'Alexa.Video',
        errorPayload: {
            type: 'STORAGE_FULL',
            message: 'Mock Error'
        }
    }
}

export const mockErrorSuffix = 'mock-error'
export interface DirectiveMessageContext {
    request: SubType<SubType<Directive.Message, 'directive'>, 'payload'>
    messageSuffix: string
    header: any
}

export interface EventMessageContext {
    response: SubType<SubType<Event.Message, 'event'>, 'payload'>
    header: {
        namespace: SubType<SubType<SubType<Event.Message, 'event'>, 'header'>, 'namespace'>
        name: SubType<SubType<SubType<Event.Message, 'event'>, 'header'>, 'name'>
    }
    context: SubType<Alexa.Context, 'properties'>
}

export async function callHandler(messageContext: DirectiveMessageContext, endpointId: string, clientId: string): Promise<Event.Message> {
    const endpoint = await generateEndpoint(endpointId, clientId);
    return <Event.Message>await handler({
        directive: {
            header: messageContext.header,
            endpoint,
            payload: messageContext.request
        }
    }, new FakeContext(`${messageId}-${messageContext.messageSuffix}`), fakeCallback);
}


export async function testDisconnectedBridge(messageContext: DirectiveMessageContext, clientId: string) {
    const ret = await callHandler(messageContext, disconnectedEndpointId, clientId);
    verifyErrorResponse(ret, errors.disconnectedBridge, disconnectedEndpointId);
}

export async function testInvalidEndpoint(messageContext: DirectiveMessageContext, clientId: string) {
    const ret = await callHandler(messageContext, invalidEndpointId, clientId);
    verifyErrorResponse(ret, errors.invalidEndpoint, invalidEndpointId);
}

export async function testPoweredOffEndpoint(messageContext: DirectiveMessageContext, clientId: string) {
    const ret = await callHandler(messageContext, connectedEndpointId, clientId);
    verifyErrorResponse(ret, errors.notConnected, connectedEndpointId);
}

export async function testNotWatchingTvEndpoint(messageContext: DirectiveMessageContext, clientId: string) {
    const ret = await callHandler(messageContext, connectedEndpointId, clientId);
    verifyErrorResponse(ret, errors.notWatchingTv, connectedEndpointId);
}
export async function testStoppedEndpoint(messageContext: DirectiveMessageContext, clientId: string) {
    const ret = await callHandler(messageContext, connectedEndpointId, clientId);
    verifyErrorResponse(ret, errors.stoppedEndpoint, connectedEndpointId);
}

export async function testSuccessfulMessage(directiveContext: DirectiveMessageContext, eventContext: EventMessageContext, clientId: string) {
    const ret = await callHandler(directiveContext, connectedEndpointId, clientId);
    verifySuccessResponse(ret, eventContext, connectedEndpointId)
}

export async function testAsyncShadowMessage(sandbox: SinonSandbox, directiveContext: DirectiveMessageContext, eventContext: EventMessageContext, desiredState: EndpointState, clientId: string) {
    const shadowSpy = mockIotDataUpdateThingShadow(sandbox, (params) => {
        return {
        }
    })
    const ret = await callHandler(directiveContext, connectedEndpointId, clientId);
    verifySuccessResponse(ret, eventContext, connectedEndpointId)
    const expectedPayload = {
        state: {
            desired: desiredState
        },
        clientToken: `${messageId}-${directiveContext.messageSuffix}`
    }
    const expectedParams = {
        thingName: `${SHADOW_PREFIX}${clientId}`,
        shadowName: connectedEndpointId,
        payload: JSON.stringify(expectedPayload)
    }
    sandbox.assert.calledWith(shadowSpy, expectedParams, sandbox.match.func)
}

export async function testAsyncShadowNoUpdateMessage(sandbox: SinonSandbox, directiveContext: DirectiveMessageContext, eventContext: EventMessageContext, clientId: string) {
    const shadowSpy = mockIotDataUpdateThingShadow(sandbox, (params) => {
        return {
        }
    })
    const ret = await callHandler(directiveContext, connectedEndpointId, clientId);
    verifySuccessResponse(ret, eventContext, connectedEndpointId)
    sandbox.assert.notCalled(shadowSpy)
}
export async function testMockErrorResponse(messageContext: DirectiveMessageContext, clientId: string) {
    const ret = await callHandler(messageContext, connectedEndpointId, clientId);
    verifyErrorResponse(ret, errors.bridgeError, connectedEndpointId);
}

export async function testMockVideoErrorResponse(messageContext: DirectiveMessageContext, clientId: string) {
    const ret = await callHandler(messageContext, connectedEndpointId, clientId);
    verifyVideoErrorResponse(ret, errors.videoError);
}
export function generateReplyTopicName(messageSuffix: string, clientId: string) {
    return `vestibule-bridge/vestibule-bridge-${clientId}/alexa/event/${messageId}-${messageSuffix}`;
}
export function verifySuccessResponse(event: Event.Message, eventContext: EventMessageContext, endpointId: string) {
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
        .to.have.property('endpoint')
        .to.have.property('endpointId', endpointId);
    expect(event)
        .to.have.property('event')
        .to.have.property('payload').eql(eventContext.response);
    expect(event)
        .to.have.property('context')
        .to.have.property('properties');
}

export async function setupDisconnectedBridge(sandbox: SinonSandbox, clientId: string) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, {}, disconnectedEndpointId, false, clientId);
}

export async function setupInvalidEndpoint(sandbox: SinonSandbox, clientId: string) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, {}, '', true, clientId);
}

export async function setupPoweredOff(sandbox: SinonSandbox, clientId: string) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.off }, connectedEndpointId, true, clientId);
}

export async function setupNotWatchingTv(sandbox: SinonSandbox, clientId: string) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing }, connectedEndpointId, true, clientId);
}

export async function setupNotPlayingContent(sandbox: SinonSandbox, clientId: string) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.stopped }, connectedEndpointId, true, clientId);
}
export async function setupWatchingTv(sandbox: SinonSandbox, clientId: string) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing, ...sharedStates.channel }, connectedEndpointId, true, clientId);
}

export function setupMqttMock(subscribeHandler: (topic: string, mqttMock: MockMqttOperations) => void,
    sandbox: SinonSandbox, messageContext: DirectiveMessageContext, clientId: string) {
    mockMqtt(sandbox, subscribeHandler)
    mockIotDataPublish(sandbox, (params: IotData.PublishRequest) => {
        const topicPrefix = endpointTopicPrefix(`${SHADOW_PREFIX}${clientId}`, 'alexa', connectedEndpointId)
        expect(params.topic).to.eql(`${topicPrefix}directive/${messageContext.header.namespace}/${messageContext.header.name}`)
        return {}
    })
}

export async function generateValidScope(clientId: string): Promise<Message.Scope> {
    const token = await generateValidToken(clientId);
    return {
        type: 'BearerToken',
        token: token
    }
}
