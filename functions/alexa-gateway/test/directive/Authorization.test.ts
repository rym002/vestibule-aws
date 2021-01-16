import { Directive, Event, Message } from '@vestibule-link/alexa-video-skill-types';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { getContextSandbox } from '../mocks/Sandbox';
import { handler } from '../../src';
import * as event from 'vestibule-alexa-layer';
import { directiveMocks } from '../mocks/DirectiveMocks';
import { fakeCallback, FakeContext } from '../../../../mocks/LambdaMock';
import { generateValidScope, verifyVideoErrorResponse } from './TestHelper';
use(chaiAsPromised);

describe('Authorization', function () {
    const clientId = 'Authorization'
    beforeEach(async function () {
        const sandbox = getContextSandbox(this)
        await directiveMocks(sandbox);
        const lwaStub = sandbox.stub(event.tokenManager, 'lwaLogin')
        lwaStub.withArgs('success', clientId).returns(Promise.resolve({
            access_token: '',
            refresh_token: '',
            token_type: '',
            expires_in: 1
        }));
        lwaStub.withArgs('failed', clientId).returns(Promise.reject(new Error('Failed')));
    })
    async function callHandler(authorizationCode: string): Promise<Event.Message> {
        return <Event.Message>await handler(<Directive.Message>{
            directive: {
                header: {
                    namespace: "Alexa.Authorization",
                    name: "AcceptGrant",
                },
                payload: {
                    grant: {
                        type: 'OAuth2.AuthorizationCode',
                        code: authorizationCode
                    },
                    grantee: <Message.BearerToken>await generateValidScope(clientId)
                }
            }
        }, new FakeContext('authorizationMessage'), fakeCallback);
    }
    context('AcceptGrant', function () {
        it('should fail when LWA returns http error', async function () {
            const event = await callHandler('failed')
            verifyVideoErrorResponse(event, {
                errorType: 'Alexa.Authorization',
                errorPayload: {
                    type: 'ACCEPT_GRANT_FAILED',
                    message: 'Failed'
                }
            })
        })
        it('should save the update and refresh token on success', async function () {
            const event = await callHandler('success')
            expect(event)
                .to.have.property('event')
                .to.have.property('header')
                .to.have.property('namespace', 'Alexa.Authorization');
            expect(event)
                .to.have.property('event')
                .to.have.property('header')
                .to.have.property('name', 'AcceptGrant.Response');
            expect(event)
                .to.have.property('event')
                .to.have.property('payload').eql({});
        })
    })
})