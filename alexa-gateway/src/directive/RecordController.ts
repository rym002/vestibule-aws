import { Alexa, Discovery, RecordController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, SubType } from '@vestibule-link/iot-types';
import { ContextPropertyReporter, DirectiveMessage, EndpointStateMetadata, EndpointStateMetadataValue, EndpointStateValue, NamedContextValue } from './DirectiveTypes';
import { EndpointRecord } from './DiscoveryTypes';
import { createAlexaResponse, DefaultNotStoppedHandler, MessageHandlingFlags, shadowToDate } from './Endpoint';

type DirectiveNamespace = RecordController.NamespaceType;
const namespace: DirectiveNamespace = RecordController.namespace;

class Handler extends DefaultNotStoppedHandler<DirectiveNamespace> implements ContextPropertyReporter<DirectiveNamespace>{
    private readonly operationMap = new Map<RecordController.Operations, RecordController.States>()
    constructor() {
        super()
        this.operationMap
            .set('StartRecording', 'RECORDING')
            .set('StopRecording', 'NOT_RECORDING')
    }
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
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        const operation = message.name;
        const recordingStates = states[namespace];
        const currentState: RecordController.States | undefined = recordingStates ? recordingStates.RecordingState : undefined
        const desiredState = this.operationMap.get(operation);

        if (desiredState == currentState) {
            return {}
        } else {
            return {
                desired: {
                    [namespace]: {
                        RecordingState: desiredState
                    }
                },
                sync: false
            }

        }
    }
}

export default new Handler();