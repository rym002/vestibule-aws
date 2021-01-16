import 'mocha';
import { getContextSandbox } from '../../alexa-gateway/test/mocks/Sandbox';
import * as event from 'vestibule-alexa-layer/dist/AlexaGateway';
import { handler } from '../src';
import { fakeCallback, FakeContext } from '../../../mocks/LambdaMock';
import { SinonStub } from 'sinon'
import { Alexa, Event, Message } from '@vestibule-link/alexa-video-skill-types'
import { shadowToDate } from 'vestibule-alexa-layer/dist/context/types'
describe('IOT Event', function () {
    const clientId = 'testClientId'
    const token = 'testToken'
    const messageId = 'testMessageId'
    const endpoint: Message.EndpointRequest = {
        endpointId: 'testEndpointId',
        scope: {
            type: 'BearerToken',
            token
        }
    }
    beforeEach(async function () {
        const sandbox = getContextSandbox(this)
        sandbox.stub(event, 'createEndpointRequest').returns(Promise.resolve(endpoint))
        const sendAlexaEvent = sandbox.stub(event, 'sendAlexaEvent').returns(Promise.resolve())
        this.currentTest!['sendAlexaEvent'] = sendAlexaEvent
    })

    it('should send events', async function () {
        await handler({
            userSub: clientId,
            endpointId: 'testendpoint',
            shadow: {
                state: {
                    reported: {
                        'Alexa.PowerController': {
                            'powerState': 'OFF'
                        }
                    }
                },
                metadata: {
                    reported: {
                        'Alexa.PowerController': {
                            'powerState': {
                                timestamp: 100000
                            }
                        }
                    }
                }
            }
        }, new FakeContext(messageId),
            fakeCallback)

        const payload: Alexa.ChangePayload = {
            change: {
                cause: {
                    type: 'APP_INTERACTION'
                },
                properties: [
                    {
                        namespace: 'Alexa.PowerController',
                        name: 'powerState',
                        value: 'OFF',
                        uncertaintyInMilliseconds: 0,
                        timeOfSample: shadowToDate({
                            timestamp: 100000
                        })
                    }
                ]
            }
        }

        const event: Event.Message = {
            event: {
                payload,
                endpoint,
                header: {
                    namespace: 'Alexa',
                    name: 'ChangeReport',
                    payloadVersion: '3',
                    messageId
                }
            }
        }

        const sandbox = getContextSandbox(this)
        const sendAlexaEvent: SinonStub<[Event.Message, string, string], Promise<void>> = this.test!['sendAlexaEvent']
        sandbox.assert.calledWith(sendAlexaEvent, event, clientId, token)
    })
})