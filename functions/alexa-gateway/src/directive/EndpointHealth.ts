import { Discovery, EndpointHealth } from '@vestibule-link/alexa-video-skill-types';
import { SubType } from '@vestibule-link/iot-types';
import { CapabilityHandler, EndpointRecord } from './DiscoveryTypes';

type DirectiveNamespace = EndpointHealth.NamespaceType;
const namespace: DirectiveNamespace = EndpointHealth.namespace;

class Handler implements CapabilityHandler<DirectiveNamespace>{
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            properties: {
                retrievable: true,
                proactivelyReported: true,
                supported: capabilities.L.map(capability => {
                    return {
                        name: capability.S
                    }
                })
            }
        }
    }
}

export default new Handler();