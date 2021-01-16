import * as nock from 'nock';
import { JWK, JWS } from 'node-jose'
import { SSM } from 'aws-sdk';

export async function generateKey() {
    return await JWK.createKey('RSA', 2048, {
        alg: 'RS256',
        use: 'sig'
    });
}


export async function generateToken(key: JWK.Key, sub: string, clientId: string, exp: Date, poolId: string, region: string) {
    const result = await JWS.createSign({
        compact: true,
        alg: key.alg,
        format: 'compact',
    }, key).update(JSON.stringify({
        sub: sub,
        iss: getCogintoUrl(region, poolId),
        exp: Math.floor(exp.getTime() / 1000),
        client_id: clientId
    })).final();
    return <string><unknown>result;
}

function getCogintoUrl(region: string, poolId: string) {
    return 'https://cognito-idp.' + region + '.amazonaws.com/' + poolId;
}

let sharedKey: JWK.Key | undefined

export async function getSharedKey() {
    if (!sharedKey) {
        sharedKey = await generateKey()
    }
    return sharedKey;
}
export async function mockCognitoJwks(region: string, poolId: string) {
    const keystore = await JWK.asKeyStore([await getSharedKey()]);
    nock(getCogintoUrl(region, poolId))
        .get('/.well-known/jwks.json').reply(200, () => {
            return keystore.toJSON();
        });
}

export const authenticationProps = {
    testRegionId: 'test-region-1',
    testPoolId: 'test-pool-id',
    testClientIds: ['testClient1']
}

export function getCognitoTestParameters(path: string): SSM.Parameter[] {
    return [
        {
            Name: path + '/cognito/region',
            Type: 'String',
            Value: authenticationProps.testRegionId
        },
        {
            Name: path + '/cognito/poolId',
            Type: 'String',
            Value: authenticationProps.testPoolId
        },
        {
            Name: path + '/cognito/clientIds',
            Type: 'StringList',
            Value: authenticationProps.testClientIds.join()

        }
    ]
}

export async function setupCognitoMock() {
    await mockCognitoJwks(authenticationProps.testRegionId, authenticationProps.testPoolId);
}

export async function generateValidToken(clientId: string) {
    return await generateToken(await getSharedKey(), clientId, authenticationProps.testClientIds[0], new Date(Date.now() + 5000), authenticationProps.testPoolId, authenticationProps.testRegionId);
}


