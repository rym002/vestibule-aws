import { expect } from 'chai';
import { Alexa, PlaybackStateReporter, EndpointHealth, Launcher,VideoRecorder } from '@vestibule-link/alexa-video-skill-types';
import { convertToContext } from '../src/context'
import { EndpointState, Metadata, Shadow } from '@vestibule-link/iot-types'
import { EndpointStateMetadata, EndpointStateValue, EndpointStateMetadataValue, shadowToDate } from '../src/context/types'
import 'mocha';


describe('Context', () => {
    context('ChannelController', function () {
        const namespace = 'Alexa.ChannelController'

        it('should convert shadow to property', async function () {
            const value = {
                number: '10',
                callSign: 'CS',
                affiliateCallSign: 'ACS'
            }
            const metadata = {
                number: {
                    timestamp: 100
                },
                callSign: {
                    timestamp: 100
                },
                affiliateCallSign: {
                    timestamp: 100
                }
            }
            const name = 'channel'
            verifyContext(namespace, name, value, metadata, metadata.number)
        })

    })
    context('PowerController', function () {
        const namespace = 'Alexa.PowerController'
        it('should convert shadow to property', async function () {
            const value = 'OFF'
            const metadata = {
                timestamp: 100
            }
            const name = 'powerState'
            verifyContext(namespace, name, value, metadata, metadata)
        })
    })
    context('RecordController', function () {
        const namespace = 'Alexa.RecordController'
        it('should convert shadow to property', async function () {
            const value = 'RECORDING'
            const metadata = {
                timestamp: 100
            }
            const name = 'RecordingState'
            verifyContext(namespace, name, value, metadata, metadata)
        })
    })
    context('Launcher', function () {
        const namespace = 'Alexa.Launcher'
        it('should convert shadow to property', async function () {
            const value: Launcher.Targets = {
                identifier: 'amzn1.alexa-ask-target.shortcut.87246',
                name: 'Accessibility Settings'
            }
            const metadata = {
                identifier: {
                    timestamp: 100
                },
                name: {
                    timestamp: 100
                }
            }
            const name = 'target'
            verifyContext(namespace, name, value, metadata, metadata.identifier)
        })
    })
    context('VideoRecorder', function () {
        const namespace = 'Alexa.VideoRecorder'
        it('should convert shadow isExtendedRecordingGUIShown to property', async function () {
            const value = false
            const metadata = {
                timestamp: 100
            }
            const name = 'isExtendedRecordingGUIShown'
            verifyContext(namespace, name, <never>value, <never>metadata, metadata)
        })
        it('should convert shadow storageLevel to property', async function () {
            const value = 10
            const metadata = {
                timestamp: 100
            }
            const name = 'storageLevel'
            verifyContext(namespace, name, <never>value, <never>metadata, metadata)
        })
    })
    context('EndpointHealth', function () {
        const namespace = 'Alexa.EndpointHealth'
        it('should convert shadow to property', async function () {
            const value = {
                value: <EndpointHealth.States>'OK'
            }
            const metadata = {
                value: {
                    timestamp: 100
                }
            }
            const name = 'connectivity'
            verifyContext(namespace, name, value, metadata, metadata.value)
        })
    })
    context('PlaybackStateReporter', function () {
        const namespace = 'Alexa.PlaybackStateReporter';
        it('should convert shadow to property', async function () {
            const value = {
                state: <PlaybackStateReporter.States>'PLAYING'
            }
            const metadata = {
                state: {
                    timestamp: 100
                }
            }
            const name = 'playbackState'
            verifyContext(namespace, name, value, metadata, metadata.state)
        })

    })
})
function makeEndpointShadow<NS extends Alexa.ContextInterfaces, K extends keyof Alexa.NamedContext[NS],
    SK extends keyof NonNullable<EndpointState[NS]>,
    MK extends keyof NonNullable<EndpointStateMetadata[NS]>>(namespace: NS, key: K, states: EndpointStateValue<NS, SK>,
        metadata: EndpointStateMetadataValue<NS, MK>): Shadow<EndpointState> {
    return {
        state: {
            reported: {
                [namespace]: {
                    [key]: states
                }
            }
        },
        metadata: {
            reported: {
                [namespace]: {
                    [key]: metadata
                }
            }
        }
    }
}

function verifyContext<NS extends Alexa.ContextInterfaces, K extends keyof Alexa.NamedContext[NS],
    SK extends keyof NonNullable<EndpointState[NS]>,
    MK extends keyof NonNullable<EndpointStateMetadata[NS]>>(
        namespace: NS, name: K, value: EndpointStateValue<NS, SK>,
        metadata: EndpointStateMetadataValue<NS, MK>, timestampMetadata: Metadata): void {


    const shadow = makeEndpointShadow(namespace, name,
        value, metadata)
    const context = convertToContext(shadow)
    expect(context).to.have.property('properties').to.have.length(1)
    expect(context.properties[0]).to.eql({
        namespace,
        name,
        value,
        uncertaintyInMilliseconds: 0,
        timeOfSample: shadowToDate(timestampMetadata)
    })

}
