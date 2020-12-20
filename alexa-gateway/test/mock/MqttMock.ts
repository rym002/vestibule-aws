import { SinonSandbox, SinonStubbedInstance, SinonStubbedMember, StubbableType } from 'sinon';
import { mqtt } from 'aws-iot-device-sdk-v2';

const encoder = new TextEncoder()
export interface MockMqttOperations {
    sendMessage(topic: string, payload: any): void
}

class MockMqtt implements MockMqttOperations {
    constructor(readonly topic: string,
        readonly on_message: (topic: string, payload: ArrayBuffer) => void) {
    }
    sendMessage(topic: string, payload: any) {
        process.nextTick(() => {
            this.on_message(topic, encoder.encode(JSON.stringify(payload)));
        })
    }
}

export function mockMqtt(sandbox: SinonSandbox, subscribeHandler: (topic: string, mqttMock: MockMqttOperations) => void,): void {
    const connectionStub = createSinonStubInstance(sandbox, mqtt.MqttClientConnection)
    const mqttClientStub = sandbox
        .stub(mqtt.MqttClient.prototype, 'new_connection')
        .returns(connectionStub)

    connectionStub.connect.returns(Promise.resolve(true))
    connectionStub.subscribe.callsFake((topic, qos, on_message) => {
        if (on_message) {
            const mqttMock = new MockMqtt(topic, on_message);
            process.nextTick(() => {
                subscribeHandler(topic, mqttMock)
            })
        }
        return Promise.resolve({
            topic: topic,
            qos: mqtt.QoS.AtLeastOnce
        })
    })
}

type StubbedClass<T> = SinonStubbedInstance<T> & T;
function createSinonStubInstance<T>(
    sandbox: SinonSandbox,
    constructor: StubbableType<T>,
    overrides?: { [K in keyof T]?: SinonStubbedMember<T[K]> },
): StubbedClass<T> {
    const stub = sandbox.createStubInstance<T>(constructor, overrides);
    return stub as unknown as StubbedClass<T>;
}
