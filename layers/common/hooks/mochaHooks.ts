import * as AWS from 'aws-sdk'
import { restoreMocks, setupSDK } from '../../../mocks/AwsMock'
import { createContextSandbox, restoreSandbox } from '../../../mocks/Sandbox'

before(function () {
    setupSDK(AWS)
})

beforeEach(function () {
    createContextSandbox(this)
})
afterEach(function () {
    restoreMocks()
    restoreSandbox(this)
})