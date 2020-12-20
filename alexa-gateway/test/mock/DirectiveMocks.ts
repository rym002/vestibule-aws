import { EndpointState, Metadata, Shadow, ShadowMetadata } from "@vestibule-link/iot-types";
import { SSM } from "aws-sdk";
import * as _ from 'lodash';
import { SinonSandbox } from "sinon";
import { BRIDGE_SHADOW } from '../../src/iot';
import { getCognitoTestParameters, setupCognitoMock } from "./CognitoMock";
import { getIotTestParameters, mockShadow, resetIotDataGetThingShadow } from "./IotDataMock";
import { mockSSM, resetSSM } from "./SSMMocks";

export function directiveSSMMocks(sandbox: SinonSandbox) {
    mockSSM(sandbox, (params: SSM.Types.GetParametersByPathRequest) => {
        return {
            Parameters: [...getCognitoTestParameters(params.Path), ...getIotTestParameters(params.Path), ...getAlexaTestParameters(params.Path), ...getLwaTestParameters(params.Path)]
        };
    });
}

export async function directiveMocks(sandbox: SinonSandbox) {
    directiveSSMMocks(sandbox);
    await setupCognitoMock();
}

export function resetDirectiveMocks() {
    resetSSM()
    resetIotDataGetThingShadow();
}

export function mockEndpointState(sandbox: SinonSandbox, state: EndpointState, endpointId: string, connected: boolean, clientId: string) {
    const shadows = new Map<string, Shadow<any>>()
    shadows.set(endpointId, createShadow(state))
    shadows.set(BRIDGE_SHADOW, createShadow({
        connected: connected
    }))
    return mockShadow(sandbox, shadows, clientId);
}
function createShadow<T>(state: T): Shadow<T> {
    const updateTime = Math.floor(Date.now() / 1000);
    const metadata: ShadowMetadata<T> = _.cloneDeepWith(state, (value, key) => {
        if (!_.isObject(value)) {
            const ret: Metadata = {
                timestamp: updateTime
            }
            return ret;
        }
    })
    return {
        state: {
            reported: state
        },
        metadata: {
            reported: metadata
        }
    }
}

function getAlexaTestParameters(path: string): SSM.Parameter[] {
    return [
        {
            Name: path + '/alexa/gatewayUri',
            Type: 'String',
            Value: 'http://gateway/event/test'
        }
    ]
}

export const lwaParameters = {
    clientId: 'lwa-client-id',
    clientSecret: 'lwa-client-secret'
}

function getLwaTestParameters(path: string): SSM.Parameter[] {
    return [
        {
            Name: path + '/lwa/clientId',
            Type: 'String',
            Value: lwaParameters.clientId
        },
        {
            Name: path + '/lwa/clientSecret',
            Type: 'String',
            Value: lwaParameters.clientSecret
        }
    ]
}
