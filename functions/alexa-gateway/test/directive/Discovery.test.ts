import { Directive } from '@vestibule-link/alexa-video-skill-types';
import { DynamoDB } from 'aws-sdk';
import { expect } from 'chai';
import 'mocha';
import { mockAwsWithSpy } from '../../../../mocks/AwsMock';
import { authenticationProps, generateToken, getSharedKey } from '../../../../mocks/CognitoMock';
import { handler } from '../../src';
import { directiveMocks } from '../mocks/DirectiveMocks';
import { fakeCallback, FakeContext } from '../../../../mocks/LambdaMock';
import { getContextSandbox } from '../mocks/Sandbox';
import { connectedEndpointId, generateValidScope } from './TestHelper';


describe('Discovery', function () {
    const clientId = 'Discovery'
    const messageId = 'discoveryMessage'
    beforeEach(async function () {
        const sandbox = getContextSandbox(this)
        await directiveMocks(sandbox);
        mockAwsWithSpy<DynamoDB.Types.QueryInput, DynamoDB.Types.QueryOutput>(sandbox, 'DynamoDB', 'query', (req) => {
            if (req.ExpressionAttributeValues![':user_id'].S == clientId) {
                return {
                    Items: [
                        {
                            description: {
                                S: 'test desc'
                            },
                            displayCategories: {
                                SS: ["TV"]
                            },
                            endpointId: {
                                S: connectedEndpointId
                            },
                            friendlyName: {
                                S: 'My Test Endpoint'
                            },
                            manufacturerName: {
                                S: 'Mocking'
                            },
                            'Alexa.PlaybackController': {
                                SS: [
                                    'PLAY'
                                ]
                            }

                        }
                    ]
                }
            }
            return {

            }
        })
    })
    it('should discover from thing shadow', async function () {
        const ret = await handler(<Directive.Message>{
            directive: {
                header: {
                    namespace: 'Alexa.Discovery',
                    name: 'Discover'
                },
                payload: {
                    scope: await generateValidScope(clientId)
                }
            }
        }, new FakeContext(messageId), fakeCallback);

        expect(ret).to.have.property('event')
            .to.have.property('payload')
            .to.have.property('endpoints')
            .to.have.length(1)
    })
    it('should return empty endpoints on error', async function () {
        const key = await getSharedKey();
        const token = await generateToken(key, 'invalidClientId', authenticationProps.testClientIds[0], new Date(Date.now() + 5000), authenticationProps.testPoolId, authenticationProps.testRegionId);
        const ret = await handler(<Directive.Message>{
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
