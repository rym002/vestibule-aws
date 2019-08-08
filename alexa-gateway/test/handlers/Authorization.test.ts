import { Event, Message, Authorization, EventGateway } from '@vestibule-link/alexa-video-skill-types';
import { DynamoDB, SSM } from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { assert, expect, use } from 'chai';
import * as _ from 'lodash';
import 'mocha';
import * as nock from 'nock';
import { SinonSpy } from 'sinon';
import { handler } from '../../src/handler';
import { DeviceTokenResponse, GrantRequest, GrantTypes, RefreshTokenRequest } from '../../src/handlers/Authorization';
import { mockAwsWithSpy } from '../mock/AwsMock';
import { generateValidScope } from '../mock/CognitoMock';
import { directiveMocks, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { messageId, vestibuleClientId } from '../mock/IotDataMock';
import { fakeCallback, FakeContext } from '../mock/LambdaMock';
import { verifyVideoErrorResponse } from './TestHelper';
import authorizationHandler from '../../src/handlers/Authorization'
import * as chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('Authorization', () => {
    async function callHandler(authorizationCode: string): Promise<Event.Message> {
        return <Event.Message>await handler({
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

    const lwaParameters = {
        clientId: 'lwa-client-id',
        clientSecret: 'lwa-client-secret'
    }

    const alexaParameters = {
        gatewayUri: 'http://gateway/event/test'
    }

    function getLwaTestParameters(path: string): SSM.Parameter[] {
        return [
            {
                Name: path + '/lwa/clientId',
                Type: 'String',
                Value: lwaParameters.clientId
            },
            {
                Name: path + '/lwa/clientSecret',
                Type: 'String',
                Value: lwaParameters.clientSecret
            },
            {
                Name: path + '/alexa/gatewayUri',
                Type: 'String',
                Value: alexaParameters.gatewayUri
            }
        ]
    }

    function createBaseToken(grantType: GrantTypes) {
        return {
            client_id: lwaParameters.clientId,
            client_secret: lwaParameters.clientSecret,
            grant_type: grantType
        }
    }
    function createGrantRequest(code: string): GrantRequest {
        return {
            ...createBaseToken('authorization_code'),
            code: code
        }
    }

    function createRefreshTokenRequest(refresh_token: string): RefreshTokenRequest {
        return {
            ...createBaseToken('refresh_token'),
            refresh_token: refresh_token
        }
    }

    function mockAlexaGateway(request: Event.Message, token: string, responseCode: number, body: nock.ReplyBody) {
        return nock('http://gateway/event')
            .post('/test', request)
            .matchHeader('Content-Type', 'application/json')
            .matchHeader('Authorization', 'Bearer ' + token)
            .reply(responseCode, body);

    }
    function mockLwa(token: GrantRequest | RefreshTokenRequest, responseCode: number, body: nock.ReplyBody) {
        return nock('https://api.amazon.com/auth')
            .post('/o2/token', token)
            .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
            .reply(responseCode, body);

    }
    const successResponse: DeviceTokenResponse = {
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'type',
        expires_in: 100
    }

    before(async () => {
        await directiveMocks(getLwaTestParameters);
    })
    after(() => {
        resetDirectiveMocks();
    })
    context('AcceptGrant', () => {
        let dynamoSpy: SinonSpy | undefined
        before(() => {
            const dynamoMatcher = _.matches(<DynamoDB.Types.BatchWriteItemInput>{
                RequestItems: {
                    vestibule_auth_tokens: [
                        {
                            PutRequest: {
                                Item: {
                                    client_id: {
                                        S: vestibuleClientId
                                    },
                                    token: {
                                        S: successResponse.access_token
                                    },
                                    ttl: {

                                    }
                                }
                            }
                        }
                    ],
                    vestibule_refresh_tokens: [
                        {
                            PutRequest: {
                                Item: {
                                    client_id: {
                                        S: vestibuleClientId
                                    },
                                    token: {
                                        S: successResponse.refresh_token
                                    }
                                }
                            }

                        }
                    ]
                }
            })
            dynamoSpy = mockAwsWithSpy<DynamoDB.Types.BatchWriteItemInput, DynamoDB.Types.BatchWriteItemOutput>('DynamoDB', 'batchWriteItem', (req) => {
                if (dynamoMatcher(req)) {
                    return {

                    }
                } else {
                    throw 'Invalid Dynamo Request'
                }
            })
        })
        after(() => {
            AWSMock.restore('DynamoDB', 'batchWriteItem');
        })
        it('should fail when LWA returns http error', async () => {
            const token = createGrantRequest('failed')
            mockLwa(token, 401, {
                error_description: 'Failed'
            })
            const event = await callHandler('failed')
            verifyVideoErrorResponse(event, {
                errorType: 'Alexa.Authorization',
                errorPayload: {
                    type: 'ACCEPT_GRANT_FAILED',
                    message: 'Failed'
                }
            })
        })
        it('should save the update and refresh token on success', async () => {
            const token = createGrantRequest('success')
            mockLwa(token, 200, successResponse)
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
            assert(dynamoSpy!.called)
        })
    })
    context('getToken', () => {
        function mockGetItem(){
            return  mockAwsWithSpy<DynamoDB.Types.GetItemInput, DynamoDB.Types.GetItemOutput>('DynamoDB', 'getItem', (req) => {
                let retId;
                if (req.Key.client_id.S == vestibuleClientId + 'auth' && req.TableName == 'vestibule_auth_tokens') {
                    retId = successResponse.access_token;
                } else if (req.Key.client_id.S == vestibuleClientId + 'refresh' && req.TableName == 'vestibule_refresh_tokens') {
                    retId = successResponse.refresh_token
                }
                return {
                    Item: {
                        token: {
                            S: retId
                        }
                    }
                }
            })

        }

        function mockPutItem(){
            return mockAwsWithSpy<DynamoDB.Types.PutItemInput, DynamoDB.Types.PutItemOutput>('DynamoDB', 'putItem', (req) => {
                return {

                }
            })
        }
        after(()=>{
            AWSMock.restore('DynamoDB', 'batchWriteItem');
            AWSMock.restore('DynamoDB', 'putItem');
        })
        it('should return the auth token', async () => {
            let dynamoGetItemSpy = mockGetItem();
            const token = await authorizationHandler.getToken(vestibuleClientId + 'auth')
            expect(token).eq(successResponse.access_token);
        })

        it('should refresh the token and save to dynamodb', async () => {
            let dynamoGetItemSpy = mockGetItem();
            let dynamoPutItemSpy = mockPutItem();
                const grantRequest = createRefreshTokenRequest(successResponse.refresh_token)
            mockLwa(grantRequest, 200, successResponse)
            const token = await authorizationHandler.getToken(vestibuleClientId + 'refresh')
            expect(token).eq(successResponse.access_token);
            assert(dynamoPutItemSpy.called)
        })
        it('should fail on missing refresh token', async () => {
            await expect(authorizationHandler.getToken(vestibuleClientId + 'error')).to.rejected
                .and.eventually.to.eql({
                    errorType: Authorization.namespace,
                    errorPayload: {
                        type: 'ACCEPT_GRANT_FAILED',
                        message: 'Cannot find refresh token'
                    }
                })
        })

        it('should fail on lwa error', async () => {
            const grantRequest = createRefreshTokenRequest(successResponse.refresh_token)
            mockLwa(grantRequest, 401, {
                error_description: 'Failed'
            })
            await expect(authorizationHandler.getToken(vestibuleClientId + 'refresh')).to.rejected
                .and.eventually.to.eql({
                    errorType: Authorization.namespace,
                    errorPayload: {
                        type: 'ACCEPT_GRANT_FAILED',
                        message: 'Failed'
                    }
                })

        })
    })
    context('Alexa Event', () => {
        const testEvent: Event.Message = {
            event: {
                header: {
                    namespace: 'Alexa.WakeOnLANController',
                    name: 'WakeUp',
                    messageId: messageId,
                    payloadVersion: '3'
                },
                payload: {}
            }
        }
        let dynamoBatchWriteSpy: SinonSpy | undefined;
        beforeEach(() => {
            dynamoBatchWriteSpy = mockAwsWithSpy<DynamoDB.Types.BatchWriteItemInput, DynamoDB.Types.BatchGetItemOutput>('DynamoDB', 'batchWriteItem', (req) => {
                return {

                }
            })

        })
        afterEach(() => {
            AWSMock.restore('DynamoDB', 'batchWriteItem');
        })
        it('should delete the token if SKILL_DISABLED_EXCEPTION', async () => {
            const errorResponse: EventGateway.AlexaErrorResponse = {
                header: {
                    messageId: 'test',
                    payloadVersion: '3'
                },
                payload: {
                    type: 'SKILL_DISABLED_EXCEPTION',
                    message: 'Skill Disabled'
                }
            }

            mockAlexaGateway(testEvent, 'testToken', 401, errorResponse)

            await expect(authorizationHandler.sendAlexaEvent(testEvent, 'testToken', vestibuleClientId)).to.rejected
                .and.to.be.eventually.eql({
                    errorType: Authorization.namespace,
                    errorPayload: {
                        type: 'ACCEPT_GRANT_FAILED',
                        message: errorResponse.payload.message
                    }
                })

            assert(dynamoBatchWriteSpy!.called);
        })
        it('should throw exception on alexa error', async () => {
            const errorResponse: EventGateway.AlexaErrorResponse = {
                header: {
                    messageId: 'test',
                    payloadVersion: '3'
                },
                payload: {
                    type: 'INSUFFICIENT_PERMISSION_EXCEPTION',
                    message: 'Failed'
                }
            }

            mockAlexaGateway(testEvent, 'testToken', 401, errorResponse)

            await expect(authorizationHandler.sendAlexaEvent(testEvent, 'testToken', vestibuleClientId)).to.rejected
                .and.to.be.eventually.eql({
                    errorType: Authorization.namespace,
                    errorPayload: {
                        type: 'ACCEPT_GRANT_FAILED',
                        message: errorResponse.payload.message
                    }
                })

            assert(dynamoBatchWriteSpy!.notCalled);

        })
        it('should send to alexa', async () => {
            const alexaGatewaySpy = mockAlexaGateway(testEvent, 'testToken', 200, {});
            await authorizationHandler.sendAlexaEvent(testEvent, 'testToken', vestibuleClientId);            
        })
    })
})