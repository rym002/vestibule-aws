import { expect, use } from 'chai';
import 'mocha';
import { getParameters } from '../src/config';
import { SSM } from 'aws-sdk';
import { mockSSM, resetSSM } from './mock/SSMMocks';
import * as chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('Configuration', () => {

    before(async () => {
        mockSSM((params: SSM.Types.GetParametersByPathRequest) => {
            return {
                Parameters: [
                    {
                        Name: params.Path + '/stringTest/data',
                        Type: 'String',
                        Value: 'testValue'
                    },
                    {
                        Name: params.Path + '/stringListTest/data',
                        Type: 'StringList',
                        Value: 'testValue1,testValue2'

                    }
                ]
            };
        });
    })
    after((done) => {
        resetSSM()
    })
    it('should verify String', async () => {
        const props = await getParameters('stringTest')
        expect(props).to.have.property('data', 'testValue');
    })
    it('should verify StringList', async () => {
        const props = await getParameters('stringListTest')
        expect(props).to.have.property('data').to.eql(['testValue1', 'testValue2'])
    })
    it('should fail with missing group', async () => {
        const gId = 'invalidGroup'
        await expect(getParameters(gId)).to.rejected.and.eventually.
        to.have.property('message').to.equal('Cannot Find Property Group ' + gId)
    })
})