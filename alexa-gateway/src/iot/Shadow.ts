import { ErrorHolder, Shadow, LocalEndpoint, EndpointState, generateEndpointId } from "@vestibule-link/iot-types";
import { TopicResponse, getIotParameters, getIotData } from ".";
import { IotReponseHandler } from "./Sync";

export interface ShadowHandler {
    sendMessage(desired: EndpointState): Promise<TopicResponse>;
}

class AsyncHandler implements ShadowHandler {
    protected logPrefix = 'IOT_SHADOW';
    constructor(protected readonly clientId: string,
        protected readonly messageId: string,
        private readonly localEndpoint: LocalEndpoint) {
    }
    private createShadow(desired: EndpointState) {
        const endpointId = generateEndpointId(this.localEndpoint);
        return {
            state: {
                desired: {
                    endpoints: {
                        [endpointId]: {
                            states: desired
                        }
                    }
                }
            }
        }
    }
    protected logEndMessage() {
        console.timeEnd(this.logPrefix + ' ' + this.messageId);
    }
    async sendMessage(desired: EndpointState): Promise<TopicResponse> {
        console.time(this.logPrefix + ' ' + this.messageId);
        const shadowUpdate = this.createShadow(desired);
        await this.updateShadow(shadowUpdate);
        this.logEndMessage();
        return {
            shadow: shadowUpdate
        }
    }

    private async updateShadow(shadowUpdate: Shadow) {
        try {
            const iotData = await getIotData();
            const update = await iotData.updateThingShadow({
                thingName: this.clientId,
                payload: JSON.stringify(shadowUpdate)
            }).promise();
        } catch (err) {
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'BRIDGE_UNREACHABLE',
                    message: 'Subscribe ' + err.message
                }
            }
            throw error;
        }
    }
}


class SyncHandler extends AsyncHandler {
    constructor(clientId: string,
        messageId: string,
        localEndpoint: LocalEndpoint) {
        super(clientId, messageId, localEndpoint);
    }
    private getReplyTopic() {
        return '$aws/things/' + this.clientId + '/shadow/update/accepted'
    }
    protected logEndMessage() {
    }
    async sendMessage(desired: EndpointState): Promise<TopicResponse> {
        return await new Promise(async (resolve, reject) => {
            const parameters = await getIotParameters();
            const responseHandler = new IotReponseHandler(this.clientId, this.getReplyTopic(), this.messageId, this.logPrefix, this.createResponse(resolve), parameters)
            await responseHandler.subscribeResponse(reject);
            await super.sendMessage(desired);
        })
    }
    private createResponse(resolve: CallableFunction) {
        return (payload: any) => {
            const shadowResponse: Shadow = JSON.parse(payload);
            const topicResponse: TopicResponse = {
                shadow: shadowResponse
            }
            resolve(topicResponse);
        }
    }
}

export function findHandler(clientId: string, messageId: string, localEndpoint: LocalEndpoint, responseRequired: boolean): ShadowHandler {
    if (responseRequired) {
        return new SyncHandler(clientId, messageId, localEndpoint);
    } else {
        return new AsyncHandler(clientId, messageId, localEndpoint);
    }
}