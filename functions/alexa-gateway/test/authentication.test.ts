import { Message } from '@vestibule-link/alexa-video-skill-types';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { setupCognitoMock } from '../../../mocks/CognitoMock';
import { getSub } from '../src/authentication';
import { generateValidScope } from './directive/TestHelper';

use(chaiAsPromised);

describe('Authentication', function () {
    const clientId = 'Authentication'
    describe('BearerToken', function () {
        beforeEach(async function () {
            await setupCognitoMock();
        })
        it('should return the sub for a valid token', async function () {
            const authSub = await getSub(await generateValidScope(clientId))
            expect(authSub).equal(clientId);
        })
    })
    describe('Unsupported Tokens', function () {
        it('it should fail DirectedUserId', async function () {
            await authErrorTest({
                type: 'DirectedUserId',
                directedUserId: 'badUser'
            }, 'Invalid Scope')
        })
        it('it should fail BearerTokenWithPartition', async function () {
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
