import { SSM } from 'aws-sdk'
import { ErrorHolder } from '@vestibule-link/iot-types';


const parameterValues = {};
const VESTIBULE_ENV = process.env['VESTIBULE_ENV'] || 'dev';

async function loadParameters() {
    try {
        console.time('loadParameters');
        const ssm = new SSM()
        const parameterPath = '/vestibule/' + VESTIBULE_ENV;
        const ssmResp = await ssm.getParametersByPath({
            Path: parameterPath,
            Recursive: true,
            WithDecryption: true
        }).promise();
        if (ssmResp.Parameters) {
            ssmResp.Parameters.forEach(parameter => {
                const name = parameter.Name;
                if (name) {
                    const subName = name.substring(parameterPath.length + 1).split('/')
                    const value = convertParameterValue(parameter);
                    parseParameter(subName, parameterValues, value);
                }
            })
        }
    } finally {
        console.timeEnd('loadParameters');
    }
}

function convertParameterValue(parameter: SSM.Parameter): string | string[] | undefined {
    if (parameter.Value && 'StringList' == parameter.Type) {
        return parameter.Value.split(',');
    } else {
        return parameter.Value;
    }
}

function parseParameter(parts: string[], parent: any, value: string | string[] | undefined) {
    const part = parts.shift();
    if (part) {
        if (parts.length) {
            let child = parent[part];
            if (!child) {
                child = {};
                parent[part] = child;
            }
            parseParameter(parts, child, value)
        } else {
            parent[part] = value
        }
    }
}

export async function getParameters<T>(parameterGroup: string): Promise<T> {
    let ret = parameterValues[parameterGroup];
    if (!ret) {
        await loadParameters();
        ret = parameterValues[parameterGroup];
        if (!ret){
            throw new Error('Cannot Find Property Group ' + parameterGroup);
        }
    }
    return ret;
}