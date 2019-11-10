import { Discovery, Event, WakeOnLANController } from '@vestibule-link/alexa-video-skill-types';
import { SubType } from '@vestibule-link/iot-types';
import { CapabilityHandler, EndpointRecord, listToTypedStringArray } from './Discovery';
import { convertToContext, TrackedEndpointShadow } from './Endpoint';
import { sendAlexaEvent } from '../event';

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
                endpoint:{
                    endpointId:'',
                    scope:{
                        type:'BearerToken',
                        token:''
                    }
                }
            }
        }
        await sendAlexaEvent(message, userSub, endpointId);
    }
}

export default new Handler();