import { each } from 'lodash';
import * as nock from 'nock';
import { JWK, JWS } from 'node-jose';

export async function generateKey() {
    return await JWK.createKey('RSA', 2048, {
        alg: 'RS256',
        use: 'sig'
    });
}


export async function generateToken(key: JWK.Key, sub: string, clientId: string, exp: Date, url: string) {
    const result = await JWS.createSign({
        compact: true,
        alg: key.alg,
        format: 'compact',
    }, key).update(JSON.stringify({
        sub: sub,
        iss: url,
        exp: Math.floor(exp.getTime() / 1000),
        client_id: clientId
    })).final();
    return <string><unknown>result;
}


let sharedKey: JWK.Key | undefined

export async function getSharedKey() {
    if (!sharedKey) {
        sharedKey = await generateKey()
    }
    return sharedKey;
}
export async function mockCognitoJwks(url: string) {
    const keystore = await JWK.asKeyStore([await getSharedKey()]);
    nock(url)
        .get('/.well-known/jwks.json').reply(200, () => {
            return keystore.toJSON();
        });
}

export const authenticationProps = {
    cognito_url: 'https://test-region-1/test-pool-id',
    cognito_client_ids: 'testClient1'
}

export async function setupCognitoMock() {
    authenticationProps
    each(authenticationProps, (value, key) => {
        process.env[key] = value
    })
    await mockCognitoJwks(authenticationProps.cognito_url);
}

export async function generateValidToken(clientId: string) {
    return await generateToken(await getSharedKey(), clientId, authenticationProps.cognito_client_ids, new Date(Date.now() + 5000), authenticationProps.cognito_url);
}


