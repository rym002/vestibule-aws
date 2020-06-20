import { Alexa, Discovery, EndpointHealth } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, EndpointStateMetadata, SubType } from '@vestibule-link/iot-types';
import { CapabilityHandler, EndpointRecord } from './Discovery';
import { ContextPropertyReporter, EndpointStateMetadataValue, EndpointStateValue, NamedContextValue, shadowToDate } from './Endpoint';

type DirectiveNamespace = EndpointHealth.NamespaceType;
const namespace: DirectiveNamespace = EndpointHealth.namespace;

class Handler implements CapabilityHandler<DirectiveNamespace>, ContextPropertyReporter<DirectiveNamespace>{
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