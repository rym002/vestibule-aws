import { DefaultNotStoppedHandler, MessageHandlingFlags, createAlexaResponse } from "./Endpoint";
import { SubType, EndpointCapability, EndpointState } from "@vestibule-link/iot-types";
import { Discovery, PlaybackStateReporter, PlaybackController } from "@vestibule-link/alexa-video-skill-types";
import { DirectiveMessage } from ".";

type DirectiveNamespace = PlaybackController.NamespaceType;
const namespace: DirectiveNamespace = PlaybackController.namespace;

class Handler extends DefaultNotStoppedHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;
    getCapability(capabilities: NonNullable<SubType<EndpointCapability, DirectiveNamespace>>): SubType<Discovery.NamedCapabilities, DirectiveNamespace> {
        return {
            interface: namespace,
            supportedOperations: capabilities
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
            return {
                request: message.payload,
                sync: true
            }
        }
    }
}

export default new Handler();