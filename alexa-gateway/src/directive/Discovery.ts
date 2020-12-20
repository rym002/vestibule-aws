import { Discovery, Message } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, SubType } from '@vestibule-link/iot-types';
import { DynamoDB } from 'aws-sdk';
import * as _ from 'lodash';
import { DirectiveHandler, DirectiveMessage, DirectiveResponseByNamespace } from './DirectiveTypes';
import ChannelController from './ChannelController';
import EndpointHealth from './EndpointHealth';
import Launcher from './Launcher';
import PlaybackController from './PlaybackController';
import PlaybackStateReporter from './PlaybackStateReporter';
import PowerController from './PowerController';
import RecordController from './RecordController';
import RemoteVideoPlayer from './RemoteVideoPlayer';
import SeekController from './SeekController';
import VideoRecorder from './VideoRecorder';
import WakeOnLANController from './WOL';
import KeypadController from './KeypadController'
import { CapabilityHandler, EndpointRecord, EndpointKey, listToTypedStringArray } from './DiscoveryTypes';

type DirectiveNamespace = Discovery.NamespaceType;

type CapabilityHandlers = {
    [NS in Discovery.CapabilityInterfaces]: CapabilityHandler<NS>
}

const handlers: CapabilityHandlers = {
    'Alexa.ChannelController': ChannelController,
    'Alexa.EndpointHealth': EndpointHealth,
    'Alexa.PlaybackController': PlaybackController,
    'Alexa.PlaybackStateReporter': PlaybackStateReporter,
    'Alexa.PowerController': PowerController,
    'Alexa.RecordController': RecordController,
    'Alexa.SeekController': SeekController,
    'Alexa.WakeOnLANController': WakeOnLANController,
    'Alexa.RemoteVideoPlayer': RemoteVideoPlayer,
    'Alexa.Launcher': Launcher,
    'Alexa.VideoRecorder': VideoRecorder,
    'Alexa.KeypadController': KeypadController
}


const ENDPOINT_TABLE = process.env['endpoint_table'] || 'vestibule_endpoint';

class Handler implements DirectiveHandler<DirectiveNamespace>{
    private _db: DynamoDB | undefined;
    get db() {
        if (!this._db) {
            this._db = new DynamoDB();
        }
        return this._db;
    }
    getScope(message: SubType<DirectiveMessage, DirectiveNamespace>): Message.Scope {
        return message.payload.scope;
    }
    private convertEndpoint(endpointRecord: EndpointRecord): Discovery.Endpoint {
        return {
            description: endpointRecord.description.S,
            displayCategories: listToTypedStringArray(endpointRecord.displayCategories.L),
            endpointId: endpointRecord.endpointId.S,
            friendlyName: endpointRecord.friendlyName.S,
            manufacturerName: endpointRecord.manufacturerName.S,
            capabilities: this.convertEndpointCapability(endpointRecord)
        }
    }

    private convertEndpointCapability(record: EndpointRecord): Discovery.Capabilities[] {
        const ret = _.map(handlers, (handler, key) => {
            const capKey = <Discovery.CapabilityInterfaces>key
            const recValue = record[capKey]
            if (recValue && (recValue['B'] == undefined || recValue['B'])) {
                const capValue = handler.getCapability(<any>recValue)
                return <Discovery.Capabilities>{
                    type: 'AlexaInterface',
                    version: '3',
                    ...capValue
                }
            }
        }).filter(function (value) {
            return value !== undefined;
        })
        return <Discovery.Capabilities[]>ret;
    }
    private async getEndpointData<T extends EndpointKey>(userSub: string, tableName: string): Promise<_.Dictionary<T>> {
        const logType = 'dynamoDb-' + tableName;
        console.time(logType);
        const endpointInfos = await this.db.query({
            TableName: tableName,
            ExpressionAttributeValues: {
                ":user_id": {
                    S: userSub
                }
            },
            KeyConditionExpression: 'user_id = :user_id'
        }).promise();
        const ret = _.keyBy(<T[]>endpointInfos.Items, (item) => {
            return item.endpointId.S
        })
        console.timeEnd(logType);
        return ret;
    }
    async getResponse(message: SubType<DirectiveMessage,
        DirectiveNamespace>, messageId: string,
        userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        return {
            namespace: 'Alexa.Discovery',
            name: 'Discover.Response',
            payload: await this.getResponsePayload(userSub)
        }

    }
    getError(error: any, message: SubType<DirectiveMessage, DirectiveNamespace>,
        messageId: string): SubType<DirectiveErrorResponse, DirectiveNamespace> {
        return {
            namespace: 'Alexa.Discovery',
            name: 'Discover.Response',
            payload: {
                endpoints: []
            }
        }
    }
    private async getResponsePayload(userSub: string): Promise<Discovery.ResponsePayload> {
        const endpointDict = await this.getEndpointData<EndpointRecord>(userSub, ENDPOINT_TABLE)
        const endpoints = _.map(endpointDict, (endpoint, endpointId) => {
            return this.convertEndpoint(endpoint)
        })
        return {
            endpoints: endpoints
        }
    }
}


export default new Handler()