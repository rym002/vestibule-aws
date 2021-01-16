import 'mocha';
import { SinonSpy } from 'sinon';
import { getContextSandbox } from '../mocks/Sandbox';
import wolHandler from '../../src/directive/WOL';
import * as eventHandler from 'vestibule-alexa-layer/dist/AlexaGateway';
import { connectedEndpointId } from './TestHelper';

describe('WakeOnLANController', function () {
    const clientId = 'WakeOnLANController'
    beforeEach(function () {
        const sandbox = getContextSandbox(this)
        sandbox.stub(eventHandler, 'sendAlexaEvent').usingPromise(Promise.resolve());
        sandbox.stub(eventHandler, 'createEndpointRequest').returns(Promise.resolve({
            endpointId: 'testEndpointId',
            scope: {
                type: 'BearerToken',
                token: ''
            }
        }));
    })

    it('should call authorization', async function () {
        await wolHandler.sendEvent(clientId, 'wolMessage', connectedEndpointId,
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