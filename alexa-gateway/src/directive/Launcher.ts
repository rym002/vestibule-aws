import { Alexa, Discovery, Launcher, Video } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, EndpointState, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import { ContextPropertyReporter, DirectiveMessage, EndpointStateMetadata, EndpointStateMetadataValue, EndpointStateValue, NamedContextValue } from './DirectiveTypes';
import { EndpointRecord } from './DiscoveryTypes';
import { createAlexaResponse, DefaultEndpointOnHandler, MessageHandlingFlags, shadowToDate } from "./Endpoint";

type DirectiveNamespace = Launcher.NamespaceType;
const namespace: DirectiveNamespace = Launcher.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> implements ContextPropertyReporter<DirectiveNamespace> {
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

    convertToProperty<K extends keyof Alexa.NamedContext[DirectiveNamespace],
        SK extends keyof NonNullable<EndpointState[DirectiveNamespace]>,
        MK extends keyof NonNullable<EndpointStateMetadata[DirectiveNamespace]>>(key: K,
            states: EndpointStateValue<DirectiveNamespace, SK>,
            metadata: EndpointStateMetadataValue<DirectiveNamespace, MK>): NamedContextValue<DirectiveNamespace, K> {
        return <NamedContextValue<DirectiveNamespace, K>><unknown>{
            namespace: namespace,
            name: key,
            value: states,
            timeOfSample: shadowToDate(metadata['target'])
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