import { spy } from 'sinon';
import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';

AWSMock.setSDKInstance(AWS);

function createAwsMockSpy<REQ, RES>(resolver: (params: REQ) => RES) {
    return spy((params: REQ, callback: (err: any, data: RES | undefined) => void) => {
        try {
            const data = resolver(params);
            callback(undefined, data);
        }
        catch (err) {
            callback(err, undefined);
        }
    });
}

export function mockAwsWithSpy<REQ, RES>(service: string, method: string, resolver: (params: REQ) => RES) {
    const callSpy = createAwsMockSpy(resolver);
    AWSMock.mock(service, method, callSpy);
    return callSpy;
}
