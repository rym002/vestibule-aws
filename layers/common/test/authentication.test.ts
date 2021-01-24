import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { authenticationProps, generateToken, generateValidToken, getSharedKey, setupCognitoMock } from '../../../mocks/CognitoMock';
import { getUserSub } from '../src/authentication';

use(chaiAsPromised);

const clientId = 'testClient'
describe('Authentication', function () {
    beforeEach(async function () {
        await setupCognitoMock();
    })
    it('should return the sub for a valid token', async function () {
        const authSub = await getUserSub(await generateValidToken(clientId))
        expect(authSub).equal(clientId);
    })

    it('should fail for an expired token', async function () {
        const key = await getSharedKey();
        const token = await generateToken(key, clientId, authenticationProps.cognito_client_ids,
            new Date(Date.now() - 5000), authenticationProps.cognito_url);
        await authErrorTest(token, 'Token Is Expired')
    })
    it('should fail for invalid client id', async function () {
        const key = await getSharedKey();
        const token = await generateToken(key, clientId, 'badClientId',
            new Date(Date.now() + 5000), authenticationProps.cognito_url);
        await authErrorTest(token, 'Token was not issued for this audience')
    })
    it('should fail for invalid iss', async function () {
        const key = await getSharedKey();
        const token = await generateToken(key, clientId, authenticationProps.cognito_client_ids,
            new Date(Date.now() + 5000),  authenticationProps.cognito_url + 'badPoolId');
        await authErrorTest(token, 'Token was not issued by a trusted issuer')
    })
})

async function authErrorTest(token: string, message: string) {
    return expect(getUserSub(token))
        .to.rejected.and.eventually.to.have.property('message').to.equal(message)
}