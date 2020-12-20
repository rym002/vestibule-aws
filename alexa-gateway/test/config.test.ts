import { SSM } from 'aws-sdk';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { getParameters } from '../src/config';
import { createContextSandbox, getContextSandbox, restoreSandbox } from './mock/Sandbox';
import { mockSSM, resetSSM } from './mock/SSMMocks';

use(chaiAsPromised);

describe('Configuration', function () {
    beforeEach(function(){
        const sandbox = createContextSandbox(this)
    })
    afterEach(function(){
        restoreSandbox(this)
    })

    beforeEach(function () {
        const sandbox = getContextSandbox(this)
        mockSSM(sandbox, (params: SSM.Types.GetParametersByPathRequest) => {
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
    afterEach(function () {
        resetSSM()
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