import { Alexa } from "@vestibule-link/alexa-video-skill-types"
import { EndpointState, Shadow } from '@vestibule-link/iot-types'
import { map } from 'lodash'
import { ContextPropertyReporter, NamedContextValue } from './types'
import ChannelController from './ChannelController'
import EndpointHealth from './EndpointHealth'
import PlaybackStateReporter from './PlaybackStateReporter'
import PowerController from './PowerController'
import RecordController from './RecordController'
import Launcher from './Launcher'
import VideoRecorder from './VideoRecorder'

export { ValidEndpointState, stateToMetadata } from './types'

type ContextPropertyReporters = {
    [NS in Alexa.ContextInterfaces]: ContextPropertyReporter<NS>
}
const contextReporters: ContextPropertyReporters = {
    'Alexa.ChannelController': ChannelController,
    'Alexa.EndpointHealth': EndpointHealth,
    'Alexa.PlaybackStateReporter': PlaybackStateReporter,
    'Alexa.PowerController': PowerController,
    'Alexa.RecordController': RecordController,
    'Alexa.Launcher': Launcher,
    'Alexa.VideoRecorder': VideoRecorder
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
