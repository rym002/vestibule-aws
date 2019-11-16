import 'mocha';
import { handler } from '../../src/event/handler'
import { FakeContext, fakeCallback } from '../mock/LambdaMock'
import { createSandbox } from 'sinon';
import * as event from '../../src/event';
import { directiveMocks } from '../mock/DirectiveMocks';
import { emptyParameters } from '../directive/TestHelper';

describe('IOT Event', function () {
    const sandbox = createSandbox()
    before(async function () {
        await directiveMocks(emptyParameters);
        sandbox.stub(event, 'createEndpointRequest').returns(Promise.resolve({
            endpointId: 'testEndpointId',
            scope: {
                type: 'BearerToken',
                token: ''
            }
        }))
        sandbox.stub(event, 'sendAlexaEvent').returns(Promise.resolve())
    })
    after(function () {
        sandbox.restore()
    })

    it('should send events', function () {
        handler({
            userSub: 'testSub',
            shadow: {
                state: {
                    reported: {
                        connected: true,
                        endpoints: {
                            'testendpoint': {
                                'Alexa.PowerController': {
                                    'powerState': 'OFF'
                                }
                            }
                        }
                    }
                },
                metadata: {
                    reported: {
                        endpoints: {
                            'testendpoint': {
                                'Alexa.PowerController': {
                                    'powerState': {
                                        timestamp: 100000
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }, new FakeContext(''),
            fakeCallback)
    })
})