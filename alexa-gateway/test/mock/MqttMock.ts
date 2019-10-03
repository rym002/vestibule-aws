import { EventEmitter } from 'events';
import { IClientOptions, Packet, PacketCallback, CloseCallback, IClientSubscribeOptions, ISubscriptionGrant, ClientSubscribeCallback, MqttClient, IStream } from 'mqtt';
import { SinonSandbox } from 'sinon';
import * as mqtt from 'mqtt';

export interface MockMqttOperations {
    on(event: 'subscribe', listener: (topic: string | string[]) => void): this;
    on(event: 'newListener', listener: (event: string, listener: any) => void): this;
    connect(): void
    sendMessage(topic: string, payload: any): void
}

class MockMqtt extends EventEmitter implements MockMqttOperations {
    constructor(readonly options: IClientOptions) {
        super();
    }
    public handleMessage(packet: Packet, callback: PacketCallback): void {

    }
    public unsubscribe(topic: string | string[], callback?: PacketCallback): this {
        return this;
    }
    public end(force?: boolean, cb?: CloseCallback): this {
        return this;
    }
    connect() {
        this.emit('connect')
    }
    sendMessage(topic: string, payload: any) {
        process.nextTick(() => {
            this.emit('message', topic, JSON.stringify(payload));
        })
    }
    subscribe(topic: string | string[], opts: IClientSubscribeOptions, callback?: ClientSubscribeCallback): this {
        if (callback) {
            let grants: ISubscriptionGrant[];
            if ('string' == typeof topic) {
                grants = [{
                    qos: opts.qos,
                    topic: topic
                }]
            } else {
                grants = topic.map(top => {
                    const grant: ISubscriptionGrant = {
                        qos: opts.qos,
                        topic: top
                    }
                    return grant;
                })
            }
            callback(<Error><unknown>null, grants)
            this.emit('subscribe', topic)
        }
        return this;
    }
}

export function mockMqtt(sandbox: SinonSandbox, subscribeHandler: (topic: string | string[], mqttMock: MockMqttOperations) => void, ): void {
    const fakeConnect = function (streamBuilder: (client: MqttClient) => IStream, options: IClientOptions) {
        const mqttMock: MockMqttOperations = new MockMqtt(options);
        mqttMock.on('newListener', (event: string, listener: any) => {
            if (event == 'connect') {
                process.nextTick(() => {
                    mqttMock.connect();
                })
            }
        })
        mqttMock.on('subscribe', (topic: string | string[]) => {
            process.nextTick(() => {
                subscribeHandler(topic, mqttMock);
            })
        })
        return mqttMock;
    };
    sandbox.stub(mqtt, 'MqttClient').callsFake(fakeConnect);
}