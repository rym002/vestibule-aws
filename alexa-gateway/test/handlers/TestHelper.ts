import { Event, Message, Directive, Alexa } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, ErrorHolder, generateEndpointId, SubType, EndpointCapability } from "@vestibule-link/iot-types";
import { expect } from 'chai';
import { generateValidScope } from "../mock/CognitoMock";
import { localEndpoint, messageId, vestibuleClientId } from "../mock/IotDataMock";
import { handler } from '../../src/handler';
import { fakeCallback, FakeContext } from '../mock/LambdaMock';
import { directiveMocks, mockEndpointState } from '../mock/DirectiveMocks';
import { SSM } from 'aws-sdk';

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
                playbackState: "PLAYING"
            }
        },
        paused: {
            'Alexa.PlaybackStateReporter': {
                playbackState: "PAUSED"
            }
        },
        stopped: {
            'Alexa.PlaybackStateReporter': {
                playbackState: "STOPPED"
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
    record:{
        recording:{
            'Alexa.RecordController':{
                RecordingState:'RECORDING'
            }
        },
        not_recording:{
            'Alexa.RecordController':{
                RecordingState:'NOT_RECORDING'
            }
        }
    }
}

export async function generateEndpoint(endpointSuffix: string): Promise<Message.EndpointRequest> {
    return {
        endpointId: generateEndpointId(localEndpoint) + endpointSuffix,
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
        .to.have.property('endpointId', generateEndpointId(localEndpoint) + endpointSuffix)
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
    videoError:{
        errorType:'Alexa.Video',
        errorPayload:{
            type:'STORAGE_FULL',
            message:'Mock Error'
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

export async function testMockErrorResponse(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyErrorResponse(ret, errors.bridgeError, '');
}

export async function testMockVideoErrorResponse(messageContext: DirectiveMessageContext) {
    const ret = await callHandler(messageContext, '');
    verifyVideoErrorResponse(ret, errors.videoError);
}
export function generateReplyTopicName(messageSuffix: string) {
    return 'vestibule-bridge/vestibule-bridge-' + vestibuleClientId + '/alexa/event/' + messageId + '-' + messageSuffix;
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
        .to.have.property('endpointId', generateEndpointId(localEndpoint) + endpointSuffix);
    expect(event)
        .to.have.property('event')
        .to.have.property('payload').eql(eventContext.response);
    expect(event)
        .to.have.property('context')
        .to.have.property('properties');
}

export function emptyParameters(path:string):SSM.Parameter[]{
    return []
}
export async function setupDisconnectedBridge(capabilitites: EndpointCapability) {
    await directiveMocks(emptyParameters);
    mockEndpointState({}, capabilitites, localEndpoint, false, vestibuleClientId);
}

export async function setupInvalidEndpoint(capabilitites: EndpointCapability) {
    await directiveMocks(emptyParameters);
    mockEndpointState({}, capabilitites, localEndpoint, true, vestibuleClientId);
}

export async function setupPoweredOff(capabilitites: EndpointCapability) {
    await directiveMocks(emptyParameters);
    mockEndpointState({ ...sharedStates.power.off }, capabilitites, localEndpoint, true, vestibuleClientId);
}

export async function setupNotWatchingTv(capabilitites: EndpointCapability) {
    await directiveMocks(emptyParameters);
    mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing }, capabilitites, localEndpoint, true, vestibuleClientId);
}

export async function setupNotPlayingContent(capabilitites: EndpointCapability) {
    await directiveMocks(emptyParameters);
    mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.stopped }, capabilitites, localEndpoint, true, vestibuleClientId);
}
export async function setupWatchingTv(capabilitites: EndpointCapability) {
    await directiveMocks(emptyParameters);
    mockEndpointState({ ...sharedStates.power.on, ...sharedStates.playback.playing, ...sharedStates.channel }, capabilitites, localEndpoint, true, vestibuleClientId);
}