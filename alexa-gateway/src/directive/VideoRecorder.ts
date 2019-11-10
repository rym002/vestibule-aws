import { Alexa, Discovery, Video, VideoRecorder } from "@vestibule-link/alexa-video-skill-types";
import { DirectiveErrorResponse, EndpointState, EndpointStateMetadata, ErrorHolder, getShadowEndpoint, getShadowEndpointMetadata, LocalEndpoint, SubType } from "@vestibule-link/iot-types";
import { DirectiveMessage, DirectiveResponseByNamespace } from ".";
import { TopicResponse } from "../iot";
import { EndpointRecord } from "./Discovery";
import { ContextPropertyReporter, convertToContext, DefaultEndpointOnHandler, EndpointStateMetadataValue, EndpointStateValue, MessageHandlingFlags, NamedContextValue, shadowToDate, TrackedEndpointShadow } from "./Endpoint";

type DirectiveNamespace = VideoRecorder.NamespaceType;
const namespace: DirectiveNamespace = VideoRecorder.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> implements ContextPropertyReporter<DirectiveNamespace> {
    convertToProperty<K extends keyof Alexa.NamedContext[DirectiveNamespace],
        SK extends keyof NonNullable<EndpointState[DirectiveNamespace]>,
        MK extends keyof NonNullable<EndpointStateMetadata[DirectiveNamespace]>>(key: K,
            states: EndpointStateValue<DirectiveNamespace, SK>,
            metadata: EndpointStateMetadataValue<DirectiveNamespace, MK>): NamedContextValue<DirectiveNamespace, K> {
        return <NamedContextValue<DirectiveNamespace, K>><unknown>{
            namespace: namespace,
            name: key,
            value: states,
            timeOfSample: shadowToDate(metadata)
        }
    }

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
    createResponse(message: SubType<DirectiveMessage, DirectiveNamespace>,
        trackedEndpoint: TrackedEndpointShadow, localEndpoint: LocalEndpoint,
        iotResp: TopicResponse): SubType<DirectiveResponseByNamespace, DirectiveNamespace> {
        if (iotResp.shadow) {
            const endpointShadow = getShadowEndpoint(iotResp.shadow, localEndpoint);
            const endpointMetadata = getShadowEndpointMetadata(iotResp.shadow, localEndpoint);
            if (endpointShadow && endpointMetadata) {
                trackedEndpoint.endpoint = endpointShadow;
                trackedEndpoint.metadata = endpointMetadata;
            }
        }
        const messageContext = convertToContext(trackedEndpoint);

        const response = iotResp.response ? iotResp.response : { payload: {} }
        return {
            namespace: 'Alexa.VideoRecorder',
            name: 'Alexa.SearchAndRecordResponse',
            payload: <VideoRecorder.ResponsePayload>response.payload,
            context: <any>messageContext
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
        return super.getError(error,message,messageId);
    }
}

export default new Handler();