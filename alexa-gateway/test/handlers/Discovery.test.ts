import { generateEndpointId } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { handler } from '../../src/handler';
import { authenticationProps, generateToken, generateValidScope, getSharedKey } from '../mock/CognitoMock';
import { directiveMocks, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, messageId, mockShadow, vestibuleClientId } from '../mock/IotDataMock';
import { fakeCallback, FakeContext } from '../mock/LambdaMock';
import { emptyParameters } from './TestHelper';


describe('Discovery', () => {
    before(async () => {
        await directiveMocks(emptyParameters);
        mockShadow({
            state: {
                reported: {
                    connected: true,
                    endpoints: {
                        [generateEndpointId(localEndpoint)]: {
                            info: {
                                description: 'test desc',
                                displayCategories: ["TV"],
                                endpointId: generateEndpointId(localEndpoint),
                                friendlyName: 'My Test Endpoint',
                                manufacturerName: 'Mocking'
                            }
                        }
                    }
                }
            }
        }, vestibuleClientId)
    })
    after((done) => {
        resetDirectiveMocks()
    })
    it('should discover from thing shadow', async () => {
        const ret = await handler({
            directive: {
                header: {
                    namespace: 'Alexa.Discovery',
                    name: 'Discover'
                },
                payload: {
                    scope: await generateValidScope()
                }
            }
        }, new FakeContext(messageId), fakeCallback);

        expect(ret).to.have.property('event')
            .to.have.property('payload')
            .to.have.property('endpoints')
            .to.have.length(1)
    })
    it('should return empty endpoints on error', async () => {
        const key = await getSharedKey();
        const token = await generateToken(key, 'invalidClientId', authenticationProps.testClientIds[0], new Date(Date.now() + 5000), authenticationProps.testPoolId, authenticationProps.testRegionId);
        const ret = await handler({
            directive: {
                header: {
                    namespace: 'Alexa.Discovery',
                    name: 'Discover'
                },
                payload: {
                    scope: {
                        type: 'BearerToken',
                        token: token
                    }
                }
            }
        }, new FakeContext(messageId), fakeCallback);

        expect(ret).to.have.property('event')
            .to.have.property('payload')
            .to.have.property('endpoints')
            .to.have.length(0)
    })
})
