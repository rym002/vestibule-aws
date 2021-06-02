import { DynamoDB, SSM } from 'aws-sdk';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { matches } from 'lodash';
import 'mocha';
import { SinonSandbox } from 'sinon';
import { getContextSandbox } from '../../../mocks/Sandbox';
import { mockAwsWithSpy } from '../../../mocks/AwsMock';
import { tokenManager } from '../src';
import { DeviceTokenResponse, GrantRequest, GrantTypes, RefreshTokenRequest } from '../src/Lwa';
import nock = require('nock');
import { ssmMock} from '../../../mocks/SSMMocks';
use(chaiAsPromised);

const lwaParameters = {
    clientId: 'lwa-client-id',
    clientSecret: 'lwa-client-secret'
}

export function getLwaTestParameters(path: string): SSM.Parameter[] {
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
        }
    ]
}

describe('Lwa', function () {
    const clientId = 'Lwa'
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

    function createRefreshTokenRequest(refresh_token: string): RefreshTokenRequest & nock.DataMatcherMap {
        return {
            ...createBaseToken('refresh_token'),
            refresh_token: refresh_token
        }
    }
    function mockLwa(token: GrantRequest & nock.DataMatcherMap| RefreshTokenRequest & nock.DataMatcherMap, responseCode: number, body: nock.ReplyBody) {
        return nock('https://api.amazon.com/auth')
            .post('/o2/token', token)
            .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
            .reply(responseCode, body);

    }
    beforeEach(async function () {
        const sandbox = getContextSandbox(this)
        ssmMock(sandbox, [getLwaTestParameters])
        const dynamoMatcher = matches(<DynamoDB.Types.BatchWriteItemInput>{
            RequestItems: {
                vestibule_auth_tokens: [
                    {
                        PutRequest: {
                            Item: {
                                user_id: {
                                    S: clientId
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
                                    S: clientId
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
    context('getToken', function () {
        function mockGetItem(sandbox: SinonSandbox) {
            return mockAwsWithSpy<DynamoDB.Types.GetItemInput, DynamoDB.Types.GetItemOutput>(sandbox, 'DynamoDB', 'getItem', (req) => {
                let retId;
                if (req.Key.user_id.S == clientId + 'auth' && req.TableName == 'vestibule_auth_tokens') {
                    retId = successResponse.access_token;
                } else if (req.Key.user_id.S == clientId + 'refresh' && req.TableName == 'vestibule_refresh_tokens') {
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
            const token = await tokenManager.getToken(clientId + 'auth')
            expect(token).eq(successResponse.access_token);
        })

        it('should refresh the token and save to dynamodb', async function () {
            const sandbox = getContextSandbox(this)
            let dynamoPutItemSpy = mockPutItem(getContextSandbox(this));
            const grantRequest = createRefreshTokenRequest(successResponse.refresh_token)
            mockLwa(grantRequest, 200, successResponse)
            const token = await tokenManager.getToken(clientId + 'refresh')
            expect(token).eq(successResponse.access_token);
            sandbox.assert.called(dynamoPutItemSpy)
        })
        it('should fail on missing refresh token', async function () {
            await expect(tokenManager.getToken(clientId + 'error')).to.rejected
                .and.eventually.has.property('message', 'Cannot find refresh token')
        })

        it('should fail on lwa error', async function () {
            const grantRequest = createRefreshTokenRequest(successResponse.refresh_token)
            mockLwa(grantRequest, 401, {
                error_description: 'Failed'
            })
            await expect(tokenManager.getToken(clientId + 'refresh')).to.rejected
                .and.eventually.has.property('message', 'Failed')
        })
    })
})
