import { ErrorHolder, Shadow, EndpointState } from "@vestibule-link/iot-types";
import { TopicResponse, getIotParameters, getIotData } from ".";
import { IotReponseHandler } from "./Sync";

export interface ShadowHandler {
    sendMessage(desired: EndpointState): Promise<TopicResponse>;
}

class AsyncHandler implements ShadowHandler {
    protected logPrefix = 'IOT_SHADOW';
    constructor(protected readonly clientId: string,
        protected readonly messageId: string,
        protected readonly endpointId: string) {
    }
    private createShadow(desired: EndpointState) {
        return {
            state: {
                desired: desired
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

    private async updateShadow(shadowUpdate: Shadow<EndpointState>) {
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
    private static readonly decoder = new TextDecoder('utf8');
    constructor(clientId: string,
        messageId: string,
        endpointId: string) {
        super(clientId, messageId, endpointId);
    }
    private getReplyTopic() {
        return `$aws/things/${this.clientId}/shadow/name/${this.endpointId}/update/accepted`
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
        return (payload: ArrayBuffer) => {
            const shadowResponse: Shadow<EndpointState> = JSON.parse(SyncHandler.decoder.decode(payload));
            const topicResponse: TopicResponse = {
                shadow: shadowResponse
            }
            resolve(topicResponse);
        }
    }
}

export function findHandler(clientId: string, messageId: string, endpointId: string, responseRequired: boolean): ShadowHandler {
    if (responseRequired) {
        return new SyncHandler(clientId, messageId, endpointId);
    } else {
        return new AsyncHandler(clientId, messageId, endpointId);
    }
}