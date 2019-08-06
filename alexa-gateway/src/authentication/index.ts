import { Message } from '@vestibule-link/alexa-video-skill-types';
import { ErrorHolder } from '@vestibule-link/iot-types';
import axios from 'axios';
import { JWK, JWS } from 'node-jose';
import { getParameters } from '../config';

interface TokenPayload {
    auth_time: number
    client_id: string
    exp: number
    iat: number
    iss: string
    jti: string
    scope: string
    sub: string
    token_use: 'access' | 'id'
    username: string
    version: number
}
interface UserInfo {
    sub: string,
    name: string,
    given_name: string,
    family_name: string,
    preferred_username: string,
    email: string,
    picture: string
}

interface CognitoParameters {
    clientIds: string[]
    poolId: string
    region: string
}

const myAxios = axios.create();

let keystore: JWK.KeyStore | undefined;

async function getCognitoParameters(): Promise<CognitoParameters> {
    return await getParameters<CognitoParameters>('cognito');
}
async function getKeyStore(): Promise<JWK.KeyStore> {
    if (!keystore) {
        try {
            console.time('getKeyStore');
            const parameters = await getCognitoParameters();
            const cognitoUrl = 'https://cognito-idp.' + parameters.region + '.amazonaws.com/' + parameters.poolId + '/.well-known/jwks.json';
            const cognitoResp = await myAxios.get<JWK.RawKey>(cognitoUrl);
            const keys = cognitoResp.data;
            keystore = await JWK.asKeyStore(keys);
        } finally {
            console.timeEnd('getKeyStore');
        }
    }
    return keystore;
}

export async function getSub(scope: Message.Scope): Promise<string> {
    if (scope.type == 'BearerToken') {
        const token = scope.token
        try {
            console.time('getProfile');
            const claims: TokenPayload = await lookupClaims(token);
            await verifyClaims(claims);
            return claims.sub;
        } catch (e) {
            let errorMessage = e.message;
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'INVALID_AUTHORIZATION_CREDENTIAL',
                    message: errorMessage
                }
            }
            throw error;
        } finally {
            console.timeEnd('getProfile');
        }
    }
    const error: ErrorHolder = {
        errorType: 'Alexa',
        errorPayload: {
            type: 'INVALID_AUTHORIZATION_CREDENTIAL',
            message: 'Invalid Scope'
        }
    }
    throw error;
}
async function lookupClaims(token: string) {
    const keystore = await getKeyStore();
    const verifier = JWS.createVerify(keystore);
    const verificationResult = await verifier.verify(token);
    const claims: TokenPayload = JSON.parse(verificationResult.payload.toString());
    return claims;
}

async function verifyClaims(claims: TokenPayload) {
    const parameters = await getCognitoParameters();
    const poolIndex = claims.iss.indexOf(parameters.poolId);
    const lastSlash = claims.iss.lastIndexOf('/');
    if (poolIndex != (lastSlash + 1)) {
        throw new Error('Invalid Pool Id');
    }
    const clientIndex = parameters.clientIds.indexOf(claims.client_id);
    if (clientIndex < 0) {
        throw new Error('Token was not issued for this audience');
    }
    var current_ts = Math.floor(new Date().getTime() / 1000);
    if (current_ts > claims.exp) {
        throw new Error('Token Is Expired');
    }
}

