import 'mocha';
import * as event from '../../src/event';
import { handler } from '../../src/event/handler';
import { directiveMocks } from '../mock/DirectiveMocks';
import { fakeCallback, FakeContext } from '../mock/LambdaMock';
import { createContextSandbox, restoreSandbox } from '../mock/Sandbox';

describe('IOT Event', function () {
    beforeEach(async function () {
        const sandbox = createContextSandbox(this)
        await directiveMocks(sandbox);
        sandbox.stub(event, 'createEndpointRequest').returns(Promise.resolve({
            endpointId: 'testEndpointId',
            scope: {
                type: 'BearerToken',
                token: ''
            }
        }))
        sandbox.stub(event, 'sendAlexaEvent').returns(Promise.resolve())
    })
    afterEach(function () {
        restoreSandbox(this)
    })

    it('should send events', function () {
        handler({
            userSub: 'testSub',
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
        }, new FakeContext(''),
            fakeCallback)
    })
})