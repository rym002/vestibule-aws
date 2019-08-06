import { EndpointCapability, EndpointState } from '@vestibule-link/iot-types';
import 'mocha';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';
import { callHandler, DirectiveMessageContext, EventMessageContext, testDisconnectedBridge, testInvalidEndpoint, testSuccessfulMessage } from './TestHelper';

describe('Alexa', () => {
    context('ReportState', () => {
        const header = {
            namespace: 'Alexa',
            name: 'ReportState',
            correlationToken: '123'
        }
        const state: EndpointState = {
            'Alexa.PlaybackStateReporter': {
                playbackState: "PLAYING"
            }
        }
        const capabilitites: EndpointCapability = {
            "Alexa.ChannelController": ['channel']
        }
        const messageContext: DirectiveMessageContext = {
            header: header,
            request: {},
            messageSuffix: ''
        }
        const eventContext: EventMessageContext = {
            context: [{
                namespace:'Alexa.PlaybackStateReporter',
                name:'playbackState',
                value:'PLAYING'
            }],
            header: {
                namespace: 'Alexa',
                name: 'StateReport'
            },
            response: {}
        }
            context('connected bridge', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState(state, capabilitites, localEndpoint, true, vestibuleClientId);
            })
            after((done) => {
                resetDirectiveMocks()
            })

            it('should return the State', async () => {
                const ret = await callHandler(messageContext, '')
                await testSuccessfulMessage(messageContext, eventContext)
            })

            it('should return NO_SUCH_ENDPOINT', async () => {
                await testInvalidEndpoint(messageContext);
            })
        })

        context('disconnected bridge', () => {
            before(async () => {
                await directiveMocks([]);
                mockEndpointState(state, capabilitites, localEndpoint, false, vestibuleClientId);
            })
            after((done) => {
                resetDirectiveMocks()
            })

            it('should return BRIDGE_UNREACHABLE', async () => {
                await testDisconnectedBridge(messageContext);
            })
        })
    })
})