import { Discovery, Event, WakeOnLANController } from '@vestibule-link/alexa-video-skill-types';
import { SubType } from '@vestibule-link/iot-types';
import { CapabilityHandler, EndpointRecord, listToTypedStringArray } from './DiscoveryTypes';
import { sendAlexaEvent, createEndpointRequest } from '../event';
import { ValidEndpointState, convertToContext } from './DirectiveTypes';

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
        endpointShadow: ValidEndpointState,
        correlationToken: string) {
        const context = convertToContext(endpointShadow);
        const endpoint = await createEndpointRequest(userSub, endpointId)
        const token = endpoint.scope.type == 'BearerToken'
            ? endpoint.scope.token
            : ''
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
        await sendAlexaEvent(message, userSub, token);
    }
}

export default new Handler();