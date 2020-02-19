import { Alexa, Discovery, RecordController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, EndpointStateMetadata, SubType } from '@vestibule-link/iot-types';
import { DirectiveMessage } from '.';
import { EndpointRecord } from './Discovery';
import { ContextPropertyReporter, createAlexaResponse, DefaultNotStoppedHandler, EndpointStateMetadataValue, EndpointStateValue, MessageHandlingFlags, NamedContextValue, shadowToDate } from './Endpoint';

type DirectiveNamespace = RecordController.NamespaceType;
const namespace: DirectiveNamespace = RecordController.namespace;

class Handler extends DefaultNotStoppedHandler<DirectiveNamespace> implements ContextPropertyReporter<DirectiveNamespace>{
    createResponse = createAlexaResponse;
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
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        const operation = message.name;
        const recordingStates = states[namespace];
        const currentState: RecordController.States | undefined = recordingStates ? recordingStates.RecordingState : undefined
        let desiredState: RecordController.States | undefined;

        switch (operation) {
            case 'StartRecording':
                desiredState = 'RECORDING';
                break;
            case 'StopRecording':
                desiredState = 'NOT_RECORDING';
                break;
        }

        if (desiredState == currentState) {
            return {}
        } else {
            return {
                request: message,
                sync: true
            }

        }
    }
}

export default new Handler();