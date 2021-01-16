import { IotData, SSM } from "aws-sdk";
import { mockAwsWithSpy } from "../../../../mocks/AwsMock";
import { Shadow } from "@vestibule-link/iot-types";
import { SHADOW_PREFIX } from '../../src/directive/DirectiveTypes'
import { SinonSandbox } from "sinon";

export function mockIotDataGetThingShadow(sandbox: SinonSandbox, resolver: (params: IotData.Types.GetThingShadowRequest) => IotData.Types.GetThingShadowResponse) {
    return mockAwsWithSpy(sandbox, 'IotData', 'getThingShadow', resolver);
}

export function mockIotDataUpdateThingShadow(sandbox: SinonSandbox, resolver: (params: IotData.Types.UpdateThingShadowRequest) => IotData.Types.UpdateThingShadowResponse) {
    return mockAwsWithSpy(sandbox, 'IotData', 'updateThingShadow', resolver);
}

export function mockIotDataPublish(sandbox: SinonSandbox, resolver: (params: IotData.PublishRequest) => {}) {
    return mockAwsWithSpy(sandbox, 'IotData', 'publish', resolver);
}

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

export function mockShadow(sandbox: SinonSandbox, shadows: Map<string, Shadow<any>>, thingName: string) {
    return mockIotDataGetThingShadow(sandbox, (params: IotData.Types.GetThingShadowRequest) => {
        if (params.thingName == `${SHADOW_PREFIX}${thingName}`) {
            return {
                payload: JSON.stringify(shadows.get(params.shadowName || ''))
            }
        } else {
            throw Error('Invalid thing name ' + params.thingName);
        }
    })
}