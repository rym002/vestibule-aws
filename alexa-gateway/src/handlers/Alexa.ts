import { DefaultEndpointHandler, TrackedEndpointShadow, convertToContext } from './Endpoint';
import { DirectiveMessage, DirectiveResponseByNamespace } from '.';
import { LocalEndpoint, SubType } from '@vestibule-link/iot-types';
import { Alexa } from '@vestibule-link/alexa-video-skill-types';

type DirectiveNamespace = Alexa.NamespaceType;
const namespace: DirectiveNamespace = Alexa.namespace;

class Handler extends DefaultEndpointHandler<DirectiveNamespace> {
    async getEndpointResponse(message: SubType<DirectiveMessage, DirectiveNamespace>, messageId: string,
        localEndpoint: LocalEndpoint, trackedEndpoint: TrackedEndpointShadow,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        if (!message.header.correlationToken) {
            throw 'Missing Correlation Token';
        }
        const messageContext = convertToContext(trackedEndpoint);
        return {
            namespace: namespace,
            name: 'StateReport',
            endpoint: {
                endpointId: message.endpoint.endpointId
            },
            context: messageContext,
            payload: {}
        }
    }
}

export default new Handler();