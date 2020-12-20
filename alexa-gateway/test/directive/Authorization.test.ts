import { Directive, Event, Message } from '@vestibule-link/alexa-video-skill-types';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { handler } from '../../src/directive/handler';
import * as event from '../../src/event';
import { generateValidScope } from '../mock/CognitoMock';
import { directiveMocks, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { messageId, vestibuleClientId } from '../mock/IotDataMock';
import { fakeCallback, FakeContext } from '../mock/LambdaMock';
import { createContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { verifyVideoErrorResponse } from './TestHelper';
use(chaiAsPromised);

describe('Authorization', function () {
    beforeEach(async function () {
        const sandbox = createContextSandbox(this)
        await directiveMocks(sandbox);
        const lwaStub = sandbox.stub(event.tokenManager, 'lwaLogin')
        lwaStub.withArgs('success', vestibuleClientId).returns(Promise.resolve({
            access_token: '',
            refresh_token: '',
            token_type: '',
            expires_in: 1
        }));
        lwaStub.withArgs('failed', vestibuleClientId).returns(Promise.reject(new Error('Failed')));
    })
    afterEach(function () {
        resetDirectiveMocks()
        restoreSandbox(this)
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
                    grantee: <Message.BearerToken>await generateValidScope()
                }
            }
        }, new FakeContext(messageId), fakeCallback);
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