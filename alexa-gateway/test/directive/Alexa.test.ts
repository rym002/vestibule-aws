import { EndpointCapability, EndpointState } from '@vestibule-link/iot-types';
import 'mocha';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, vestibuleClientId } from '../mock/IotDataMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { callHandler, DirectiveMessageContext, EventMessageContext, testDisconnectedBridge, testInvalidEndpoint, testSuccessfulMessage } from './TestHelper';

describe('Alexa', function () {
    beforeEach(function(){
        const sandbox = createContextSandbox(this)
    })
    afterEach(function(){
        restoreSandbox(this)
    })
    context('ReportState', function () {
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
        afterEach(function () {
            resetDirectiveMocks()
        })
        context('connected bridge', function () {
            beforeEach(function () {
                const sandbox = getContextSandbox(this)
                mockEndpointState(sandbox, state, localEndpoint, true, vestibuleClientId);
            })
            it('should return the State', async function () {
                const ret = await callHandler(messageContext, '')
                await testSuccessfulMessage(messageContext, eventContext)
            })

            it('should return NO_SUCH_ENDPOINT', async function () {
                await testInvalidEndpoint(messageContext);
            })
        })

        context('disconnected bridge', function () {
            beforeEach(function () {
                const sandbox = getContextSandbox(this)
                mockEndpointState(sandbox, state, localEndpoint, false, vestibuleClientId);
            })

            it('should return BRIDGE_UNREACHABLE', async function () {
                await testDisconnectedBridge(messageContext);
            })
        })
    })
})