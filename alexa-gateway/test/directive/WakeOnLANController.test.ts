import 'mocha';
import { SinonSpy } from 'sinon';
import wolHandler from '../../src/directive/WOL';
import * as eventHandler from '../../src/event/AlexaGateway';
import { localEndpoint, messageId, vestibuleClientId } from '../mock/IotDataMock';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';

describe('WakeOnLANController', function () {
    beforeEach(function () {
        const sandbox = createContextSandbox(this)
        sandbox.stub(eventHandler, 'sendAlexaEvent').usingPromise(Promise.resolve());
        sandbox.stub(eventHandler, 'createEndpointRequest').returns(Promise.resolve({
            endpointId: 'testEndpointId',
            scope: {
                type: 'BearerToken',
                token: ''
            }
        }));
    })

    afterEach(function () {
        restoreSandbox(this)
    })
    it('should call authorization', async function () {
        await wolHandler.sendEvent(vestibuleClientId, messageId, localEndpoint,
            {
                metadata: {
                    reported: {}
                },
                state: {
                    reported: {}
                }
            }, '')
        getContextSandbox(this).assert.called(<SinonSpy<any, any>>eventHandler.sendAlexaEvent);
    })
})