import { Alexa, Directive, Message } from "@vestibule-link/alexa-video-skill-types";
import { DirectiveErrorResponse, DirectiveResponse, EndpointState, Shadow, ShadowMetadata, ShadowState, SubType } from "@vestibule-link/iot-types";
import { contextReporters } from '.'
import { map } from 'lodash'
export const SHADOW_PREFIX = 'vestibule-bridge-'

export interface ContextPropertyReporter<NS extends Alexa.ContextInterfaces> {
    convertToProperty<K extends keyof Alexa.NamedContext[NS], SK extends keyof NonNullable<EndpointState[NS]>, MK extends keyof NonNullable<EndpointStateMetadata[NS]>>(key: K, states: EndpointStateValue<NS, SK>, metadata: EndpointStateMetadataValue<NS, MK>): NamedContextValue<NS, K>
}

export type DirectiveMessage = {
    [NS in Directive.Namespaces]: {
        [N in keyof Directive.NamedMessage[NS]]: {
            namespace: NS
            name: N
        }
        & Directive.NamedMessage[NS][N]
    }[keyof Directive.NamedMessage[NS]]
}

export interface DirectiveHandler<NS extends Directive.Namespaces> {
    getScope(message: SubType<DirectiveMessage, NS>): Message.Scope
    getResponse(message: SubType<DirectiveMessage, NS>, messageId: string, userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>>
    getError(error: any, message: SubType<DirectiveMessage, NS>, messageId: string): SubType<DirectiveErrorResponse, NS>
}

export type DirectiveResponseByNamespace = {
    [NS in keyof DirectiveResponse]: {
        [N in keyof DirectiveResponse[NS]]: DirectiveResponse[NS][N]
    }[keyof DirectiveResponse[NS]]
}

export type EndpointStateMetadata = ShadowMetadata<EndpointState>
export type EndpointStateValue<NS extends keyof NonNullable<EndpointState>, K extends keyof NonNullable<EndpointState[NS]>> = NonNullable<NonNullable<EndpointState[NS]>[K]>
export type EndpointStateMetadataValue<NS extends keyof NonNullable<EndpointStateMetadata>, K extends keyof NonNullable<EndpointStateMetadata[NS]>> = NonNullable<NonNullable<EndpointStateMetadata[NS]>[K]>
export type NamedContextValue<NS extends keyof NonNullable<Alexa.NamedContext>, K extends keyof NonNullable<Alexa.NamedContext[NS]>> = NonNullable<NonNullable<Alexa.NamedContext[NS]>[K]>

type ReportedState = Required<Pick<ShadowState<EndpointState>, 'reported'>>
export type ValidEndpointState = {
    state: ReportedState,
    metadata: ShadowMetadata<ReportedState>
}

export function convertToContext(endpointShadow: Shadow<EndpointState>): Alexa.Context {
    const endpoint = endpointShadow.state?.reported;
    const endpointMetadata = endpointShadow.metadata?.reported
    if (endpoint && endpointMetadata) {
        const contextStates = map(endpoint, (componentStates, reporterNameKey) => {
            const reporterName = <Alexa.ContextInterfaces>reporterNameKey
            const componentMetadata = endpointMetadata[reporterName];
            if (componentStates && componentMetadata) {
                const reporter: ContextPropertyReporter<typeof reporterName> = contextReporters[reporterName];
                const componentCapabilities = map(componentStates, (stateValue, key) => {
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
        }, [])
        return {
            properties: contextStates
        }
    }
    return {
        properties: []
    }
}
