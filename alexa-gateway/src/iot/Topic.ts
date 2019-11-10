import { TopicResponse, getIotParameters, getIotData } from ".";
import { ResponseMessage, LocalEndpoint, ErrorHolder, SubType, topicConfig, generateTopic, RequestMessage, Shadow, ProvidersMetadata, EndpointState, generateEndpointId, ShadowMetadata } from "@vestibule-link/iot-types";
import { IotReponseHandler } from "./Sync";
import { DirectiveMessage } from "../directive";
import * as _ from 'lodash';

export interface TopicHandler {
    sendMessage(message: SubType<DirectiveMessage, any>): Promise<TopicResponse>;
}

class AsyncHandler implements TopicHandler {
    protected logPrefix = 'IOT_RPC';
    constructor(protected readonly clientId: string,
        protected readonly localEndpoint: LocalEndpoint,
        protected readonly messageId: string) {
    }
    protected getTopicPrefix() {
        return topicConfig.root + this.clientId;
    }
    private getTopic(topicPrefix: string, message: SubType<DirectiveMessage, any>) {
        return topicPrefix + topicConfig.directive + generateTopic(this.localEndpoint) + '/' + message.namespace + '/' + message.name;
    }

    protected getReplyTopic(): string | undefined {
        return undefined;
    }
    private createRequestMessage(replyTopic: string, message: SubType<DirectiveMessage, any>): RequestMessage<any> {
        return {
            payload: message.payload,
            replyTopic: {
                sync: this.getReplyTopic()
            }
        }
    }
    async sendMessage(message: SubType<DirectiveMessage, any>): Promise<TopicResponse> {
        console.time(this.logPrefix + ' ' + this.messageId);
        await this.publishMessage(message);
        this.logEndMessage();
        return {}
    }
    protected logEndMessage() {
        console.timeEnd(this.logPrefix + ' ' + this.messageId);
    }
    private async publishMessage(message: SubType<DirectiveMessage, any>) {
        try {
            const topicPrefix = this.getTopicPrefix();
            const requestTopic = this.getTopic(topicPrefix, message);
            const reqMessage = this.createRequestMessage(topicPrefix, message);
            const iotData = await getIotData();
            const data = await iotData.publish({
                payload: JSON.stringify(reqMessage),
                qos: 0,
                topic: requestTopic
            }).promise();

        } catch (err) {
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'BRIDGE_UNREACHABLE',
                    message: 'Publish ' + err.message
                }
            }
            throw error;
        }

    }
}

class SyncHandler extends AsyncHandler {
    constructor(
        clientId: string,
        localEndpoint: LocalEndpoint,
        messageId: string) {
        super(clientId, localEndpoint, messageId);
    }

    protected getReplyTopic() {
        return this.getTopicPrefix() + '/alexa/event/' + this.messageId;
    }
    protected logEndMessage() {
        // Will be logged when the response is received
    }
    async sendMessage(message: any): Promise<TopicResponse> {
        return await new Promise(async (resolve, reject) => {
            try {
                const parameters = await getIotParameters();
                const responseHandler = new IotReponseHandler(this.clientId, this.getReplyTopic(), this.messageId, this.logPrefix, this.createResponse(resolve, reject), parameters)
                await responseHandler.subscribeResponse(reject);
                await super.sendMessage(message);
            } catch (err) {
                reject(err)
            }
        })
    }

    private stateToMetadata(state: EndpointState) {
        const updateTime = Math.floor(Date.now() / 1000);
        const metadata: ProvidersMetadata = _.cloneDeepWith(state, (value, key) => {
            if (!_.isObject(value)) {
                const ret: ShadowMetadata = {
                    timestamp: updateTime
                }
                return ret;
            }
        })
        return metadata;
    }
    private createResponse(resolve: CallableFunction, reject: CallableFunction) {
        return (payload: any) => {
            const parsedPayload: ResponseMessage<any> = JSON.parse(payload);
            if (parsedPayload.error) {
                reject(parsedPayload.payload);
            } else {
                let shadow: Shadow | undefined;
                if (parsedPayload.stateChange) {
                    const endpointId = generateEndpointId(this.localEndpoint);
                    const metadata = this.stateToMetadata(parsedPayload.stateChange)
                    shadow = {
                        metadata: {
                            reported: {
                                endpoints: {
                                    [endpointId]: metadata
                                }
                            }
                        },
                        state: {
                            reported: {
                                endpoints: {
                                    [endpointId]: parsedPayload.stateChange
                                }
                            }
                        }
                    }
                }
                const topicResponse: TopicResponse = {
                    response: parsedPayload,
                    shadow: shadow
                }
                resolve(topicResponse);
            }
        }
    }
}

export function findHandler(clientId: string, messageId: string, localEndpoint: LocalEndpoint, responseRequired: boolean): TopicHandler {
    if (responseRequired) {
        return new SyncHandler(clientId, localEndpoint, messageId);
    } else {
        return new AsyncHandler(clientId, localEndpoint, messageId);
    }
}