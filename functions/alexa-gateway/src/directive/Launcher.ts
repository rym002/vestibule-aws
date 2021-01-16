import { Discovery, Launcher, Video } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, EndpointState, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import { DirectiveMessage } from './DirectiveTypes';
import { EndpointRecord } from './DiscoveryTypes';
import { createAlexaResponse, DefaultEndpointOnHandler, MessageHandlingFlags } from "./Endpoint";

type DirectiveNamespace = Launcher.NamespaceType;
const namespace: DirectiveNamespace = Launcher.namespace;

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
            sync: true
        }
    }

    getError(error: any, message: SubType<DirectiveMessage, DirectiveNamespace>, messageId: string): SubType<DirectiveErrorResponse, DirectiveNamespace> {
        if (error.errorType) {
            const vError: ErrorHolder = error;
            if (vError.errorType === Video.namespace) {
                return <SubType<DirectiveErrorResponse, DirectiveNamespace>><unknown>{
                    namespace: vError.errorType,
                    name: 'ErrorResponse',
                    payload: vError.errorPayload
                }
            }
        }
        return super.getError(error, message, messageId);
    }
}

export default new Handler();