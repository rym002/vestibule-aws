import { Alexa } from "@vestibule-link/alexa-video-skill-types";
import { EndpointState, Metadata, ShadowMetadata, ShadowState } from '@vestibule-link/iot-types';
import { cloneDeepWith, isObject } from 'lodash';

export type EndpointStateMetadata = ShadowMetadata<EndpointState>
export type EndpointStateValue<NS extends keyof NonNullable<EndpointState>, K extends keyof NonNullable<EndpointState[NS]>> = NonNullable<NonNullable<EndpointState[NS]>[K]>
export type EndpointStateMetadataValue<NS extends keyof NonNullable<EndpointStateMetadata>, K extends keyof NonNullable<EndpointStateMetadata[NS]>> = NonNullable<NonNullable<EndpointStateMetadata[NS]>[K]>
export type NamedContextValue<NS extends keyof NonNullable<Alexa.NamedContext>, K extends keyof NonNullable<Alexa.NamedContext[NS]>> = NonNullable<NonNullable<Alexa.NamedContext[NS]>[K]>

type ReportedState = Required<Pick<ShadowState<EndpointState>, 'reported'>>

export type ValidEndpointState = {
    state: ReportedState,
    metadata: ShadowMetadata<ReportedState>
}


export interface ContextPropertyReporter<NS extends Alexa.ContextInterfaces> {
    convertToProperty<K extends keyof Alexa.NamedContext[NS], SK extends keyof NonNullable<EndpointState[NS]>, MK extends keyof NonNullable<EndpointStateMetadata[NS]>>(key: K, states: EndpointStateValue<NS, SK>, metadata: EndpointStateMetadataValue<NS, MK>): NamedContextValue<NS, K>
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

export function shadowToDate(metadata: Metadata): Date {
    return new Date(metadata.timestamp * 1000)
}

