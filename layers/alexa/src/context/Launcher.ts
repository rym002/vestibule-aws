import { Alexa, Launcher } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState } from '@vestibule-link/iot-types';
import { ContextPropertyReporter, EndpointStateMetadata, EndpointStateMetadataValue, EndpointStateValue, NamedContextValue, shadowToDate } from './types';

type DirectiveNamespace = Launcher.NamespaceType;
const namespace: DirectiveNamespace = Launcher.namespace;

class Reporter implements ContextPropertyReporter<DirectiveNamespace>{
    convertToProperty<K extends keyof Alexa.NamedContext[DirectiveNamespace],
        SK extends keyof NonNullable<EndpointState[DirectiveNamespace]>,
        MK extends keyof NonNullable<EndpointStateMetadata[DirectiveNamespace]>>(key: K,
            states: EndpointStateValue<DirectiveNamespace, SK>,
            metadata: EndpointStateMetadataValue<DirectiveNamespace, MK>): NamedContextValue<DirectiveNamespace, K> {
        return <NamedContextValue<DirectiveNamespace, K>><unknown>{
            namespace: namespace,
            name: key,
            value: states,
            timeOfSample: shadowToDate(metadata.name)
        }
    }
}

export default new Reporter();