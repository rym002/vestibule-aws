import { DefaultEndpointOnHandler, MessageHandlingFlags, createAlexaResponse } from './Endpoint';
import { SubType, EndpointCapability, EndpointState } from '@vestibule-link/iot-types';
import { Discovery, RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveMessage } from '.';

type DirectiveNamespace = RemoteVideoPlayer.NamespaceType;
const namespace: DirectiveNamespace = RemoteVideoPlayer.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;
    getCapability(capabilities: NonNullable<SubType<EndpointCapability, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace
        }
    }
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        return {
            request: message.payload,
            sync: true
        }
    }
}

export default new Handler();