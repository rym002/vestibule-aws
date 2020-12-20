import { Discovery, PlaybackController, PlaybackStateReporter } from "@vestibule-link/alexa-video-skill-types";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { DirectiveMessage } from "./DirectiveTypes";
import { EndpointRecord, listToTypedStringArray } from "./DiscoveryTypes";
import { createAlexaResponse, DefaultNotStoppedHandler, MessageHandlingFlags } from "./Endpoint";

type DirectiveNamespace = PlaybackController.NamespaceType;
const namespace: DirectiveNamespace = PlaybackController.namespace;

class Handler extends DefaultNotStoppedHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            supportedOperations: listToTypedStringArray(capabilities.L)
        }
    }
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        const operation = message.name;
        let desiredState: PlaybackStateReporter.States | undefined = undefined;
        const playbackStates = states[PlaybackStateReporter.namespace];
        let currentState = playbackStates ? playbackStates.playbackState : undefined
        switch (operation) {
            case 'Pause':
                desiredState = 'PAUSED';
                break;
            case 'Play':
                desiredState = 'PLAYING';
                break;
            case 'Stop':
                desiredState = 'STOPPED';
                break;
        }
        if (desiredState == currentState) {
            return {};
        } else {
            if (desiredState){
                return {
                    sync: false,
                    desired:{
                        [PlaybackStateReporter.namespace]:{
                            playbackState:{
                                state:desiredState
                            }
                        }
                    }
                }
            }else{
                return {
                    request: message,
                    sync: false
                }    
            }
        }
    }
}

export default new Handler();