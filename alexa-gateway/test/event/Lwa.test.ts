import { DynamoDB } from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { matches } from 'lodash';
import 'mocha';
import { SinonSandbox } from 'sinon';
import { tokenManager } from '../../src/event';
import { DeviceTokenResponse, GrantRequest, GrantTypes, RefreshTokenRequest } from '../../src/event/Lwa';
import { createContextSandbox, getContextSandbox, restoreSandbox } from '../mock/Sandbox';
import { mockAwsWithSpy } from '../mock/AwsMock';
import { directiveMocks, lwaParameters, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { vestibuleClientId } from '../mock/IotDataMock';
import nock = require('nock');
use(chaiAsPromised);

describe('Lwa', function () {
    function createBaseToken(grantType: GrantTypes) {
        return {
            client_id: lwaParameters.clientId,
            client_secret: lwaParameters.clientSecret,
            grant_type: grantType
        }
    }
    const successResponse: DeviceTokenResponse = {
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'type',
        expires_in: 100
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
    function mockLwa(token: GrantRequest | RefreshTokenRequest, responseCode: number, body: nock.ReplyBody) {
        return nock('https://api.amazon.com/auth')
            .post('/o2/token', token)
            .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
            .reply(responseCode, body);

    }
    beforeEach(async function () {
        const sandbox = createContextSandbox(this)
        await directiveMocks(sandbox);
        const dynamoMatcher = matches(<DynamoDB.Types.BatchWriteItemInput>{
            RequestItems: {
                vestibule_auth_tokens: [
                    {
                        PutRequest: {
                            Item: {
                                user_id: {
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
                                user_id: {
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
        mockAwsWithSpy<DynamoDB.Types.BatchWriteItemInput, DynamoDB.Types.BatchWriteItemOutput>(sandbox, 'DynamoDB', 'batchWriteItem', (req) => {
            if (dynamoMatcher(req)) {
                return {

                }
            } else {
                throw 'Invalid Dynamo Request'
            }
        })
    })
    afterEach(function () {
        restoreSandbox(this)
        resetDirectiveMocks()
        AWSMock.restore('DynamoDB', 'batchWriteItem');
        AWSMock.restore('DynamoDB', 'putItem');
    })
    context('getToken', function () {
        function mockGetItem(sandbox: SinonSandbox) {
            return mockAwsWithSpy<DynamoDB.Types.GetItemInput, DynamoDB.Types.GetItemOutput>(sandbox, 'DynamoDB', 'getItem', (req) => {
                let retId;
                if (req.Key.user_id.S == vestibuleClientId + 'auth' && req.TableName == 'vestibule_auth_tokens') {
                    retId = successResponse.access_token;
                } else if (req.Key.user_id.S == vestibuleClientId + 'refresh' && req.TableName == 'vestibule_refresh_tokens') {
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

        function mockPutItem(sandbox: SinonSandbox) {
            return mockAwsWithSpy<DynamoDB.Types.PutItemInput, DynamoDB.Types.PutItemOutput>(sandbox, 'DynamoDB', 'putItem', (req) => {
                return {

                }
            })
        }

        beforeEach(function () {
            mockGetItem(getContextSandbox(this));
        })
        it('should return the auth token', async function () {
            const token = await tokenManager.getToken(vestibuleClientId + 'auth')
            expect(token).eq(successResponse.access_token);
        })

        it('should refresh the token and save to dynamodb', async function () {
            let dynamoPutItemSpy = mockPutItem(getContextSandbox(this));
            const grantRequest = createRefreshTokenRequest(successResponse.refresh_token)
            mockLwa(grantRequest, 200, successResponse)
            const token = await tokenManager.getToken(vestibuleClientId + 'refresh')
            expect(token).eq(successResponse.access_token);
            assert(dynamoPutItemSpy.called)
        })
        it('should fail on missing refresh token', async function () {
            await expect(tokenManager.getToken(vestibuleClientId + 'error')).to.rejected
                .and.eventually.has.property('message', 'Cannot find refresh token')
        })

        it('should fail on lwa error', async function () {
            const grantRequest = createRefreshTokenRequest(successResponse.refresh_token)
            mockLwa(grantRequest, 401, {
                error_description: 'Failed'
            })
            await expect(tokenManager.getToken(vestibuleClientId + 'refresh')).to.rejected
                .and.eventually.has.property('message', 'Failed')
        })
    })
})
