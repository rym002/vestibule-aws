import { Discovery, PlaybackController, PlaybackStateReporter } from "@vestibule-link/alexa-video-skill-types";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { DirectiveMessage } from "./DirectiveTypes";
import { EndpointRecord, listToTypedStringArray } from "./DiscoveryTypes";
import { createAlexaResponse, DefaultNotStoppedHandler, MessageHandlingFlags } from "./Endpoint";

type DirectiveNamespace = PlaybackController.NamespaceType;
const namespace: DirectiveNamespace = PlaybackController.namespace;

class Handler extends DefaultNotStoppedHandler<DirectiveNamespace> {
    private readonly operationMap = new Map<PlaybackController.Operations, PlaybackStateReporter.States>();
    constructor() {
        super()
        this.operationMap
            .set('Pause', 'PAUSED')
            .set('Play', 'PLAYING')
            .set('Stop', 'STOPPED')
    }
    createResponse = createAlexaResponse;
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            supportedOperations: listToTypedStringArray(capabilities.L)
        }
    }
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        const operation = message.name;
        const playbackStates = states[PlaybackStateReporter.namespace];
        let currentState = playbackStates && playbackStates.playbackState
            ? playbackStates.playbackState.state
            : undefined
        const desiredState = this.operationMap.get(operation)

        if (desiredState == currentState) {
            return {};
        } else {
            if (desiredState) {
                return {
                    sync: false,
                    desired: {
                        [PlaybackStateReporter.namespace]: {
                            playbackState: {
                                state: desiredState
                            }
                        }
                    }
                }
            } else {
                return {
                    request: message,
                    sync: false
                }
            }
        }
    }
}

export default new Handler();