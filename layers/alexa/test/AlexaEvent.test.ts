import { Event, EventGateway } from '@vestibule-link/alexa-video-skill-types';
import { DynamoDB, SSM } from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { mockAwsWithSpy } from '../../../mocks/AwsMock';
import { sendAlexaEvent } from '../src';
import { getContextSandbox } from '../../../mocks/Sandbox';
import nock = require('nock');
import { ssmMock } from '../../../mocks/SSMMocks';
use(chaiAsPromised);

export function getAlexaTestParameters(path: string): SSM.Parameter[] {
    return [
        {
            Name: path + '/alexa/gatewayUri',
            Type: 'String',
            Value: 'http://gateway/event/test'
        }
    ]
}


describe('AlexaEvent', function () {
    const clientId = 'AlexaEvent'
    beforeEach(async function () {
        const sandbox = getContextSandbox(this)
        ssmMock(sandbox, [getAlexaTestParameters])
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
                messageId: 'wolMessage',
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
        const sandbox = getContextSandbox(this)
        const dynamoBatchWriteSpy = mockAwsWithSpy<DynamoDB.Types.BatchWriteItemInput, DynamoDB.Types.BatchGetItemOutput>(
            sandbox, 'DynamoDB', 'batchWriteItem', (req) => {
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

        await expect(sendAlexaEvent(testEvent, clientId, 'testToken')).to.rejected
            .and.to.be.eventually.have.property('message', errorResponse.payload.message)

        sandbox.assert.called(dynamoBatchWriteSpy);
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

        await expect(sendAlexaEvent(testEvent, clientId, 'testToken')).to.rejected
            .and.to.be.eventually.have.property('message', errorResponse.payload.message)
    })
    it('should send to alexa', async function () {
        const alexaGatewaySpy = mockAlexaGateway(testEvent, 'testToken', 200, {});
        await sendAlexaEvent(testEvent, clientId, 'testToken');
    })
})
