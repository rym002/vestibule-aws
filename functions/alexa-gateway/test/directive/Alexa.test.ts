import { EndpointCapability, EndpointState } from '@vestibule-link/iot-types';
import 'mocha';
import { getContextSandbox } from '../mocks/Sandbox';
import { directiveMocks } from '../mocks/DirectiveMocks';
import { mockEndpointState } from '../mocks/StateMocks'
import { connectedEndpointId, DirectiveMessageContext, disconnectedEndpointId, EventMessageContext, testDisconnectedBridge, testInvalidEndpoint, testSuccessfulMessage } from './TestHelper';


describe('Alexa', function () {
    context('ReportState', function () {
        const clientId = 'Alexa.ReportState'
        const header = {
            namespace: 'Alexa',
            name: 'ReportState',
            correlationToken: '123'
        }
        const state: EndpointState = {
            'Alexa.PlaybackStateReporter': {
                playbackState: { state: "PLAYING" }
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
                namespace: 'Alexa.PlaybackStateReporter',
                name: 'playbackState',
                value: { state: 'PLAYING' }
            }],
            header: {
                namespace: 'Alexa',
                name: 'StateReport'
            },
            response: {}
        }
        beforeEach(async function () {
            const sandbox = getContextSandbox(this)
            await directiveMocks(sandbox);
        })
        context('connected bridge', function () {
            beforeEach(function () {
                const sandbox = getContextSandbox(this)
                mockEndpointState(sandbox, state, connectedEndpointId, true, clientId);
            })
            it('should return the State', async function () {
                await testSuccessfulMessage(messageContext, eventContext, clientId)
            })

            it('should return NO_SUCH_ENDPOINT', async function () {
                await testInvalidEndpoint(messageContext, clientId)
            })
        })

        context('disconnected bridge', function () {
            beforeEach(function () {
                const sandbox = getContextSandbox(this)
                mockEndpointState(sandbox, state, disconnectedEndpointId, false, clientId);
            })

            it('should return BRIDGE_UNREACHABLE', async function () {
                await testDisconnectedBridge(messageContext, clientId)
            })
        })
    })
})