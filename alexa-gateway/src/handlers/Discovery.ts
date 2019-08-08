import { Discovery, Message } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, EndpointCapability, EndpointInfo, Providers, Shadow, SubType } from '@vestibule-link/iot-types';
import { DirectiveHandler, DirectiveMessage, DirectiveResponseByNamespace, SHADOW_PREFIX } from '.';
import ChannelController from './ChannelController';
import EndpointHealth from './EndpointHealth';
import Launcher from './Launcher';
import PlaybackController from './PlaybackController';
import PlaybackStateReporter from './PlaybackStateReporter';
import PowerController from './PowerController';
import RecordController from './RecordController';
import RemoteVideoPlayer from './RemoteVideoPlayer';
import SeekController from './SeekController';
import VideoRecorder from './VideoRecorder';
import WakeOnLANController from './WOL';
import * as _ from 'lodash';
import { getShadow } from '../iot';

type DirectiveNamespace = Discovery.NamespaceType;

export interface CapabilityHandler<NS extends Discovery.CapabilityInterfaces> {
    getCapability(capabilities: NonNullable<SubType<EndpointCapability, NS>>): SubType<Discovery.NamedCapabilities, NS>
}

type CapabilityHandlers = {
    [NS in Discovery.CapabilityInterfaces]: CapabilityHandler<NS>
}

const handlers: CapabilityHandlers = {
    'Alexa.ChannelController': ChannelController,
    'Alexa.EndpointHealth': EndpointHealth,
    'Alexa.PlaybackController': PlaybackController,
    'Alexa.PlaybackStateReporter': PlaybackStateReporter,
    'Alexa.PowerController': PowerController,
    'Alexa.RecordController': RecordController,
    'Alexa.SeekController': SeekController,
    'Alexa.WakeOnLANController': WakeOnLANController,
    'Alexa.RemoteVideoPlayer': RemoteVideoPlayer,
    'Alexa.Launcher': Launcher,
    'Alexa.VideoRecorder': VideoRecorder
}


class Handler implements DirectiveHandler<DirectiveNamespace>{
    shouldCheckShadow() {
        return true;
    }
    getScope(message: SubType<DirectiveMessage, DirectiveNamespace>): Message.Scope {
        return message.payload.scope;
    }
    async lookupShadow(userSub: string) {
        const clientId = SHADOW_PREFIX + userSub;
        const shadow = await getShadow(clientId);
        return shadow;
    }
    async getResponse(message: SubType<DirectiveMessage,
        DirectiveNamespace>, messageId: string,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        const shadow = await this.lookupShadow(userSub);
        return {
            namespace: 'Alexa.Discovery',
            name: 'Discover.Response',
            payload: this.getResponsePayload(shadow)
        }

    }
    getError(error: any, message: SubType<DirectiveMessage, DirectiveNamespace>,
        messageId: string): SubType<DirectiveErrorResponse, DirectiveNamespace> {
        return {
            namespace: 'Alexa.Discovery',
            name: 'Discover.Response',
            payload: {
                endpoints: []
            }
        }
    }
    private getResponsePayload(shadow: Shadow): Discovery.ResponsePayload {
        if (shadow.state) {
            if (shadow.state['reported']) {
                const endpoints = shadow.state['reported'].endpoints;
                if (endpoints) {
                    const eps = Object.keys(endpoints).map(this.mapEndpoints(endpoints));

                    const flatEps: Discovery.ResponsePayload = {
                        endpoints: _.flatten(eps)
                    };
                    return flatEps;
                }
            }
        }
        throw 'Invalid Shadow';
    }
    private mapEndpoints(endpoints: Providers<'alexa'>) {
        return ((endpointId: string) => {
            const endpoint = endpoints[endpointId];
            const capabilities = endpoint.capabilities;
            let endpointCapabilities: Discovery.Capabilities[];
            if (capabilities) {
                const capabilityMapper = this.mapCapability(capabilities);
                endpointCapabilities = Object.keys(capabilities).map(capabilityMapper);
            } else {
                endpointCapabilities = [];
            }
            if (endpoint.info) {
                return this.endpointInfo(endpointCapabilities, endpoint.info);
            }
            throw 'Invalid Endpoint';
        });
    }
    private endpointInfo(endpointCapabilities: Discovery.Capabilities[], info: EndpointInfo): Discovery.Endpoint {
        const ret: Discovery.Endpoint = {
            ...info, ...{
                capabilities: endpointCapabilities
            }
        };
        return ret;
    }
    private mapCapability(capabilities: EndpointCapability) {
        return ((capabilityKey: string): Discovery.Capabilities => {
            const capabilityId = <Discovery.CapabilityInterfaces>capabilityKey;
            const capabilityState = capabilities[capabilityId];
            const handler = handlers[capabilityId];
            if (handler && capabilityState) {
                const capValue = handler.getCapability(<any>capabilityState);
                return {
                    type: 'AlexaInterface',
                    version: '3',
                    ...capValue
                }
            } else {
                throw 'Missing Handler for Capability ' + capabilityId;
            }
        });
    }
}


export default new Handler()