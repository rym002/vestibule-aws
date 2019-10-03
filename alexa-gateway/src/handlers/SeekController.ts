import { DefaultNotStoppedHandler, MessageHandlingFlags, TrackedEndpointShadow } from './Endpoint';
import { EndpointCapability, SubType, EndpointState, LocalEndpoint } from '@vestibule-link/iot-types';
import { Discovery, SeekController } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveMessage, DirectiveResponseByNamespace } from '.';
import { TopicResponse } from '../iot';

type DirectiveNamespace = SeekController.NamespaceType;
const namespace: DirectiveNamespace = SeekController.namespace;

class Handler extends DefaultNotStoppedHandler<DirectiveNamespace> {
    getCapability(capabilities: NonNullable<SubType<EndpointCapability, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
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
        const response = iotResp.response ? iotResp.response : { payload: {} }
        return {
            namespace: 'Alexa.SeekController',
            name: 'StateReport',
            payload: response.payload
        }
    }
}

export default new Handler();