import { Context } from "mocha"
import { createSandbox, SinonSandbox } from "sinon"

export function createContextSandbox(context: Context): SinonSandbox {
    const sandbox = createSandbox({
        useFakeTimers: true
    })
    if (context.currentTest) {
        context.currentTest['sandbox'] = sandbox
    }
    return sandbox
}

export function restoreSandbox(context: Context) {
    try {
        const sandbox = getContextSandbox(context)
        sandbox.restore()
    } catch (err) {
        console.log(err)
    }
}

export function getContextSandbox(context: Context): SinonSandbox {
    let ret = context.test && context.test['sandbox']
    if (!ret) {
        ret = context.currentTest && context.currentTest['sandbox']
    }
    if (!ret) {
        throw new Error('Sandbox not found')
    }
    return ret
}
