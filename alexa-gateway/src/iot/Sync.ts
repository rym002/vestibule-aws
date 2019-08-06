import { device } from "aws-iot-device-sdk";
import { IotParameters } from ".";
import { promisify } from "util";
import { ErrorHolder } from "@vestibule-link/iot-types";


export class IotReponseHandler {
    private timeoutId: NodeJS.Timeout | undefined;
    private readonly iotClient: device;
    private readonly connectPromise:Promise<void>;
    constructor(clientId: string,
        private readonly replyTopic: string,
        private readonly messageId: string,
        private readonly logPrefix: string,
        private readonly responseConverter: (payload: any) => void,
        private readonly parameters: IotParameters) {
        this.iotClient = new device({
            host: parameters.endpoint,
            debug: true,
            clientId: 'vestibule-gateway-' + clientId,
            protocol: 'wss'
        });
        this.connectPromise = new Promise((resolve,reject)=>{
            this.iotClient.on('connect',()=>{
                resolve()
            })
            this.iotClient.on('error',(error)=>{
                reject(error)
            })
        })
    }
    protected logEndMessage() {
        console.timeEnd(this.logPrefix + ' ' + this.messageId);
    }

    async subscribeResponse(reject: CallableFunction) {
        this.timeoutId = setTimeout(this.topicTimeout.bind(this), Number(this.parameters.timeout), reject);
        const replyTopic = this.replyTopic;
        const subscribePromise = promisify(this.iotClient.subscribe.bind(this.iotClient));
        try {
            await this.connectPromise;
            const granted = await subscribePromise(replyTopic, { qos: 0 });
            this.iotClient.on('message', this.createMessageHandler().bind(this));
            this.iotClient.on('error', this.createErrorHandler(reject).bind(this));
        } catch (err) {
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'BRIDGE_UNREACHABLE',
                    message: 'Subscribe ' + err.message
                }
            }
            this.closeDevice();
            throw error;
        }
    }


    private createErrorHandler(reject: CallableFunction) {
        return (err: any) => {
            console.log(err);
            this.logEndMessage();
            this.iotClient.end(true);
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'BRIDGE_UNREACHABLE',
                    message: 'IOT Error ' + err.message
                }
            }
            reject(error);
        }
    }

    private closeDevice() {
        this.logEndMessage();
        this.iotClient.end(false);
    }
    private topicTimeout(reject: any): void {
        this.closeDevice();
        const error: ErrorHolder = {
            errorType: 'Alexa',
            errorPayload: {
                type: 'ENDPOINT_UNREACHABLE',
                message: 'No Reponse From Endpoint'
            }
        }
        reject(error);
    }

    private createMessageHandler() {
        return (topic: string, payload: any) => {
            this.iotClient.unsubscribe(topic);
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }
            this.closeDevice();
            this.responseConverter(payload);
        }
    }

}
