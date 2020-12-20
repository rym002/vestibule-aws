import { SinonSandbox } from 'sinon';
import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';

AWSMock.setSDKInstance(AWS);

function createAwsMockSpy<REQ, RES>(sandbox: SinonSandbox, resolver: (params: REQ) => RES) {
    return sandbox.spy((params: REQ, callback: (err: any, data: RES | undefined) => void) => {
        try {
            const data = resolver(params);
            callback(undefined, data);
        }
        catch (err) {
            callback(err, undefined);
        }
    });
}

export function mockAwsWithSpy<REQ, RES>(sandbox: SinonSandbox, service: string, method: string, resolver: (params: REQ) => RES) {
    const callSpy = createAwsMockSpy(sandbox, resolver);
    AWSMock.mock(service, method, callSpy);
    return callSpy;
}
