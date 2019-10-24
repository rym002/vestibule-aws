import { Directive, Message } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, DirectiveResponse, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import Alexa from './Alexa';
import Authorization from './Authorization';
import ChannelController from './ChannelController';
import Discovery from './Discovery';
import { ContextPropertyReporters } from './Endpoint';
import EndpointHealth from './EndpointHealth';
import Launcher from './Launcher';
import PlaybackController from './PlaybackController';
import PlaybackStateReporter from './PlaybackStateReporter';
import PowerController from './PowerController';
import RecordController from './RecordController';
import RemoteVideoPlayer from './RemoteVideoPlayer';
import SeekController from './SeekController';
import VideoRecorder from './VideoRecorder';

export const SHADOW_PREFIX = 'vestibule-bridge-'

export type DirectiveMessage = {
    [NS in Directive.Namespaces]: {
        [N in keyof Directive.NamedMessage[NS]]: {
            namespace: NS
            name: N
        }
        & Directive.NamedMessage[NS][N]
    }[keyof Directive.NamedMessage[NS]]
}

export type DirectiveHandlers = {
    [NS in Directive.Namespaces]: DirectiveHandler<NS>
}

export type DirectiveResponseByNamespace = {
    [NS in keyof DirectiveResponse]: {
        [N in keyof DirectiveResponse[NS]]: DirectiveResponse[NS][N]
    }[keyof DirectiveResponse[NS]]
}

export interface DirectiveHandler<NS extends Directive.Namespaces> {
    getScope(message: SubType<DirectiveMessage, NS>): Message.Scope
    getResponse(message: SubType<DirectiveMessage, NS>, messageId: string, userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>>
    getError(error: any, message: SubType<DirectiveMessage, NS>, messageId: string): SubType<DirectiveErrorResponse, NS>
}



const handlers: DirectiveHandlers = {
    'Alexa.ChannelController': ChannelController,
    'Alexa.PlaybackController': PlaybackController,
    'Alexa.PowerController': PowerController,
    'Alexa.RecordController': RecordController,
    'Alexa.SeekController': SeekController,
    'Alexa.Discovery': Discovery,
    'Alexa.Authorization': Authorization,
    'Alexa': Alexa,
    'Alexa.RemoteVideoPlayer': RemoteVideoPlayer,
    'Alexa.Launcher': Launcher,
    'Alexa.VideoRecorder': VideoRecorder
};

export function findDirectiveHandler<NS extends Directive.Namespaces>(namespace: NS): DirectiveHandler<NS> {
    const ret = <DirectiveHandler<NS>>handlers[namespace];
    if (!ret) {
        const error: ErrorHolder = {
            errorType: 'Alexa',
            errorPayload: {
                type: 'INVALID_DIRECTIVE',
                message: 'Directive No Supported'
            }
        }
        throw error;
    }
    return ret;
}

export const contextReporters: ContextPropertyReporters = {
    'Alexa.ChannelController': ChannelController,
    'Alexa.EndpointHealth': EndpointHealth,
    'Alexa.PlaybackStateReporter': PlaybackStateReporter,
    'Alexa.PowerController': PowerController,
    'Alexa.RecordController': RecordController,
    'Alexa.Launcher': Launcher,
    'Alexa.VideoRecorder': VideoRecorder
}