import { generateEndpointId } from '@vestibule-link/iot-types';
import 'mocha';
import { createSandbox, SinonSpy } from 'sinon';
import * as eventHandler from '../../src/event/AlexaGateway';
import wolHandler from '../../src/directive/WOL';
import { localEndpoint, messageId, vestibuleClientId } from '../mock/IotDataMock';

describe('WakeOnLANController', function () {
    const sandbox = createSandbox();
    before(function () {
        sandbox.stub(eventHandler, 'sendAlexaEvent').usingPromise(Promise.resolve());
        sandbox.stub(eventHandler, 'createEndpointRequest').returns(Promise.resolve({
            endpointId: 'testEndpointId',
            scope: {
                type: 'BearerToken',
                token: ''
            }
        }));
    })

    after(function () {
        sandbox.restore()
    })
    it('should call authorization', async function () {
        await wolHandler.sendEvent(vestibuleClientId, messageId, generateEndpointId(localEndpoint), {
            metadata: {},
            endpoint: {
            }
        }, '')
        sandbox.assert.called(<SinonSpy<any, any>>eventHandler.sendAlexaEvent);
    })
})