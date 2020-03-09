import { Alexa, Discovery, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, EndpointStateMetadata, SubType } from '@vestibule-link/iot-types';
import { CapabilityHandler, EndpointRecord } from './Discovery';
import { ContextPropertyReporter, EndpointStateMetadataValue, EndpointStateValue, NamedContextValue, shadowToDate } from './Endpoint';

type DirectiveNamespace = PlaybackStateReporter.NamespaceType;
const namespace: DirectiveNamespace = PlaybackStateReporter.namespace;

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
            timeOfSample: shadowToDate(metadata.state)
        }
    }
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            retrievable: true,
            proactivelyReported: true,
            properties: {
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