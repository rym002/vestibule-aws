import { Discovery, Video, VideoRecorder } from "@vestibule-link/alexa-video-skill-types";
import { DirectiveErrorResponse, EndpointState, ErrorHolder, Shadow, SubType } from "@vestibule-link/iot-types";
import { convertToContext, ValidEndpointState } from 'vestibule-alexa-layer';
import { TopicResponse } from "../iot";
import { DirectiveMessage, DirectiveResponseByNamespace } from "./DirectiveTypes";
import { EndpointRecord } from "./DiscoveryTypes";
import { DefaultEndpointOnHandler, MessageHandlingFlags } from "./Endpoint";

type DirectiveNamespace = VideoRecorder.NamespaceType;
const namespace: DirectiveNamespace = VideoRecorder.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace>  {

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
        endpointShadow: ValidEndpointState,
        iotResp: TopicResponse): SubType<DirectiveResponseByNamespace, DirectiveNamespace> {
        let shadow: Shadow<EndpointState> = endpointShadow
        if (iotResp.shadow) {
            shadow = iotResp.shadow
        }
        const messageContext = convertToContext(shadow);

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
        return super.getError(error, message, messageId);
    }
}

export default new Handler();