import { Discovery, RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, SubType } from '@vestibule-link/iot-types';
import { DirectiveMessage } from './DirectiveTypes';
import { EndpointRecord } from './DiscoveryTypes';
import { createAlexaResponse, DefaultEndpointOnHandler, MessageHandlingFlags } from './Endpoint';

type DirectiveNamespace = RemoteVideoPlayer.NamespaceType;
const namespace: DirectiveNamespace = RemoteVideoPlayer.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace
        }
    }
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        return {
            request: message,
            sync: false
        }
    }
}

export default new Handler();