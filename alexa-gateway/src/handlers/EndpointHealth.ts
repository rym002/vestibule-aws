import { Alexa, Discovery, EndpointHealth } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, EndpointStateMetadata, SubType } from '@vestibule-link/iot-types';
import { CapabilityHandler, EndpointCapabilitiesRecord } from './Discovery';
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
    getCapability(capabilities: NonNullable<SubType<EndpointCapabilitiesRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            retrievable: true,
            properties: {
                supported: capabilities.SS!.map(capability => {
                    return {
                        name: capability
                    }
                })
            }
        }
    }
}

export default new Handler();