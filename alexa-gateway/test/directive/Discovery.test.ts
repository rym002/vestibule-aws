import { Directive } from '@vestibule-link/alexa-video-skill-types';
import { DynamoDB } from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { expect } from 'chai';
import 'mocha';
import { handler } from '../../src/directive/handler';
import { mockAwsWithSpy } from '../mock/AwsMock';
import { authenticationProps, generateToken, generateValidScope, getSharedKey } from '../mock/CognitoMock';
import { directiveMocks, resetDirectiveMocks } from '../mock/DirectiveMocks';
import { localEndpoint, messageId, vestibuleClientId } from '../mock/IotDataMock';
import { fakeCallback, FakeContext } from '../mock/LambdaMock';
import { createContextSandbox, restoreSandbox } from '../mock/Sandbox';


describe('Discovery', function () {
    beforeEach(async function () {
        const sandbox = createContextSandbox(this)
        await directiveMocks(sandbox);
        mockAwsWithSpy<DynamoDB.Types.QueryInput, DynamoDB.Types.QueryOutput>(sandbox, 'DynamoDB', 'query', (req) => {
            if (req.ExpressionAttributeValues![':user_id'].S == vestibuleClientId) {
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
                                S: localEndpoint
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
    afterEach(function () {
        AWSMock.restore('DynamoDB', 'query');
        resetDirectiveMocks()
        restoreSandbox(this)
    })
    it('should discover from thing shadow', async function () {
        const ret = await handler(<Directive.Message>{
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
