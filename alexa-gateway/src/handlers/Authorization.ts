import { DirectiveHandler, DirectiveMessage, DirectiveResponseByNamespace } from '.';
import { SubType, Shadow, ErrorHolder, DirectiveErrorResponse } from '@vestibule-link/iot-types';
import { Message, Authorization, EventGateway, Event } from '@vestibule-link/alexa-video-skill-types';
import { DynamoDB } from 'aws-sdk';
import { Agent } from 'https';
import axios, { } from 'axios';
import { stringify, ParsedUrlQueryInput } from 'querystring';
import { getParameters } from '../config';

const LWA_URI = 'https://api.amazon.com/auth/o2/token'

interface AlexaParameters {
    gatewayUri: string
}
type GrantTypes = 'authorization_code'
    | 'refresh_token';


interface TokenRequest extends ParsedUrlQueryInput {
    grant_type: GrantTypes;
    client_id: string;
    client_secret: string;

}
interface GrantRequest extends TokenRequest {
    code: string;
}

interface RefreshTokenRequest extends TokenRequest {
    refresh_token: string;
}

interface DeviceTokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

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

interface TokenKey {
    [key: string]: DynamoDB.AttributeValue
    client_id: {
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
const AUTH_TOKEN_TABLE = 'vestibule_auth_tokens';
const REFRESH_TOKEN_TABLE = 'vestibule_refresh_tokens';

const lwaAxios = axios.create({
    httpsAgent: new Agent(
        { keepAlive: true }
    ),
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
});

const alexaAxios = axios.create({
    httpsAgent: new Agent(
        { keepAlive: true }
    )
});

type DirectiveNamespace = Authorization.NamespaceType;

class Handler implements DirectiveHandler<DirectiveNamespace>{
    readonly db = new DynamoDB();
    getScope(message: SubType<DirectiveMessage, DirectiveNamespace>): Message.Scope {
        return message.payload.grantee;
    }
    async getResponse(message: SubType<DirectiveMessage, DirectiveNamespace>,
        messageId: string, clientId: string, shadow: Shadow): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        const resp = await this.lwaLogin(message.payload, clientId);
        return {
            namespace: Authorization.namespace,
            name: 'AcceptGrant.Response',
            payload: {}
        }
    }
    getError(error: any, message: SubType<DirectiveMessage, DirectiveNamespace>,
        messageId: string): SubType<DirectiveErrorResponse, DirectiveNamespace> {
        if (error.errorType) {
            const vError: ErrorHolder = error;
            if (vError.errorType == Authorization.namespace) {
                return {
                    name: 'ErrorResponse',
                    namespace: Authorization.namespace,
                    payload: vError.errorPayload
                }
            } else {
                return {
                    name: 'ErrorResponse',
                    namespace: Authorization.namespace,
                    payload: {
                        type: 'ACCEPT_GRANT_FAILED',
                        message: vError.errorPayload.message
                    }
                }
            }
        }
        return {
            name: 'ErrorResponse',
            namespace: Authorization.namespace,
            payload: {
                type: 'ACCEPT_GRANT_FAILED',
                message: 'Unknown Error'
            }
        }
    }


    private convertToRefreshToken(tokenResponse: DeviceTokenResponse, clientId: string): TokenRecord {
        return {
            client_id: {
                S: clientId
            },
            token: {
                S: tokenResponse.refresh_token
            }
        };
    }
    private convertToAccessToken(tokenResponse: DeviceTokenResponse, clientId: string): TTLTokenRecord {
        return {
            client_id: {
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

    private async lwaLogin(messagePayload: Authorization.AcceptGrantRequest, clientId: string): Promise<DeviceTokenResponse> {
        const request: GrantRequest = {
            ...await this.createTokenRequest('authorization_code'), ...{
                code: messagePayload.grant.code
            }
        }
        return await this.requestAndSaveToken(request, clientId);
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
            const error: ErrorHolder = {
                errorType: Authorization.namespace,
                errorPayload: {
                    type: 'ACCEPT_GRANT_FAILED',
                    message: e.response.data.error_description
                }
            }
            throw error;
        } finally {
            console.timeEnd('lwaToken')
        }
    }

    private async requestAndSaveToken(request: TokenRequest, clientId: string): Promise<DeviceTokenResponse> {
        const resp = await this.requestAccessToken(request);
        this.updateTokens(resp, clientId);
        return resp;
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
    private getTokenKey(clientId: string): TokenKey {
        return {
            client_id: {
                S: clientId
            }
        }
    }
    async getToken(clientId: string): Promise<string> {
        const tokenKey = this.getTokenKey(clientId);

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
                return response.access_token;
            }
        }
        const error: ErrorHolder = {
            errorType: Authorization.namespace,
            errorPayload: {
                type: 'ACCEPT_GRANT_FAILED',
                message: 'Cannot find refresh token'
            }
        }
        throw error;
    }
    private async deleteClientTokens(clientId: string): Promise<void> {
        const tokenKey = this.getTokenKey(clientId);
        console.time('deleteToken')
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
        console.timeEnd('deleteToken')
    }
    async sendAlexaEvent(request: Event.Message, token: string, clientId: string) {
        try {
            const alexaParameters = await getParameters<AlexaParameters>('alexa');
            console.time('sendAlexaEvent')
            await alexaAxios.post(alexaParameters.gatewayUri, request, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });
        } catch (err) {
            const errorResponse: EventGateway.AlexaErrorResponse = err.response.data;
            console.log(errorResponse);
            switch (errorResponse.payload.type) {
                case 'SKILL_DISABLED_EXCEPTION':
                    this.deleteClientTokens(clientId);
                    break;
            }
            const error: ErrorHolder = {
                errorType: Authorization.namespace,
                errorPayload: {
                    type: 'ACCEPT_GRANT_FAILED',
                    message: errorResponse.payload.message
                }
            }
            throw error;
        } finally {
            console.timeEnd('sendAlexaEvent')
        }
    }
}

export default new Handler();