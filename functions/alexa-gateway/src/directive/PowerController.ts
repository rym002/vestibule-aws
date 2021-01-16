import { Alexa, Discovery, PowerController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointState, SubType } from '@vestibule-link/iot-types';
import { ValidEndpointState } from 'vestibule-alexa-layer';
import { DirectiveMessage, DirectiveResponseByNamespace } from './DirectiveTypes';
import { EndpointRecord } from './DiscoveryTypes';
import { createAlexaResponse, DefaultIotEndpointHandler, MessageHandlingFlags } from './Endpoint';
import wol from './WOL';

type DirectiveNamespace = PowerController.NamespaceType;
const namespace: DirectiveNamespace = PowerController.namespace;

class Handler extends DefaultIotEndpointHandler<DirectiveNamespace> {
    createResponse = createAlexaResponse;

    verifyShadowEndpoint(message: SubType<DirectiveMessage, DirectiveNamespace>, states: EndpointState) {

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
        endpointShadow: ValidEndpointState,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        const name = message.name;
        let error = undefined;
        const powerStates = endpointShadow.state.reported[namespace];
        const powerState = powerStates ? powerStates.powerState : undefined;
        switch (name) {
            case 'TurnOn':

                if (message.header.correlationToken && powerState == 'OFF') {
                    await wol.sendEvent(userSub, messageId, message.endpoint.endpointId, endpointShadow, message.header.correlationToken);
                    return this.createResponse(message, endpointShadow, {
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
                    return super.getEndpointResponse(message, messageId, endpointShadow, userSub);
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