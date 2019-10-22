import { EndpointCapability, EndpointState } from '@vestibule-link/iot-types';
import 'mocha';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';
import { callHandler, DirectiveMessageContext, EventMessageContext, testDisconnectedBridge, testInvalidEndpoint, testSuccessfulMessage, emptyParameters } from './TestHelper';

describe('Alexa', function (){
    context('ReportState', function (){
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
            context('connected bridge', function (){
            before(async function (){
                await directiveMocks(emptyParameters);
                mockEndpointState(state, localEndpoint, true, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })

            it('should return the State', async function (){
                const ret = await callHandler(messageContext, '')
                await testSuccessfulMessage(messageContext, eventContext)
            })

            it('should return NO_SUCH_ENDPOINT', async function (){
                await testInvalidEndpoint(messageContext);
            })
        })

        context('disconnected bridge', function (){
            before(async function (){
                await directiveMocks(emptyParameters);
                mockEndpointState(state, localEndpoint, false, vestibuleClientId);
            })
            after(() => {
                resetDirectiveMocks()
            })

            it('should return BRIDGE_UNREACHABLE', async function (){
                await testDisconnectedBridge(messageContext);
            })
        })
    })
})