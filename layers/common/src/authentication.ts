import axios from 'axios';
import { JWK, JWS } from 'node-jose';

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

const myAxios = axios.create();

let keystore: JWK.KeyStore | undefined;
let clientIds: string[] | undefined

function getCognitoUrl() {
    const COGNITO_URL = process.env['cognito_url']
    if (!COGNITO_URL) {
        throw new Error('COGNITO_URL not set')
    }
    return COGNITO_URL
}

function getJwksUrl() {
    return getCognitoUrl() + '/.well-known/jwks.json'
}
function getClientIds() {
    if (clientIds === undefined) {
        const COGNITO_CLIENT_IDS = process.env['cognito_client_ids']
        if (COGNITO_CLIENT_IDS) {
            clientIds = COGNITO_CLIENT_IDS.split(',')
        } else {
            throw new Error('COGNITO_CLIENT_IDS not set')
        }
    }
    return clientIds
}
async function getKeyStore(): Promise<JWK.KeyStore> {
    if (!keystore) {
        try {
            console.time('getKeyStore');
            const cognitoResp = await myAxios.get<JWK.RawKey>(getJwksUrl());
            const keys = cognitoResp.data;
            keystore = await JWK.asKeyStore(keys);
        } finally {
            console.timeEnd('getKeyStore');
        }
    }
    return keystore;
}

export async function getUserSub(token: string): Promise<string> {
    try {
        console.time('getUserSub');
        const claims: TokenPayload = await lookupClaims(token);
        await verifyClaims(claims);
        return claims.sub;
    } finally {
        console.timeEnd('getUserSub');
    }
}
async function lookupClaims(token: string) {
    const keystore = await getKeyStore();
    const verifier = JWS.createVerify(keystore);
    const verificationResult = await verifier.verify(token);
    const claims: TokenPayload = JSON.parse(verificationResult.payload.toString());
    return claims;
}

async function verifyClaims(claims: TokenPayload) {
    if (claims.iss !== getCognitoUrl()) {
        throw new Error('Token was not issued by a trusted issuer');
    }
    const clientIds = getClientIds()
    const clientIndex = clientIds.indexOf(claims.client_id);
    if (clientIndex < 0) {
        throw new Error('Token was not issued for this audience');
    }
    var current_ts = Math.floor(new Date().getTime() / 1000);
    if (current_ts > claims.exp) {
        throw new Error('Token Is Expired');
    }
}

