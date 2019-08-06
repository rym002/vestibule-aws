import { Message } from '@vestibule-link/alexa-video-skill-types';
import { SSM } from 'aws-sdk';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { getSub } from '../src/authentication';
import { authenticationProps, generateToken, generateValidScope, getCognitoTestParameters, getSharedKey, setupCognitoMock } from './mock/CognitoMock';
import { vestibuleClientId } from './mock/IotDataMock';
import { mockSSM, resetSSM } from './mock/SSMMocks';

use(chaiAsPromised);

describe('Authentication', () => {
    describe('BearerToken', () => {
        before(async () => {
            mockSSM((params: SSM.Types.GetParametersByPathRequest) => {
                return {
                    Parameters: getCognitoTestParameters(params.Path)
                };
            });
            await setupCognitoMock();
        })
        after((done) => {
            resetSSM()
        })
        it('should return the sub for a valid token', async () => {
            const authSub = await getSub(await generateValidScope())
            expect(authSub).equal(vestibuleClientId);
        })

        it('should fail for an expired token', async () => {
            const key = await getSharedKey();
            const token = await generateToken(key, vestibuleClientId, authenticationProps.testClientIds[0], new Date(Date.now() - 5000), authenticationProps.testPoolId, authenticationProps.testRegionId);
            await authErrorTest({
                type: 'BearerToken',
                token: token
            }, 'Token Is Expired')
        })
        it('should fail for invalid client id', async () => {
            const key = await getSharedKey();
            const token = await generateToken(key, vestibuleClientId, 'badClientId', new Date(Date.now() + 5000), authenticationProps.testPoolId, authenticationProps.testRegionId);
            await authErrorTest({
                type: 'BearerToken',
                token: token
            }, 'Token was not issued for this audience')
        })
        it('should fail for invalid pool id', async () => {
            const key = await getSharedKey();
            const token = await generateToken(key, vestibuleClientId, authenticationProps.testClientIds[0], new Date(Date.now() + 5000), 'badPoolId', authenticationProps.testRegionId);
            await authErrorTest({
                type: 'BearerToken',
                token: token
            }, 'Invalid Pool Id')
        })
    })
    describe('Unsupported Tokens', () => {
        it('it should fail DirectedUserId', async () => {
            await authErrorTest({
                type: 'DirectedUserId',
                directedUserId: 'badUser'
            }, 'Invalid Scope')
        })
        it('it should fail BearerTokenWithPartition', async () => {
            await authErrorTest({
                type: 'BearerTokenWithPartition',
                token: 'badToken',
                partition: 'badPartition',
                userId: 'badUserId'
            }, 'Invalid Scope')
        })
    })
})

async function authErrorTest(scope: Message.Scope, message: string) {
    return expect(getSub(scope)).to.rejected.and.eventually.to.include({
        errorType: 'Alexa'
    }).have.property('errorPayload').to.have.property('message').to.equal(message)
}