import { IotParameters } from ".";
import { ErrorHolder } from "@vestibule-link/iot-types";
import { io, mqtt, iot } from 'aws-iot-device-sdk-v2'
import { CrtError } from 'aws-crt'
export class IotReponseHandler {
    private timeoutId: NodeJS.Timeout | undefined;
    private readonly connection: mqtt.MqttClientConnection;
    private readonly connectPromise: Promise<boolean>;
    constructor(clientId: string,
        private readonly replyTopic: string,
        private readonly messageId: string,
        private readonly logPrefix: string,
        private readonly responseConverter: (payload: any) => void,
        private readonly parameters: IotParameters) {
        const bootstrap = new io.ClientBootstrap()
        const client = new mqtt.MqttClient(bootstrap)
        const config = iot.AwsIotMqttConnectionConfigBuilder
            .new_with_websockets()
            .with_client_id(clientId)
            .with_endpoint(parameters.endpoint)
            .build()
        this.connection = client.new_connection(config)

        this.connectPromise = this.connection.connect()
    }
    protected logEndMessage() {
        console.timeEnd(this.logPrefix + ' ' + this.messageId);
    }

    async subscribeResponse(reject: CallableFunction) {
        this.timeoutId = setTimeout(this.topicTimeout.bind(this), Number(this.parameters.timeout), reject);
        const replyTopic = this.replyTopic;
        try {
            await this.connectPromise;
            const granted = await this.connection.subscribe(replyTopic, mqtt.QoS.AtMostOnce, this.createMessageHandler().bind(this));
            this.connection.on('error', this.createErrorHandler(reject).bind(this));
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
        return async (err: CrtError) => {
            console.log(err);
            this.logEndMessage();
            await this.connection.disconnect();
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

    private async closeDevice() {
        this.logEndMessage();
        await this.connection.disconnect();
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
        return async (topic: string, payload: any) => {
            await this.connection.unsubscribe(topic);
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }
            await this.closeDevice();
            this.responseConverter(payload);
        }
    }

}
