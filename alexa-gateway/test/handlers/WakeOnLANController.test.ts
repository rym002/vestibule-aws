import { generateEndpointId } from '@vestibule-link/iot-types';
import 'mocha';
import { createSandbox, SinonSpy } from 'sinon';
import authorizationHandler from '../../src/handlers/Authorization';
import wolHandler from '../../src/handlers/WOL';
import { localEndpoint, messageId, vestibuleClientId } from '../mock/IotDataMock';

describe('WakeOnLANController', function (){
    const sandbox = createSandbox();
    before(function (){
        sandbox.stub(authorizationHandler, 'getToken').usingPromise(Promise.resolve('token'));
        sandbox.stub(authorizationHandler, 'sendAlexaEvent').usingPromise(Promise.resolve());
    })

    after(function (){
        sandbox.restore()
    })
    it('should call authorization', async function () {
        await wolHandler.sendEvent(vestibuleClientId, messageId, generateEndpointId(localEndpoint), {
            metadata: {},
            endpoint: {
            }
        }, '')
        sandbox.assert.called(<SinonSpy<any, any>>authorizationHandler.getToken);
        sandbox.assert.called(<SinonSpy<any, any>>authorizationHandler.sendAlexaEvent);
    })
})