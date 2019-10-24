import { Alexa, Discovery, Message, PlaybackStateReporter, PowerController } from '@vestibule-link/alexa-video-skill-types';
import { AlexaEndpoint, DirectiveErrorResponse, EndpointMetadata, EndpointState, EndpointStateMetadata, ErrorHolder, getShadowEndpoint, getShadowEndpointMetadata, LocalEndpoint, ShadowMetadata, SubType, toLocalEndpoint } from '@vestibule-link/iot-types';
import * as _ from 'lodash';
import { contextReporters, DirectiveHandler, DirectiveMessage, DirectiveResponseByNamespace, SHADOW_PREFIX } from '.';
import { ensureDeviceActive, getShadow, sendMessage, TopicResponse } from '../iot';
import { CapabilityHandler, EndpointRecord } from './Discovery';

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

export interface TrackedEndpointShadow {
    metadata: EndpointMetadata
    endpoint: AlexaEndpoint
}

export abstract class DefaultEndpointHandler<NS extends EndpointNamespaces> implements DirectiveHandler<NS>{
    getScope(message: SubType<DirectiveMessage, NS>): Message.Scope {
        return message.endpoint.scope;
    }

    async lookupShadow(userSub: string) {
        const clientId = SHADOW_PREFIX + userSub;
        const shadow = await getShadow(clientId);
        ensureDeviceActive(shadow);
        return shadow;
    }
    async getResponse(message: SubType<DirectiveMessage, NS>, messageId: string,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>> {
        const shadow = await this.lookupShadow(userSub);
        const endpoint = message.endpoint;
        const localEndpoint = toLocalEndpoint(endpoint.endpointId);
        const shadowEndpoint = getShadowEndpoint(shadow, localEndpoint);
        const shadowEndpointMetadata = getShadowEndpointMetadata(shadow, localEndpoint);
        if (shadowEndpoint && shadowEndpointMetadata) {
            const trackedEndpoint: TrackedEndpointShadow = {
                endpoint: shadowEndpoint,
                metadata: shadowEndpointMetadata
            }
            return await this.getEndpointResponse(message, messageId, localEndpoint, trackedEndpoint, userSub);
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
    abstract async getEndpointResponse(message: SubType<DirectiveMessage, NS>, messageId: string,
        localEndpoint: LocalEndpoint, trackedEndpoint: TrackedEndpointShadow,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>>;

}

type DirectiveCapabilities = Extract<EndpointNamespaces, Discovery.CapabilityInterfaces>

export abstract class DefaultEndpointCapabilityHandler<NS extends DirectiveCapabilities> extends DefaultEndpointHandler<NS> implements CapabilityHandler<NS> {
    abstract getCapability(capabilities: NonNullable<SubType<EndpointRecord, NS>>): SubType<Discovery.NamedCapabilities, NS>;
}

export abstract class DefaultIotEndpointHandler<NS extends DirectiveCapabilities> extends DefaultEndpointCapabilityHandler<NS> {
    async getEndpointResponse(message: SubType<DirectiveMessage, NS>, messageId: string,
        localEndpoint: LocalEndpoint, trackedEndpoint: TrackedEndpointShadow,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>> {

        const messageFlags = this.getMessageFlags(message, trackedEndpoint.endpoint, localEndpoint);
        const iotResp = await sendMessage(
            SHADOW_PREFIX + userSub,
            messageFlags,
            messageId,
            localEndpoint
        );
        return this.createResponse(message, trackedEndpoint, localEndpoint, iotResp);
    }

    abstract createResponse(message: SubType<DirectiveMessage, NS>,
        trackedEndpoint: TrackedEndpointShadow, localEndpoint: LocalEndpoint,
        iotResp: TopicResponse): SubType<DirectiveResponseByNamespace, NS>;

    getMessageFlags(message: SubType<DirectiveMessage, NS>, shadowEndpoint: AlexaEndpoint, le: LocalEndpoint): MessageHandlingFlags {
        if (shadowEndpoint) {
            this.verifyShadowEndpoint(message, shadowEndpoint);
            return this.getEndpointMessageFlags(message, shadowEndpoint);
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
        const playbackState = playbackStates ? playbackStates.playbackState : undefined;
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

export type EndpointStateValue<NS extends keyof NonNullable<EndpointState>, K extends keyof NonNullable<EndpointState[NS]>> = NonNullable<NonNullable<EndpointState[NS]>[K]>
export type EndpointStateMetadataValue<NS extends keyof NonNullable<EndpointStateMetadata>, K extends keyof NonNullable<EndpointStateMetadata[NS]>> = NonNullable<NonNullable<EndpointStateMetadata[NS]>[K]>
export type NamedContextValue<NS extends keyof NonNullable<Alexa.NamedContext>, K extends keyof NonNullable<Alexa.NamedContext[NS]>> = NonNullable<NonNullable<Alexa.NamedContext[NS]>[K]>

export interface ContextPropertyReporter<NS extends Alexa.ContextInterfaces> {
    convertToProperty<K extends keyof Alexa.NamedContext[NS], SK extends keyof NonNullable<EndpointState[NS]>, MK extends keyof NonNullable<EndpointStateMetadata[NS]>>(key: K, states: EndpointStateValue<NS, SK>, metadata: EndpointStateMetadataValue<NS, MK>): NamedContextValue<NS, K>
}

export type ContextPropertyReporters = {
    [NS in Alexa.ContextInterfaces]: ContextPropertyReporter<NS>
}

export function shadowToDate(metadata: ShadowMetadata): Date {
    return new Date(metadata.timestamp * 1000)
}

export function createAlexaResponse<NS extends AlexaResponseNamespaces>(message: SubType<DirectiveMessage, NS>,
    trackedEndpoint: TrackedEndpointShadow, localEndpoint: LocalEndpoint,
    iotResp: TopicResponse): SubType<DirectiveResponseByNamespace, NS> {
    let resp = {};
    if (iotResp.response && iotResp.response.payload) {
        resp = iotResp.response.payload;
    }
    if (iotResp.shadow) {
        const endpointShadow = getShadowEndpoint(iotResp.shadow, localEndpoint);
        const endpointMetadata = getShadowEndpointMetadata(iotResp.shadow, localEndpoint);
        if (endpointShadow && endpointMetadata) {
            trackedEndpoint.endpoint = endpointShadow;
            trackedEndpoint.metadata = endpointMetadata;
        }
    }
    const messageContext = convertToContext(trackedEndpoint);
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

export function convertToContext(trackedEndpoint: TrackedEndpointShadow): Alexa.Context {
    const endpoint = trackedEndpoint.endpoint;
    const endpointMetadata = trackedEndpoint.metadata
    if (endpoint && endpointMetadata) {
        const states = endpoint;
        const statesMetadata = endpointMetadata;
        const contextStates = _.map(states, (componentStates, reporterNameKey) => {
            const reporterName = <Alexa.ContextInterfaces>reporterNameKey
            const componentMetadata = statesMetadata[reporterName];
            if (componentStates && componentMetadata) {
                const reporter: ContextPropertyReporter<typeof reporterName> = contextReporters[reporterName];
                const componentCapabilities = _.map(componentStates, (stateValue, key) => {
                    const keyValue = <keyof typeof componentStates>key
                    const statesMetadataValue = componentMetadata[keyValue]
                    const ret = <NamedContextValue<any, any>>reporter.convertToProperty(keyValue, stateValue, statesMetadataValue);
                    return {
                        ...ret,
                        uncertaintyInMilliseconds: 0
                    }
                })
                return componentCapabilities;
            }
            return [];
        }).filter(stateProperties => {
            return stateProperties !== undefined && stateProperties.length > 0;
        }).reduce((prev, current) => {
            return prev.concat(current);
        },[])
        return {
            properties: contextStates
        }
    }
    return {
        properties: []
    }
}

