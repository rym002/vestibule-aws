import { ContextPropertyReporter, DefaultEndpointCapabilityHandler, TrackedEndpointShadow, shadowToDate, NamedContextValue, EndpointStateValue, EndpointStateMetadataValue, convertToContext, DefaultIotEndpointHandler, createAlexaResponse, MessageHandlingFlags } from './Endpoint';
import { SubType, EndpointCapability, EndpointState, LocalEndpoint, ErrorHolder, EndpointStateMetadata } from '@vestibule-link/iot-types';
import { Alexa, Discovery, PowerController } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveMessage, DirectiveResponseByNamespace } from '.';
import wol from './WOL';

type DirectiveNamespace = PowerController.NamespaceType;
const namespace: DirectiveNamespace = PowerController.namespace;

class Handler extends DefaultIotEndpointHandler<DirectiveNamespace> implements ContextPropertyReporter<DirectiveNamespace>{
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

    verifyShadowEndpoint(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState) {

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
        if (message.name == 'TurnOff') {
            return {
                request: message,
                sync: true
            }
        }
        return {

        }
    }
    async getEndpointResponse(message: SubType<DirectiveMessage, DirectiveNamespace>, messageId: string,
        localEndpoint: LocalEndpoint, trackedEndpoint: TrackedEndpointShadow,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        const name = message.name;
        let error = undefined;
        const shadowEndpoint = trackedEndpoint.endpoint;
        const powerStates = shadowEndpoint.states ? shadowEndpoint.states[namespace] : undefined;
        const powerState = powerStates ? powerStates.powerState : undefined;
        switch (name) {
            case 'TurnOn':

                if (message.header.correlationToken && shadowEndpoint.states && powerState == 'OFF') {
                    await wol.sendEvent(userSub, messageId, message.endpoint.endpointId, trackedEndpoint, message.header.correlationToken);
                    return this.createResponse(message, trackedEndpoint, localEndpoint, {
                        response: {
                            payload: {},
                            error: false
                        }
                    })
                }
                error = {
                    errorType: Alexa.namespace,
                    errorPayload: {
                        type: 'INVALID_VALUE',
                        message: 'Endpoint is ON'
                    }
                }
                break;
            case 'TurnOff':
                if (powerState == 'ON') {
                    return super.getEndpointResponse(message, messageId, localEndpoint, trackedEndpoint, userSub);
                }
                error = {
                    errorType: Alexa.namespace,
                    errorPayload: {
                        type: 'INVALID_VALUE',
                        message: 'Endpoint is OFF'
                    }
                }
                break;
        }

        throw error;
    }
}

export default new Handler();