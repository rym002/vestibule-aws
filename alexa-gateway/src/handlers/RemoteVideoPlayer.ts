import { Discovery, RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, SubType } from '@vestibule-link/iot-types';
import { DirectiveMessage } from '.';
import { EndpointCapabilitiesRecord } from './Discovery';
import { createAlexaResponse, DefaultEndpointOnHandler, MessageHandlingFlags } from './Endpoint';

type DirectiveNamespace = RemoteVideoPlayer.NamespaceType;
const namespace: DirectiveNamespace = RemoteVideoPlayer.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;
    getCapability(capabilities: NonNullable<SubType<EndpointCapabilitiesRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace
        }
    }
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        return {
            request: message,
            sync: true
        }
    }
}

export default new Handler();