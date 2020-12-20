import { Alexa, Directive, Event, Message } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, endpointTopicPrefix, ErrorHolder, SubType } from "@vestibule-link/iot-types";
import { IotData } from 'aws-sdk';
import { expect } from 'chai';
import { SinonSandbox } from 'sinon';
import { SHADOW_PREFIX } from '../../src/directive/DirectiveTypes';
import { handler } from '../../src/directive/handler';
import { generateValidScope } from "../mock/CognitoMock";
import { directiveMocks, mockEndpointState } from '../mock/DirectiveMocks';
import { localEndpoint, messageId, mockIotDataPublish, mockIotDataUpdateThingShadow, vestibuleClientId } from "../mock/IotDataMock";
import { fakeCallback, FakeContext } from '../mock/LambdaMock';
import { mockMqtt, MockMqttOperations } from '../mock/MqttMock';

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

export async function generateEndpoint(endpointSuffix: string): Promise<Message.EndpointRequest> {
    return {
        endpointId: `${localEndpoint}${endpointSuffix}`,
        scope: await generateValidScope()
    }
}

export function verifyErrorResponse(event: Event.Message, errorHolder: ErrorHolder, endpointSuffix: string) {
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
        .to.have.property('endpointId', `${localEndpoint}${endpointSuffix}`)
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
            message: 'Bridge not active',
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

export async function callHandler(messageContext: DirectiveMessageContext, endpointSuffix: string): Promise<Event.Message> {
    const endpointId = await generateEndpoint(endpointSuffix);
    return <Event.Message>await handler({
        directive: {
            header: messageContext.header,
            endpoint: endpointId,
            payload: messageContext.request
        }
    }, new FakeContext(messageId + '-' + messageContext.messageSuffix), fakeCallback);
}


export async function testDisconnectedBridge(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyErrorResponse(ret, errors.disconnectedBridge, '');
}

export async function testInvalidEndpoint(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '_bad');
    verifyErrorResponse(ret, errors.invalidEndpoint, '_bad');
}

export async function testPoweredOffEndpoint(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyErrorResponse(ret, errors.notConnected, '');
}

export async function testNotWatchingTvEndpoint(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyErrorResponse(ret, errors.notWatchingTv, '');
}
export async function testStoppedEndpoint(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyErrorResponse(ret, errors.stoppedEndpoint, '');
}

export async function testSuccessfulMessage(directiveContext: DirectiveMessageContext, eventContext: EventMessageContext) {
    const ret = await callHandler(directiveContext, '');
    verifySuccessResponse(ret, eventContext, '')
}

export async function testAsyncShadowMessage(sandbox: SinonSandbox, directiveContext: DirectiveMessageContext, eventContext: EventMessageContext, desiredState: EndpointState) {
    const shadowSpy = mockIotDataUpdateThingShadow(sandbox, (params) => {
        return {
        }
    })
    const ret = await callHandler(directiveContext, '');
    verifySuccessResponse(ret, eventContext, '')
    expect(shadowSpy.calledWith({
        thingName: vestibuleClientId,
        shadowName: localEndpoint,
        payload: {
            desired: desiredState
        }
    }), 'Invalid Desired Shadow')
}

export async function testAsyncShadowNoUpdateMessage(sandbox: SinonSandbox, directiveContext: DirectiveMessageContext, eventContext: EventMessageContext) {
    const shadowSpy = mockIotDataUpdateThingShadow(sandbox, (params) => {
        return {
        }
    })
    const ret = await callHandler(directiveContext, '');
    verifySuccessResponse(ret, eventContext, '')
    expect(shadowSpy.notCalled, 'Shadow Update not expected')
}
export async function testMockErrorResponse(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyErrorResponse(ret, errors.bridgeError, '');
}

export async function testMockVideoErrorResponse(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyVideoErrorResponse(ret, errors.videoError);
}
export function generateReplyTopicName(messageSuffix: string) {
    return `vestibule-bridge/vestibule-bridge-${vestibuleClientId}/alexa/event/${messageId}-${messageSuffix}`;
}
export function verifySuccessResponse(event: Event.Message, eventContext: EventMessageContext, endpointSuffix: string) {
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
        .to.have.property('endpointId', `${localEndpoint}${endpointSuffix}`);
    expect(event)
        .to.have.property('event')
        .to.have.property('payload').eql(eventContext.response);
    expect(event)
        .to.have.property('context')
        .to.have.property('properties');
}

export async function setupDisconnectedBridge(sandbox: SinonSandbox) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, {}, localEndpoint, false, vestibuleClientId);
}

export async function setupInvalidEndpoint(sandbox: SinonSandbox) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, {}, localEndpoint, true, vestibuleClientId);
}

export async function setupPoweredOff(sandbox: SinonSandbox) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.off }, localEndpoint, true, vestibuleClientId);
}

export async function setupNotWatchingTv(sandbox: SinonSandbox) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing }, localEndpoint, true, vestibuleClientId);
}

export async function setupNotPlayingContent(sandbox: SinonSandbox) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.stopped }, localEndpoint, true, vestibuleClientId);
}
export async function setupWatchingTv(sandbox: SinonSandbox) {
    await directiveMocks(sandbox);
    mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing, ...sharedStates.channel }, localEndpoint, true, vestibuleClientId);
}

export function setupMqttMock(subscribeHandler: (topic: string, mqttMock: MockMqttOperations) => void, sandbox: SinonSandbox, messageContext: DirectiveMessageContext) {
    mockMqtt(sandbox, subscribeHandler)
    mockIotDataPublish(sandbox, (params: IotData.PublishRequest) => {
        const topicPrefix = endpointTopicPrefix(`${SHADOW_PREFIX}${vestibuleClientId}`, 'alexa', localEndpoint)
        expect(params.topic).to.eql(`${topicPrefix}directive/${messageContext.header.namespace}/${messageContext.header.name}`)
        return {}
    })
}
