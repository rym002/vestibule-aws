import { Alexa, Discovery, Message, PlaybackStateReporter, PowerController } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, EndpointState, ErrorHolder, Metadata, Shadow, SubType } from '@vestibule-link/iot-types';
import { cloneDeepWith, isObject } from 'lodash';
import { ensureDeviceActive, getShadow, sendMessage, TopicResponse } from '../iot';
import { DirectiveHandler, DirectiveMessage, DirectiveResponseByNamespace, EndpointStateMetadata, SHADOW_PREFIX, ValidEndpointState, convertToContext } from './DirectiveTypes';
import { CapabilityHandler, EndpointRecord, } from './DiscoveryTypes';

type EndpointNamespaces = {
    [NS in keyof DirectiveMessage]:
    DirectiveMessage[NS] extends never
    ? never
    : DirectiveMessage[NS] extends { endpoint: Message.EndpointRequest }
    ? NS
    : never
}[keyof DirectiveMessage]

type AlexaResponseNamespaces = {
    [NS in keyof DirectiveResponseByNamespace]:
    DirectiveResponseByNamespace[NS] extends { namespace: 'Alexa', name: 'Response' }
    ? NS
    : never
}[keyof DirectiveResponseByNamespace]

export interface MessageHandlingFlags {
    desired?: EndpointState;
    request?: SubType<DirectiveMessage, any>;
    sync?: boolean
}

export abstract class DefaultEndpointHandler<NS extends EndpointNamespaces> implements DirectiveHandler<NS>{
    getScope(message: SubType<DirectiveMessage, NS>): Message.Scope {
        return message.endpoint.scope;
    }

