import * as AWSMock from 'aws-sdk-mock';
import { SinonSandbox } from 'sinon';
import { mockAwsWithSpy } from './AwsMock'

export function mockSSM(sandbox: SinonSandbox, resolver: (params: AWS.SSM.Types.GetParametersByPathRequest) => AWS.SSM.GetParametersByPathResult) {
    return mockAwsWithSpy(sandbox, 'SSM', 'getParametersByPath', resolver);
}

export function resetSSM() {
    AWSMock.restore('SSM', 'getParametersByPath');
}
