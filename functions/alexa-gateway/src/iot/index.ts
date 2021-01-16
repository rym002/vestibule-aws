import { EndpointState, ErrorHolder, ResponseMessage, Shadow } from '@vestibule-link/iot-types';
import { IotData } from 'aws-sdk';
import { MessageHandlingFlags } from '../directive';
import { findHandler as findShadowHandler } from './Shadow';
import { findHandler as findTopicHandler } from './Topic';
import { getParameters } from 'vestibule-common-layer';

export const BRIDGE_SHADOW = "bridge"
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

export async function getShadow(thingName: string, shadowName: string): Promise<Shadow<EndpointState>> {
    try {
        console.time('getShadow');
        const iotData = await getIotData();
        const resp = await iotData.getThingShadow({
            thingName: thingName,
            shadowName: shadowName
        }).promise();
        if (!resp.payload) {
            throw new Error('Unknown Endpoint')
        }
        return <Shadow<EndpointState>>JSON.parse(<string>resp.payload);
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

export async function ensureDeviceActive(thingName: string) {
    try {
        console.time('getShadow');
        const iotData = await getIotData();
        const resp = await iotData.getThingShadow({
            thingName: thingName,
            shadowName: BRIDGE_SHADOW
        }).promise();
        const shadow = <Shadow<BridgeState>>JSON.parse(<string>resp.payload);
        if (!shadow.state || !shadow.state.reported || !shadow.state.reported.connected) {
            throw new Error("Bridge not connected")
        }
    } catch (e) {
        console.log('Error retrieving from bridge %o', e)
        const error: ErrorHolder = {
            errorType: 'Alexa',
            errorPayload: {
                type: 'BRIDGE_UNREACHABLE',
                message: e.message || 'Bridge not active'
            }
        }
        throw error;
    } finally {
        console.timeEnd('getShadow');
    }
}

export interface BridgeState {
    connected: boolean
}
export interface TopicResponse {
    response?: ResponseMessage<any>;
    shadow?: Shadow<EndpointState>;
}

export async function sendMessage(clientId: string,
    flags: MessageHandlingFlags,
    messageId: string,
    endpointId: string): Promise<TopicResponse> {
    let ret: TopicResponse
    const sync = flags.sync || false
    if (flags.desired) {
        ret = await findShadowHandler(clientId, messageId, endpointId, sync).sendMessage(flags.desired);
    } else if (flags.request) {
        ret = await findTopicHandler(clientId, messageId, endpointId, sync).sendMessage(flags.request);
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

