import { DynamoDB } from "aws-sdk";
import { ParsedUrlQueryInput, stringify } from "querystring";
import { Agent } from 'https';
import axios, { } from 'axios';
import { getParameters } from 'vestibule-common-layer';

const LWA_URI = 'https://api.amazon.com/auth/o2/token'
interface ErrorResponse {
    error: ErrorCodeType;
    error_description: string;
    error_uri: string;
    state?: string;
}

interface LwaParameters {
    clientId: string
    clientSecret: string
}
type ErrorCodeType = 'invalid_request'
    | 'unauthorized_client'
    | 'access_denied'
    | 'unsupported_response_type'
    | 'invalid_scope'
    | 'server_error'
    | 'temporarily_unavailable';


const lwaAxios = axios.create({
    httpsAgent: new Agent(
        { keepAlive: true }
    ),
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
});

export type GrantTypes = 'authorization_code'
    | 'refresh_token';


interface TokenRequest extends ParsedUrlQueryInput {
    grant_type: GrantTypes;
    client_id: string;
    client_secret: string;

}
export interface GrantRequest extends TokenRequest {
    code: string;
}

export interface RefreshTokenRequest extends TokenRequest {
    refresh_token: string;
}

export interface DeviceTokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

interface TokenKey {
    [key: string]: DynamoDB.AttributeValue
    user_id: {
        S: DynamoDB.StringAttributeValue
    }
}
interface TokenRecord extends TokenKey {
    token: {
        S: DynamoDB.StringAttributeValue
    }
}
interface TTLTokenRecord extends TokenRecord {
    ttl: {
        N: DynamoDB.NumberAttributeValue
    }
}
const AUTH_TOKEN_TABLE = process.env['auth_token_table'] || 'vestibule_auth_tokens';
const REFRESH_TOKEN_TABLE = process.env['refresh_token_table'] || 'vestibule_refresh_tokens';

class TokenManager {
    private _db: DynamoDB | undefined;
    private get db() {
        if (!this._db) {
            this._db = new DynamoDB();
        }
        return this._db;
    }
    private async getAuthToken(tokenKey: TokenKey, tableName: string): Promise<string | undefined> {
        const logType = 'dynamoDb-' + tableName;
        console.time(logType);
        const authTokenRecord = await this.db.getItem({
            TableName: tableName,
            Key: tokenKey
        }).promise();
        console.timeEnd(logType);
        if (authTokenRecord.Item && authTokenRecord.Item.token.S) {
            return authTokenRecord.Item.token.S;
        }
    }
    private getTokenKey(userSub: string): TokenKey {
        return {
            user_id: {
                S: userSub
            }
        }
    }
    async getToken(userSub: string): Promise<string> {
        const tokenKey = this.getTokenKey(userSub);

        const authToken = await this.getAuthToken(tokenKey, AUTH_TOKEN_TABLE);
        if (authToken) {
            return authToken;
        } else {
            const refreshToken = await this.getAuthToken(tokenKey, REFRESH_TOKEN_TABLE);
            if (refreshToken) {
                const request: RefreshTokenRequest = {
                    ...await this.createTokenRequest('refresh_token'),
                    ... { refresh_token: refreshToken }
                }
                const response = await this.requestAccessToken(request);
                await this.saveAccessToken(response, userSub);
                return response.access_token;
            }
        }
        throw new Error('Cannot find refresh token');
    }
    async deleteClientTokens(clientId: string): Promise<void> {
        const tokenKey = this.getTokenKey(clientId);
        console.time('deleteToken')
        try {
            await this.db.batchWriteItem({
                RequestItems: {
                    [REFRESH_TOKEN_TABLE]: [
                        {
                            DeleteRequest: {
                                Key: tokenKey
                            }
                        }
                    ],
                    [AUTH_TOKEN_TABLE]: [
                        {
                            DeleteRequest: {
                                Key: tokenKey
                            }
                        }
                    ]
                }
            }).promise();

        } finally {
            console.timeEnd('deleteToken')
        }
    }
    private async updateTokens(tokenResponse: DeviceTokenResponse, clientId: string): Promise<void> {
        const refreshToken: TokenRecord = this.convertToRefreshToken(tokenResponse, clientId);
        const accessToken: TokenRecord = this.convertToAccessToken(tokenResponse, clientId);
        console.time('updateTokens')
        const dbWrite = await this.db.batchWriteItem({
            RequestItems: {
                [REFRESH_TOKEN_TABLE]: [
                    {
                        PutRequest: {
                            Item: refreshToken
                        }
                    }
                ],
                [AUTH_TOKEN_TABLE]: [
                    {
                        PutRequest: {
                            Item: accessToken
                        }
                    }
                ]
            }
        }).promise();
        console.timeEnd('updateTokens')
    }
    private async createTokenRequest(grantType: GrantTypes): Promise<TokenRequest> {
        const lwParameters = await getParameters<LwaParameters>('lwa');
        return {
            client_id: lwParameters.clientId,
            client_secret: lwParameters.clientSecret,
            grant_type: grantType
        }
    }
    private async requestAccessToken(request: TokenRequest): Promise<DeviceTokenResponse> {
        console.time('lwaToken')
        try {
            const postBody = stringify(request);
            const resp = await lwaAxios.post<DeviceTokenResponse>(LWA_URI, postBody)
            return resp.data;
        } catch (e) {
            throw new Error(e.response.data.error_description)
        } finally {
            console.timeEnd('lwaToken')
        }
    }

    private async requestAndSaveToken(request: TokenRequest, clientId: string): Promise<DeviceTokenResponse> {
        const resp = await this.requestAccessToken(request);
        await this.updateTokens(resp, clientId);
        return resp;
    }
    private convertToRefreshToken(tokenResponse: DeviceTokenResponse, clientId: string): TokenRecord {
        return {
            user_id: {
                S: clientId
            },
            token: {
                S: tokenResponse.refresh_token
            }
        };
    }
    private convertToAccessToken(tokenResponse: DeviceTokenResponse, clientId: string): TTLTokenRecord {
        return {
            user_id: {
                S: clientId
            },
            token: {
                S: tokenResponse.access_token
            },
            ttl: {
                N: (Math.floor(Date.now() / 1000) + tokenResponse.expires_in) + ''
            }
        }
    }

    private async saveAccessToken(tokenResponse: DeviceTokenResponse, clientId: string): Promise<void> {
        const accessToken: TokenRecord = this.convertToAccessToken(tokenResponse, clientId);
        await this.db.putItem({
            TableName: AUTH_TOKEN_TABLE,
            Item: accessToken
        }).promise();
    }
    async lwaLogin(grant_code: string, clientId: string): Promise<DeviceTokenResponse> {
        const request: GrantRequest = {
            ...await this.createTokenRequest('authorization_code'), ...{
                code: grant_code
            }
        }
        return await this.requestAndSaveToken(request, clientId);
    }
}


export default new TokenManager()