    async lookupShadow(userSub: string, endpoint: Message.EndpointRequest) {
        const clientId = SHADOW_PREFIX + userSub;
        await ensureDeviceActive(clientId)
        const shadow = await getShadow(clientId, endpoint.endpointId);
        return shadow;
    }
    async getResponse(message: SubType<DirectiveMessage, NS>, messageId: string,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>> {
        const endpoint = message.endpoint;
        const shadow = await this.lookupShadow(userSub, endpoint);
        if (shadow.state && shadow.metadata) {
            return await this.getEndpointResponse(message, messageId, <ValidEndpointState>shadow, userSub);
        }
        const error: ErrorHolder = {
            errorType: Alexa.namespace,
            errorPayload: {
                type: 'NO_SUCH_ENDPOINT',
                message: 'Unknown Endpoint'
            }
        }
        throw error;
    }

    getError(error: any, message: SubType<DirectiveMessage, EndpointNamespaces>, messageId: string): SubType<DirectiveErrorResponse, NS> {
        if (error.errorType) {
            const vError: ErrorHolder = error;
            if (vError.errorType === Alexa.namespace) {
                return <SubType<DirectiveErrorResponse, Alexa.NamespaceType>>{
                    namespace: vError.errorType,
                    name: 'ErrorResponse',
                    payload: vError.errorPayload,
                    endpoint: {
                        endpointId: message.endpoint.endpointId
                    }
                }
            }
        }
        return <SubType<DirectiveErrorResponse, Alexa.NamespaceType>>{
            namespace: Alexa.namespace,
            name: 'ErrorResponse',
            payload: {
                type: 'INTERNAL_ERROR',
                message: 'Unknown Error'
            },
            endpoint: {
                endpointId: message.endpoint.endpointId
            }
        }
    }
    abstract getEndpointResponse(message: SubType<DirectiveMessage, NS>, messageId: string,
        endpointShadow: ValidEndpointState,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>>;

}

type DirectiveCapabilities = Extract<EndpointNamespaces, Discovery.CapabilityInterfaces>

export abstract class DefaultEndpointCapabilityHandler<NS extends DirectiveCapabilities> extends DefaultEndpointHandler<NS> implements CapabilityHandler<NS> {
    abstract getCapability(capabilities: NonNullable<SubType<EndpointRecord, NS>>): SubType<Discovery.NamedCapabilities, NS>;
}

export abstract class DefaultIotEndpointHandler<NS extends DirectiveCapabilities> extends DefaultEndpointCapabilityHandler<NS> {
    async getEndpointResponse(message: SubType<DirectiveMessage, NS>, messageId: string,
        endpointShadow: ValidEndpointState,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>> {

        const messageFlags = this.getMessageFlags(message, endpointShadow.state.reported);
        const iotResp = await sendMessage(
            SHADOW_PREFIX + userSub,
            messageFlags,
            messageId,
            message.endpoint.endpointId
        );
        return this.createResponse(message, endpointShadow, iotResp);
    }

    abstract createResponse(message: SubType<DirectiveMessage, NS>,
        endpointShadow: ValidEndpointState,
        iotResp: TopicResponse): SubType<DirectiveResponseByNamespace, NS>;

    getMessageFlags(message: SubType<DirectiveMessage, NS>, state: EndpointState): MessageHandlingFlags {
        if (state) {
            this.verifyShadowEndpoint(message, state);
            return this.getEndpointMessageFlags(message, state);
        } else {
            const error: ErrorHolder = {
                errorType: Alexa.namespace,
                errorPayload: {
                    type: 'NOT_IN_OPERATION',
                    message: 'Endpoint State Not Available'
                }
            }
            throw error;
        }
    }
    abstract getEndpointMessageFlags(message: SubType<DirectiveMessage, NS>, states: EndpointState): MessageHandlingFlags;
    abstract verifyShadowEndpoint(message: SubType<DirectiveMessage, NS>, states: EndpointState): void;
}


export abstract class DefaultEndpointOnHandler<NS extends DirectiveCapabilities> extends DefaultIotEndpointHandler<NS> {
    verifyShadowEndpoint(message: SubType<DirectiveMessage, NS>, states: EndpointState) {
        const powerStates = states[PowerController.namespace];
        const powerState = powerStates ? powerStates.powerState : undefined;
        if (powerState != 'ON') {
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'NOT_IN_OPERATION',
                    message: 'Endpoint Not Connected'
                }
            }
            throw error;
        }
    }
}

export abstract class DefaultNotStoppedHandler<NS extends DirectiveCapabilities> extends DefaultEndpointOnHandler<NS> {
    verifyShadowEndpoint(message: SubType<DirectiveMessage, NS>, states: EndpointState) {
        super.verifyShadowEndpoint(message, states);
        const playbackStates = states[PlaybackStateReporter.namespace];
        const playbackState = playbackStates ? playbackStates.playbackState?.state : undefined;
        if (playbackState == 'STOPPED') {
            const error: ErrorHolder = {
                errorType: Alexa.namespace,
                errorPayload: {
                    type: 'NOT_SUPPORTED_IN_CURRENT_MODE',
                    message: 'Content is stopped'
                }
            }
            throw error;
        }
    }
}

export function shadowToDate(metadata: Metadata): Date {
    return new Date(metadata.timestamp * 1000)
}

export function createAlexaResponse<NS extends AlexaResponseNamespaces>(message: SubType<DirectiveMessage, NS>,
    endpointShadow: ValidEndpointState,
    iotResp: TopicResponse): SubType<DirectiveResponseByNamespace, NS> {
    let resp = {};
    if (iotResp.response && iotResp.response.payload) {
        resp = iotResp.response.payload;
    }

    let shadow: Shadow<EndpointState> = endpointShadow
    if (iotResp.shadow) {
        shadow = iotResp.shadow
    }
    const messageContext = convertToContext(shadow);
    return {
        namespace: 'Alexa',
        name: 'Response',
        context: messageContext,
        payload: resp,
        endpoint: {
            endpointId: message.endpoint.endpointId
        }
    }
}
export function stateToMetadata(state: EndpointState) {
    const updateTime = Math.floor(Date.now() / 1000);
    const metadata: EndpointStateMetadata = cloneDeepWith(state, (value) => {
        if (!isObject(value)) {
            const ret: Metadata = {
                timestamp: updateTime
            }
            return ret;
        }
    })
    return metadata;
}
