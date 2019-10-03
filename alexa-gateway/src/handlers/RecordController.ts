import { ContextPropertyReporter, DefaultNotStoppedHandler, MessageHandlingFlags, shadowToDate, createAlexaResponse, EndpointStateValue, EndpointStateMetadataValue, NamedContextValue } from './Endpoint';
import { SubType, EndpointCapability, EndpointState, EndpointStateMetadata } from '@vestibule-link/iot-types';
import { Alexa, Discovery, RecordController } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveMessage } from '.';

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