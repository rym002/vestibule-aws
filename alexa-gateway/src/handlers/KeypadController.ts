import { Discovery, KeypadController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, SubType } from '@vestibule-link/iot-types';
import { DirectiveMessage } from '.';
import { EndpointRecord, listToTypedStringArray } from './Discovery';
import { createAlexaResponse, DefaultEndpointOnHandler, MessageHandlingFlags } from './Endpoint';

type DirectiveNamespace = KeypadController.NamespaceType;
const namespace: DirectiveNamespace = KeypadController.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            keys:listToTypedStringArray(capabilities.L)
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