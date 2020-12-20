import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, EndpointState } from '@vestibule-link/iot-types';
import 'mocha';
import { directiveMocks, mockEndpointState, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, resetIotDataUpdateThingShadow, vestibuleClientId } from '../mock/IotDataMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { DirectiveMessageContext, EventMessageContext, setupDisconnectedBridge, setupInvalidEndpoint, setupPoweredOff, sharedStates, testAsyncShadowMessage, testAsyncShadowNoUpdateMessage, testDisconnectedBridge, testInvalidEndpoint, testPoweredOffEndpoint } from './TestHelper';

describe('RecordController', function () {
    const capabilities: EndpointCapability = {
        'Alexa.RecordController': ['RecordingState']
    }

    const defaultMessageContext: DirectiveMessageContext = {
        request: {},
        messageSuffix: '',
        header: {
            namespace: 'Alexa.RecordController',
            correlationToken: '123'
        }
    }

    function getDirectiveMessageContext(name: RecordController.Operations): DirectiveMessageContext {
        return {
            ...defaultMessageContext, header: {
                namespace: 'Alexa.RecordController',
                name: name
            },
            messageSuffix: name
        }
    }

    function getEventMessageContent(state: RecordController.States): EventMessageContext {
        return {
            header: {
                namespace: 'Alexa',
                name: 'Response'
            },
            response: {},
            context: [{
                namespace: 'Alexa.RecordController',
                name: 'RecordingState',
                value: state
            }]
        }
    }
    function getDesiredState(state: RecordController.States): EndpointState {
        return {
            'Alexa.RecordController': {
                RecordingState: state
            }
        }
    }
    beforeEach(async function () {
        const sandbox = createContextSandbox(this)
        await directiveMocks(sandbox);
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context(('connected bridge'), function () {
        afterEach(function () {
            resetIotDataUpdateThingShadow()
        })

        context('RECORDING', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing, ...sharedStates.record.recording }, localEndpoint, true, vestibuleClientId);
            })
            afterEach(() => {
                resetDirectiveMocks()
            })
            it('StartRecording', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                const eventContext = getEventMessageContent('RECORDING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowNoUpdateMessage(sandbox, messageContext, eventContext)
            })
            it('StopRecording', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                const eventContext = getEventMessageContent('NOT_RECORDING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('NOT_RECORDING'))
            })
        })
        context('NOT_RECORDING', function () {
            beforeEach(async function () {
                const sandbox = getContextSandbox(this);
                mockEndpointState(sandbox, { ...sharedStates.power.on, ...sharedStates.playback.playing, ...sharedStates.record.not_recording }, localEndpoint, true, vestibuleClientId);
            })
            afterEach(() => {
                resetDirectiveMocks()
            })
            it('StartRecording', async function () {
                const messageContext = getDirectiveMessageContext('StartRecording');
                const eventContext = getEventMessageContent('RECORDING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowMessage(sandbox, messageContext, eventContext, getDesiredState('RECORDING'))
            })
            it('StopRecording', async function () {
                const messageContext = getDirectiveMessageContext('StopRecording');
                const eventContext = getEventMessageContent('NOT_RECORDING');
                const sandbox = getContextSandbox(this);
                await testAsyncShadowNoUpdateMessage(sandbox, messageContext, eventContext)
            })
        })
        context('Power Off', function () {
            beforeEach(async function () {
                await setupPoweredOff(getContextSandbox(this));
            })
            afterEach(() => {
                resetDirectiveMocks()
            })
            it('should return NOT_IN_OPERATION', async function () {
                await testPoweredOffEndpoint(defaultMessageContext)
            })

        })
        context('Invalid Endpoint', function () {
            beforeEach(async function () {
                await setupInvalidEndpoint(getContextSandbox(this));
            })
            afterEach(() => {
                resetDirectiveMocks()
            })
            it('should return NO_SUCH_ENDPOINT', async function () {
                await testInvalidEndpoint(defaultMessageContext);
            })
        })
    })
    context(('disconnected bridge'), function () {
        beforeEach(async function () {
            await setupDisconnectedBridge(getContextSandbox(this));
        })
        afterEach(() => {
            resetDirectiveMocks()
        })
        it('should return BRIDGE_UNREACHABLE', async function () {
            await testDisconnectedBridge(defaultMessageContext);
        })
    })

})