import { IotData, SSM } from "aws-sdk";
import { mockAwsWithSpy } from "./AwsMock";
import * as AWSMock from 'aws-sdk-mock';
import { LocalEndpoint, Shadow } from "@vestibule-link/iot-types";

export function mockIotDataGetThingShadow(resolver: (params: IotData.Types.GetThingShadowRequest) => IotData.Types.GetThingShadowResponse) {
    return mockAwsWithSpy('IotData', 'getThingShadow', resolver);
}

export function mockIotDataUpdateThingShadow(resolver: (params: IotData.Types.UpdateThingShadowRequest) => IotData.Types.UpdateThingShadowResponse) {
    return mockAwsWithSpy('IotData', 'updateThingShadow', resolver);
}

export function mockIotDataPublish(resolver: (params: IotData.PublishRequest) => {}) {
    return mockAwsWithSpy('IotData', 'publish', resolver);
}

export function resetIotDataGetThingShadow() {
    AWSMock.restore('IotData', 'getThingShadow');
}

export function resetIotDataUpdateThingShadow() {
    AWSMock.restore('IotData', 'updateThingShadow');
}

export function resetIotDataPublish() {
    AWSMock.restore('IotData', 'publish');
}

export const localEndpoint: LocalEndpoint = {
    host: 'testHost',
    provider: 'testProvider'
}
export const messageId = 'testMessageId-123'
export const vestibuleClientId = 'testClientId';

export function getIotTestParameters(path: string): SSM.Parameter[] {
    return [
        {
            Name: path + '/iot/endpoint',
            Type: 'String',
            Value: 'test-iot.iot.us-east-1.amazonaws.com'
        },
        {
            Name: path + '/iot/timeout',
            Type: 'String',
            Value: '10'
        }
    ]
}

export function mockShadow(shadow: Shadow, thingName: string) {
    return mockIotDataGetThingShadow((params: IotData.Types.GetThingShadowRequest) => {
        if (params.thingName == 'vestibule-bridge-' + thingName) {
            return {
                payload: JSON.stringify(shadow)
            }
        } else {
            throw Error('Invalid thing name ' + params.thingName);
        }
    })
}