import { Alexa, ChannelController, Discovery } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import { DirectiveMessage } from "./DirectiveTypes";
import { EndpointRecord } from "./DiscoveryTypes";
import { createAlexaResponse, DefaultEndpointOnHandler, MessageHandlingFlags } from "./Endpoint";

type DirectiveNamespace = ChannelController.NamespaceType;
const namespace = ChannelController.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;
    verifyShadowEndpoint(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState) {
        super.verifyShadowEndpoint(message, states);
        if (message.name == 'SkipChannels') {
            this.verifyWatchingTv(states);
        }
    }
    verifyWatchingTv(states: EndpointState) {
        if (!states[namespace]) {
            const error: ErrorHolder = {
                errorType: Alexa.namespace,
                errorPayload: {
                    type: 'NOT_SUPPORTED_IN_CURRENT_MODE',
                    message: 'Not Watching TV'
                }
            }
            throw error;
        }
    }
    getEndpointMessageFlags(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState): MessageHandlingFlags {
        const channelStates = states[namespace];
        const channelState = channelStates ? channelStates.channel : undefined;
        let sendMessage = true
        if (message.name == 'ChangeChannel') {
            const metadata = message.payload.channelMetadata;
            const hasMetadata = metadata && metadata.name
            if (!hasMetadata && channelState) {
                if (message.payload.channel) {
                    sendMessage = false
                    const requestedChannel = message.payload.channel;

                    if (
                        (requestedChannel.number != undefined && requestedChannel.number != channelState.number)
                        || (requestedChannel.callSign != undefined && requestedChannel.callSign != channelState.callSign)
                        || (requestedChannel.affiliateCallSign != undefined && requestedChannel.affiliateCallSign != channelState.affiliateCallSign)
                    ) {
                        sendMessage = true
                    }
                }
            }
        }

        if (sendMessage) {
            return {
                request: message,
                sync: true
            }
        } else {
            return {}
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

}

export default new Handler();