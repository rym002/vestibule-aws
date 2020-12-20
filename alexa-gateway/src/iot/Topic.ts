import { EndpointState, endpointTopicPrefix, ErrorHolder, RequestMessage, ResponseMessage, Shadow, SubType } from "@vestibule-link/iot-types";
import { DirectiveMessage } from "../directive/DirectiveTypes";
import { getIotData, getIotParameters, TopicResponse } from ".";
import { stateToMetadata } from "../directive";
import { IotReponseHandler } from "./Sync";

export interface TopicHandler {
    sendMessage(message: SubType<DirectiveMessage, any>): Promise<TopicResponse>;
}

class AsyncHandler implements TopicHandler {
    protected logPrefix = 'IOT_RPC';
    constructor(protected readonly clientId: string,
        protected readonly endpointId: string,
        protected readonly messageId: string) {
    }
    protected getTopicPrefix() {
        return endpointTopicPrefix(this.clientId, 'alexa', this.endpointId)
    }
    private getTopic(topicPrefix: string, message: SubType<DirectiveMessage, any>) {
        return `${topicPrefix}directive/${message.namespace}/${message.name}`;
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
    private static readonly decoder = new TextDecoder('utf8');
    constructor(
        clientId: string,
        endpointId: string,
        messageId: string) {
        super(clientId, endpointId, messageId);
    }

    protected getReplyTopic() {
        return `vestibule-bridge/${this.clientId}/alexa/event/${this.messageId}`;
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

    private createResponse(resolve: CallableFunction, reject: CallableFunction) {
        return (payload: ArrayBuffer) => {
            const parsedPayload: ResponseMessage<any> = JSON.parse(SyncHandler.decoder.decode(payload));
            if (parsedPayload.error) {
                reject(parsedPayload.payload);
            } else {
                let shadow: Shadow<EndpointState> | undefined;
                if (parsedPayload.stateChange) {
                    const metadata = stateToMetadata(parsedPayload.stateChange)
                    shadow = {
                        metadata: {
                            reported: metadata
                        },
                        state: {
                            reported: parsedPayload.stateChange
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

export function findHandler(clientId: string, messageId: string, endpointId: string, responseRequired: boolean): TopicHandler {
    if (responseRequired) {
        return new SyncHandler(clientId, endpointId, messageId);
    } else {
        return new AsyncHandler(clientId, endpointId, messageId);
    }
}