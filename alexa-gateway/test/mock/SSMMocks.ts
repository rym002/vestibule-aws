import * as AWSMock from 'aws-sdk-mock';
import { mockAwsWithSpy } from './AwsMock'

export function mockSSM(resolver: (params: AWS.SSM.Types.GetParametersByPathRequest) => AWS.SSM.GetParametersByPathResult) {
    return mockAwsWithSpy('SSM', 'getParametersByPath', resolver);
}

export function resetSSM() {
    AWSMock.restore('SSM', 'getParametersByPath');
}
