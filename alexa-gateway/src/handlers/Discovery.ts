import { Discovery, Message } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, EndpointCapability, EndpointInfo, SubType } from '@vestibule-link/iot-types';
import { DynamoDB } from 'aws-sdk';
import * as _ from 'lodash';
import { DirectiveHandler, DirectiveMessage, DirectiveResponseByNamespace } from '.';
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

type DirectiveNamespace = Discovery.NamespaceType;

export interface CapabilityHandler<NS extends Discovery.CapabilityInterfaces> {
    getCapability(capabilities: NonNullable<SubType<EndpointCapabilitiesRecord, NS>>): SubType<Discovery.NamedCapabilities, NS>
}

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
    'Alexa.VideoRecorder': VideoRecorder
}

interface EndpointKey {
    [key: string]: DynamoDB.AttributeValue
    user_id: {
        S: DynamoDB.StringAttributeValue
    }
    endpoint_id: {
        S: DynamoDB.StringAttributeValue
    }
}

type EndpointInfoRecord = EndpointKey & Pick<{
    [K in keyof EndpointInfo]:
    EndpointInfo[K] extends string
    ? {
        S: DynamoDB.StringAttributeValue
    }
    : K extends 'displayCategories'
    ? {
        SS: Discovery.DisplayCategoryType[]
    }
    : {
        M: {
            [key: string]: {
                S: DynamoDB.StringAttributeValue
            }
        }
    }
}, Exclude<keyof EndpointInfo, 'endpointId'>>

export type EndpointCapabilitiesRecord = EndpointKey & {
    [K in keyof EndpointCapability]:
    EndpointCapability[K] extends undefined
    ? never
    : EndpointCapability[K] extends string[] | undefined
    ? {
        SS: EndpointCapability[K]
    }
    : EndpointCapability[K] extends boolean | undefined
    ? {
        B: DynamoDB.BooleanAttributeValue
    }
    : never
}

const ENDPOINT_CAPABILITITES_TABLE = process.env['endpoint_capabilities_table'] || 'vestibule_endpoint_capabilities';
const ENDPOINT_INFO_TABLE = process.env['endpoint_info_table'] || 'vestibule_endpoint_info';

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
    private convertEndpoint(infoRecord: EndpointInfoRecord, capabilitiesRecord: EndpointCapabilitiesRecord): Discovery.Endpoint {
        return {
            description: infoRecord.description.S,
            displayCategories: infoRecord.displayCategories.SS,
            endpointId: infoRecord.endpoint_id.S,
            friendlyName: infoRecord.friendlyName.S,
            manufacturerName: infoRecord.manufacturerName.S,
            capabilities: this.convertEndpointCapability(capabilitiesRecord)
        }
    }

    private convertEndpointCapability(record: EndpointCapabilitiesRecord): Discovery.Capabilities[] {
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
            return item.endpoint_id.S
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
        const endpointInfoDict = await this.getEndpointData<EndpointInfoRecord>(userSub, ENDPOINT_INFO_TABLE)
        const endpointCapsDict = await this.getEndpointData<EndpointCapabilitiesRecord>(userSub, ENDPOINT_CAPABILITITES_TABLE)
        const endpoints = _.map(endpointInfoDict, (endpointInfo, endpointId) => {
            const endpointCaps = endpointCapsDict[endpointId] || {};
            return this.convertEndpoint(endpointInfo, endpointCaps)
        })
        return {
            endpoints: endpoints
        }
    }
}


export default new Handler()