import { ContextPropertyReporter, DefaultEndpointCapabilityHandler, TrackedEndpointShadow, shadowToDate, NamedContextValue, EndpointStateValue, EndpointStateMetadataValue, convertToContext } from './Endpoint';
import { SubType, EndpointCapability, EndpointState, LocalEndpoint, ErrorHolder, EndpointStateMetadata } from '@vestibule-link/iot-types';
import { Alexa, Discovery, PowerController } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveMessage, DirectiveResponseByNamespace } from '.';
import wol from './WOL';

type DirectiveNamespace = PowerController.NamespaceType;
const namespace: DirectiveNamespace = PowerController.namespace;

class Handler extends DefaultEndpointCapabilityHandler<DirectiveNamespace> implements ContextPropertyReporter<DirectiveNamespace>{
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

    async getEndpointResponse(message: SubType<DirectiveMessage, DirectiveNamespace>, messageId: string,
        localEndpoint: LocalEndpoint, trackedEndpoint: TrackedEndpointShadow,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        const name = message.name;
        let error = undefined;
        switch (name) {
            case 'TurnOn':
                const shadowEndpoint = trackedEndpoint.endpoint;
                const powerStates = shadowEndpoint.states ? shadowEndpoint.states[namespace] : undefined;
                const powerState = powerStates ? powerStates.powerState : undefined;

                if (message.header.correlationToken && shadowEndpoint.states && powerState == 'OFF') {
                    await wol.sendEvent(userSub, messageId, message.endpoint.endpointId, trackedEndpoint, message.header.correlationToken);
                    const context = convertToContext(trackedEndpoint);
                    return {
                        namespace: Alexa.namespace,
                        name: 'Response',
                        endpoint: {
                            endpointId: message.endpoint.endpointId
                        },
                        context: context,
                        payload: {}
                    }
                }
                error = {
                    errorType: Alexa.namespace,
                    errorPayload: {
                        type: 'INVALID_VALUE',
                        message: 'Endpoint does not support TurnOn'
                    }
                }
                break;
            case 'TurnOff':
                //TODO support turn off
                error = {
                    errorType: Alexa.namespace,
                    errorPayload: {
                        type: 'INVALID_DIRECTIVE',
                        message: 'TurnOff not supported'
                    }
                }
                break;
        }

        throw error;
    }
}

export default new Handler();