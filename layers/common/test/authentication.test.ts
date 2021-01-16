import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { authenticationProps, generateToken, generateValidToken, getCognitoTestParameters, getSharedKey, setupCognitoMock } from '../../../mocks/CognitoMock';
import { getContextSandbox } from '../../../mocks/Sandbox';
import { ssmMock } from '../../../mocks/SSMMocks';
import { getUserSub } from '../src/authentication';

use(chaiAsPromised);

const clientId = 'testClient'
describe('Authentication', function () {
    beforeEach(async function () {
        const sandbox = getContextSandbox(this)
        ssmMock(sandbox, [getCognitoTestParameters]);
        await setupCognitoMock();
    })
    it('should return the sub for a valid token', async function () {
        const authSub = await getUserSub(await generateValidToken(clientId))
        expect(authSub).equal(clientId);
    })

    it('should fail for an expired token', async function () {
        const key = await getSharedKey();
        const token = await generateToken(key, clientId, authenticationProps.testClientIds[0],
            new Date(Date.now() - 5000), authenticationProps.testPoolId, authenticationProps.testRegionId);
        await authErrorTest(token, 'Token Is Expired')
    })
    it('should fail for invalid client id', async function () {
        const key = await getSharedKey();
        const token = await generateToken(key, clientId, 'badClientId',
            new Date(Date.now() + 5000), authenticationProps.testPoolId, authenticationProps.testRegionId);
        await authErrorTest(token, 'Token was not issued for this audience')
    })
    it('should fail for invalid pool id', async function () {
        const key = await getSharedKey();
        const token = await generateToken(key, clientId, authenticationProps.testClientIds[0],
            new Date(Date.now() + 5000), 'badPoolId', authenticationProps.testRegionId);
        await authErrorTest(token, 'Invalid Pool Id')
    })
})

async function authErrorTest(token: string, message: string) {
    return expect(getUserSub(token))
        .to.rejected.and.eventually.to.have.property('message').to.equal(message)
}