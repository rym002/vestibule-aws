import { Discovery, Event, Message, WakeOnLANController } from '@vestibule-link/alexa-video-skill-types';
import { SubType } from '@vestibule-link/iot-types';
import authorization from './Authorization';
import { CapabilityHandler, EndpointRecord, listToTypedStringArray } from './Discovery';
import { convertToContext, TrackedEndpointShadow } from './Endpoint';

type DirectiveNamespace = WakeOnLANController.NamespaceType;
const namespace: DirectiveNamespace = WakeOnLANController.namespace;

class Handler implements CapabilityHandler<DirectiveNamespace>{
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            configuration: {
                MACAddresses: listToTypedStringArray(capabilities.L)
            }
        }
    }
    async sendEvent(userSub: string, messageId: string,
        endpointId: string,
        trackedEndpoint: TrackedEndpointShadow,
        correlationToken: string) {
        const token = await authorization.getToken(userSub);
        const bearerToken: Message.BearerToken = {
            type: 'BearerToken',
            token: token
        }
        const endpoint: Message.EndpointRequest = {
            endpointId: endpointId,
            scope: bearerToken
        }
        const context = convertToContext(trackedEndpoint);
        const message: Event.Message = {
            context: context,
            event: {
                header: {
                    namespace: WakeOnLANController.namespace,
                    name: 'WakeUp',
                    messageId: messageId,
                    correlationToken: correlationToken,
                    payloadVersion: '3'
                },
                payload: {},
                endpoint: endpoint
            }
        }
        await authorization.sendAlexaEvent(message, token, userSub);
    }
}

export default new Handler();