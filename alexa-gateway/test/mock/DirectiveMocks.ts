import { EndpointCapability, EndpointState, generateEndpointId, LocalEndpoint, ProvidersMetadata, Shadow, ShadowMetadata } from "@vestibule-link/iot-types";
import { SSM } from "aws-sdk";
import * as _ from 'lodash';
import { getCognitoTestParameters, setupCognitoMock } from "./CognitoMock";
import { getIotTestParameters, mockShadow, resetIotDataGetThingShadow } from "./IotDataMock";
import { mockSSM, resetSSM } from "./SSMMocks";

export function directiveSSMMocks(additionalParameters: SSM.Parameter[]) {
    mockSSM((params: SSM.Types.GetParametersByPathRequest) => {
        return {
            Parameters: [...getCognitoTestParameters(params.Path), ...getIotTestParameters(params.Path), ...additionalParameters]
        };
    });
}

export async function directiveMocks(additionalParameters: SSM.Parameter[]) {
    directiveSSMMocks(additionalParameters);
    await setupCognitoMock();
}

export function resetDirectiveMocks() {
    resetSSM()
    resetIotDataGetThingShadow();
}

export function mockEndpointState(state: EndpointState, capabilities: EndpointCapability, endpoint: LocalEndpoint, connected: boolean, clientId: string) {
    const shadow = createShadow(state, capabilities, endpoint, connected);
    return mockShadow(shadow, clientId);
}
function createShadow(state: EndpointState, capabilities: EndpointCapability, endpoint: LocalEndpoint, connected: boolean): Shadow {
    const updateTime = Math.floor(Date.now() / 1000);
    const endpointId = generateEndpointId(endpoint);
    const metadata: ProvidersMetadata = _.cloneDeepWith(state, (value, key) => {
        if (!_.isObject(value)) {
            const ret: ShadowMetadata = {
                timestamp: updateTime
            }
            return ret;
        }
    })
    return {
        state: {
            reported: {
                connected: connected,
                endpoints: {
                    [endpointId]: {
                        states: state,
                        capabilities: capabilities
                    }
                }
            }
        },
        metadata: {
            reported: {
                endpoints: {
                    [endpointId]: {
                        states: metadata
                    }
                }
            }
        }
    }
}
