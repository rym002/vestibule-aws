import { ContextPropertyReporter, shadowToDate, EndpointStateValue, EndpointStateMetadataValue, NamedContextValue } from './Endpoint';
import { CapabilityHandler } from './Discovery';
import { SubType, EndpointCapability, EndpointState, EndpointStateMetadata } from '@vestibule-link/iot-types';
import { Alexa, Discovery, EndpointHealth } from '@vestibule-link/alexa-video-skill-types';

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
    getCapability(capabilities: NonNullable<SubType<EndpointCapability, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            retrievable: true,
            properties: {
                supported: capabilities.map(capability => {
                    return {
                        name: capability
                    }
                })
            }
        }
    }
}

export default new Handler();