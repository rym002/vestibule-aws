import { EndpointState, Metadata, Shadow, ShadowMetadata } from "@vestibule-link/iot-types";
import { SinonSandbox } from "sinon";
import { cloneDeepWith, isEmpty, isObject } from "lodash";
import { BRIDGE_SHADOW } from '../../src/iot'
import { mockShadow } from "./IotDataMock";

export function mockEndpointState(sandbox: SinonSandbox, state: EndpointState, endpointId: string, connected: boolean, clientId: string) {
    const shadows = new Map<string, Shadow<any>>()
    if (!isEmpty(state)) {
        shadows.set(endpointId, createShadow(state))
    }
    shadows.set(BRIDGE_SHADOW, createShadow({
        connected: connected
    }))
    return mockShadow(sandbox, shadows, clientId);
}
function createShadow<T>(state: T): Shadow<T> {
    const updateTime = Math.floor(Date.now() / 1000);
    const metadata: ShadowMetadata<T> = cloneDeepWith(state, (value, key) => {
        if (!isObject(value)) {
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
