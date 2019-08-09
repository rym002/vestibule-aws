import { Launcher } from '@vestibule-link/alexa-video-skill-types';
import { EndpointCapability, ResponseMessage } from '@vestibule-link/iot-types';
import { assert } from 'chai';
import 'mocha';
import * as mqtt from 'mqtt';
import { createSandbox, SinonSpy } from 'sinon';
import { resetDirectiveMocks } from '../mock/DirectiveMocks';
import { mockMqtt } from '../mock/MqttMock';
import { DirectiveMessageContext, errors, EventMessageContext, generateReplyTopicName, mockErrorSuffix, setupDisconnectedBridge, setupInvalidEndpoint, setupNotPlayingContent, setupPoweredOff, testDisconnectedBridge, testInvalidEndpoint, testMockErrorResponse, testMockVideoErrorResponse, testPoweredOffEndpoint, testSuccessfulMessage } from './TestHelper';

describe('Launcher', function (){
    const capabilities: EndpointCapability = {
        'Alexa.Launcher': true
    }

    const req: Launcher.Targets = {
        name: 'DVR',
        identifier: 'amzn1.alexa-ask-target.shortcut.69247'
    }
    const defaultMessageContext: DirectiveMessageContext = {
        request: req,
        messageSuffix: 'LaunchTarget',
        header: {
            namespace: 'Alexa.Launcher',
            name: 'LaunchTarget',
            correlationToken: '123'
        }
    }
    const eventContext: EventMessageContext = {
        header: {
            namespace: 'Alexa',
            name: 'Response'
        },
        response: {},
        context: []
    }

    context(('connected bridge'), function (){
        const sandbox = createSandbox()
        beforeEach(function (){
            mockMqtt((topic, mqttMock) => {
                let resp: ResponseMessage<any> | undefined;
                switch (topic) {
                    case generateReplyTopicName('LaunchTarget'):
                        resp = {
                            payload: {},
                            error: false
                        }
                        break;
                    case generateReplyTopicName(mockErrorSuffix + 'Video'):
                        resp = {
                            payload: errors.videoError,
                            error: true
                        }
                        break;
                    case generateReplyTopicName(mockErrorSuffix):
                        resp = {
                            payload: errors.bridgeError,
                            error: true
                        }
                        break;
                }
                if (resp && 'string' == typeof topic) {
                    mqttMock.sendMessage(topic, resp);
                }
            },sandbox)
        })
        afterEach(function (){
            sandbox.restore()
        })

        context('LaunchTarget', function (){
            before(async function (){
                await setupNotPlayingContent(capabilities)
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should send a message', async function (){
                await testSuccessfulMessage(defaultMessageContext, eventContext)
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('should map a alexa error', async function (){
                await testMockErrorResponse({ ...defaultMessageContext, messageSuffix: mockErrorSuffix });
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
            it('should map a video error', async function (){
                await testMockVideoErrorResponse({ ...defaultMessageContext, messageSuffix: mockErrorSuffix + 'Video' });
                sandbox.assert.called(<SinonSpy<any, any>><unknown>mqtt.MqttClient)
            })
        })

        context('Power Off', function (){
            before(async function (){
                await setupPoweredOff(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should return NOT_IN_OPERATION', async function (){
                await testPoweredOffEndpoint(defaultMessageContext)
            })

        })
        context('Invalid Endpoint', function (){
            before(async function (){
                await setupInvalidEndpoint(capabilities);
            })
            after(() => {
                resetDirectiveMocks()
            })
            it('should return NO_SUCH_ENDPOINT', async function (){
                await testInvalidEndpoint(defaultMessageContext);
            })
        })
    })
    context(('disconnected bridge'), function (){
        before(async function (){
            await setupDisconnectedBridge(capabilities);
        })
        after(() => {
            resetDirectiveMocks()
        })
        it('should return BRIDGE_UNREACHABLE', async function (){
            await testDisconnectedBridge(defaultMessageContext);
        })
    })

})