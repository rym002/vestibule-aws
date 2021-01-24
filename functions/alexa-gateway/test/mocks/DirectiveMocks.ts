import { SinonSandbox } from "sinon";
import { setupCognitoMock } from "../../../../mocks/CognitoMock";
import { ssmMock } from "../../../../mocks/SSMMocks";
import { getIotTestParameters } from '../mocks/IotDataMock'


export async function directiveMocks(sandbox: SinonSandbox) {
    ssmMock(sandbox, [getIotTestParameters])
    await setupCognitoMock();
}
