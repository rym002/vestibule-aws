import { ErrorHolder, LocalEndpoint, ResponseMessage, Shadow } from '@vestibule-link/iot-types';
import { IotData } from 'aws-sdk';
import { MessageHandlingFlags } from '../directive/Endpoint';
import { findHandler as findShadowHandler } from './Shadow';
import { findHandler as findTopicHandler } from './Topic';
import { getParameters } from '../config';

let iotData: IotData | undefined = undefined;

export async function getIotData(): Promise<IotData> {
    if (!iotData) {
        const parameters = await getIotParameters();
        iotData = new IotData({ endpoint: parameters.endpoint })
    }
    return iotData
}
export interface IotParameters {
    endpoint: string
    timeout: string
}

export async function getIotParameters() {
    return await getParameters<IotParameters>('iot');
}

export async function getShadow(thingName: string): Promise<Shadow> {
    try {
        console.time('getShadow');
        const iotData = await getIotData();
        const resp = await iotData.getThingShadow({
            thingName: thingName
        }).promise();
        return <Shadow>JSON.parse(<string>resp.payload);
    } catch (e) {
        const error: ErrorHolder = {
            errorType: 'Alexa',
            errorPayload: {
                type: 'NO_SUCH_ENDPOINT',
                message: e.message
            }
        }
        throw error;
    } finally {
        console.timeEnd('getShadow');
    }
}

export function ensureDeviceActive(shadow: Shadow) {
    const connected = shadow.state && shadow.state.reported && shadow.state.reported && shadow.state.reported.connected
    if (!connected) {
        const error: ErrorHolder = {
            errorType: 'Alexa',
            errorPayload: {
                type: 'BRIDGE_UNREACHABLE',
                message: 'Bridge not active'
            }
        }
        throw error;
    }

}

export interface TopicResponse {
    response?: ResponseMessage<any>;
    shadow?: Shadow;
}

export async function sendMessage(clientId: string,
    flags: MessageHandlingFlags,
    messageId: string,
    localEndpoint: LocalEndpoint): Promise<TopicResponse> {
    let ret: TopicResponse
    const sync = flags.sync || false
    if (flags.desired) {
        ret = await findShadowHandler(clientId, messageId, localEndpoint, sync).sendMessage(flags.desired);
    } else if (flags.request) {
        ret = await findTopicHandler(clientId, messageId, localEndpoint, sync).sendMessage(flags.request);
    } else {
        ret = {
            response: {
                error: false,
                payload: {}
            }
        };

    }
    return ret;
}

