import { DefaultEndpointHandler } from './Endpoint';
import { DirectiveMessage, DirectiveResponseByNamespace, ValidEndpointState, convertToContext } from './DirectiveTypes';
import { SubType } from '@vestibule-link/iot-types';
import { Alexa } from '@vestibule-link/alexa-video-skill-types';

type DirectiveNamespace = Alexa.NamespaceType;
const namespace: DirectiveNamespace = Alexa.namespace;

class Handler extends DefaultEndpointHandler<DirectiveNamespace> {    
    async getEndpointResponse(message: SubType<DirectiveMessage, DirectiveNamespace>, messageId: string,
        endpointShadow: ValidEndpointState,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        if (!message.header.correlationToken) {
            throw new Error('Missing Correlation Token');
        }
        const messageContext = convertToContext(endpointShadow);
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