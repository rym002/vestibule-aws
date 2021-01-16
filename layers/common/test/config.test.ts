import { SSM } from 'aws-sdk';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { getParameters } from '../src/config';
import { getContextSandbox } from '../../../mocks/Sandbox';
import { ssmMock } from '../../../mocks/SSMMocks';

use(chaiAsPromised);

describe('Configuration', function () {
    beforeEach(function () {
        const sandbox = getContextSandbox(this)
        ssmMock(sandbox, [(path: string): SSM.Parameter[] => {
            return [
                {
                    Name: path + '/stringTest/data',
                    Type: 'String',
                    Value: 'testValue'
                },
                {
                    Name: path + '/stringListTest/data',
                    Type: 'StringList',
                    Value: 'testValue1,testValue2'

                }
            ]
        }]);
    })
    it('should verify String', async function () {
        const props = await getParameters('stringTest')
        expect(props).to.have.property('data', 'testValue');
    })
    it('should verify StringList', async function () {
        const props = await getParameters('stringListTest')
        expect(props).to.have.property('data').to.eql(['testValue1', 'testValue2'])
    })
    it('should fail with missing group', async function () {
        const gId = 'invalidGroup'
        await expect(getParameters(gId)).to.rejected.and.eventually.
            to.have.property('message').to.equal('Cannot Find Property Group ' + gId)
    })
})