import { DefaultEndpointOnHandler, ContextPropertyReporter, MessageHandlingFlags, shadowToDate, createAlexaResponse, EndpointStateValue, EndpointStateMetadataValue, NamedContextValue } from "./Endpoint";
import { EndpointState, ErrorHolder, SubType, EndpointCapability, EndpointStateMetadata } from '@vestibule-link/iot-types';
import { Discovery, Alexa, ChannelController } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveMessage } from ".";

type DirectiveNamespace = ChannelController.NamespaceType;
const namespace = ChannelController.namespace;

class Handler extends DefaultEndpointOnHandler<DirectiveNamespace> implements ContextPropertyReporter<DirectiveNamespace>{
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
        let requestPayload: ChannelController.ChangeChannelRequest | ChannelController.SkipChannelsRequest | undefined = message.payload;
        if (message.name == 'ChangeChannel') {
            const metadata = message.payload.channelMetadata;
            const hasMetadata = metadata && metadata.name
            if (!hasMetadata && channelState) {
                if (message.payload.channel) {
                    requestPayload = undefined;
                    const requestedChannel = message.payload.channel;

                    if (
                        (requestedChannel.number != undefined && requestedChannel.number != channelState.number)
                        || (requestedChannel.callSign != undefined && requestedChannel.callSign != channelState.callSign)
                        || (requestedChannel.affiliateCallSign != undefined && requestedChannel.affiliateCallSign != channelState.affiliateCallSign)
                    )
                    requestPayload = message.payload;
                }
            }
        }

        return {
            request: requestPayload,
            sync: true
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

    convertToProperty<K extends keyof Alexa.NamedContext[DirectiveNamespace],
        SK extends keyof NonNullable<EndpointState[DirectiveNamespace]>,
        MK extends keyof NonNullable<EndpointStateMetadata[DirectiveNamespace]>>(key: K,
            states: EndpointStateValue<DirectiveNamespace, SK>,
            metadata: EndpointStateMetadataValue<DirectiveNamespace, MK>): NamedContextValue<DirectiveNamespace, K> {

        const channelNumberDate = metadata['number'] ? shadowToDate(metadata['number']) : new Date();
        return <NamedContextValue<DirectiveNamespace, K>><unknown>{
            namespace: namespace,
            name: key,
            value: states,
            timeOfSample: channelNumberDate
        }
    }
}

export default new Handler();