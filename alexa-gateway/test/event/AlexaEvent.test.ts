import { Event, EventGateway } from '@vestibule-link/alexa-video-skill-types';
import { DynamoDB, SSM } from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { createSandbox } from 'sinon';
import * as eventHandler from '../../src/event';
import { sendAlexaEvent } from '../../src/event';
import { mockAwsWithSpy } from '../mock/AwsMock';
import { directiveMocks } from '../mock/DirectiveMocks';
import { messageId, vestibuleClientId } from '../mock/IotDataMock';
import nock = require('nock');
use(chaiAsPromised);

describe('AlexaEvent', function () {
    const sandbox = createSandbox();
    const alexaParameters = {
        gatewayUri: 'http://gateway/event/test'
    }
    function getAlexaTestParameters(path: string): SSM.Parameter[] {
        return [
            {
                Name: path + '/alexa/gatewayUri',
                Type: 'String',
                Value: alexaParameters.gatewayUri
            }
        ]
    }

    before(async function () {
        const lwaStub = sandbox.stub(eventHandler.tokenManager, 'getToken')
        lwaStub.returns(Promise.resolve('testToken'))
        await directiveMocks(getAlexaTestParameters);
    })

    after(function () {
        sandbox.restore()
    })
    function mockAlexaGateway(request: Event.Message, token: string, responseCode: number, body: nock.ReplyBody) {
        return nock('http://gateway/event')
            .post('/test', request)
            .matchHeader('Content-Type', 'application/json')
            .matchHeader('Authorization', 'Bearer ' + token)
            .reply(responseCode, body);

    }

    const testEvent: Event.Message = {
        event: {
            header: {
                namespace: 'Alexa.WakeOnLANController',
                name: 'WakeUp',
                messageId: messageId,
                payloadVersion: '3'
            },
            payload: {},
            endpoint: {
                endpointId: 'testEndpointId',
                scope: {
                    type: 'BearerToken',
                    token: ''
                }
            }
        }
    }
    it('should delete the token if SKILL_DISABLED_EXCEPTION', async function () {
        const dynamoBatchWriteSpy = mockAwsWithSpy<DynamoDB.Types.BatchWriteItemInput, DynamoDB.Types.BatchGetItemOutput>('DynamoDB', 'batchWriteItem', (req) => {
            return {

            }
        })
        const errorResponse: EventGateway.AlexaErrorResponse = {
            header: {
                messageId: 'test',
                payloadVersion: '3'
            },
            payload: {
                type: 'SKILL_DISABLED_EXCEPTION',
                message: 'Skill Disabled'
            }
        }

        mockAlexaGateway(testEvent, 'testToken', 401, errorResponse)

        await expect(sendAlexaEvent(testEvent, vestibuleClientId, 'testEndpointId')).to.rejected
            .and.to.be.eventually.have.property('message', errorResponse.payload.message)

        assert(dynamoBatchWriteSpy.called);
        AWSMock.restore('DynamoDB', 'batchWriteItem');
    })
    it('should throw exception on alexa error', async function () {
        const errorResponse: EventGateway.AlexaErrorResponse = {
            header: {
                messageId: 'test',
                payloadVersion: '3'
            },
            payload: {
                type: 'INSUFFICIENT_PERMISSION_EXCEPTION',
                message: 'Failed'
            }
        }

        mockAlexaGateway(testEvent, 'testToken', 401, errorResponse)

        await expect(sendAlexaEvent(testEvent, vestibuleClientId, 'testEndpointId')).to.rejected
            .and.to.be.eventually.have.property('message', errorResponse.payload.message)
    })
    it('should send to alexa', async function () {
        const alexaGatewaySpy = mockAlexaGateway(testEvent, 'testToken', 200, {});
        await sendAlexaEvent(testEvent, vestibuleClientId, 'testEndpointId');
    })
})
