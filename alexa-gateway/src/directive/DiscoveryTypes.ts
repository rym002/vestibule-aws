import { Discovery } from "@vestibule-link/alexa-video-skill-types";
import { EndpointCapability, EndpointInfo, SubType } from "@vestibule-link/iot-types";
import { DynamoDB } from "aws-sdk";

export interface EndpointKey {
    [key: string]: DynamoDB.AttributeValue
    user_id: {
        S: DynamoDB.StringAttributeValue
    }
    endpointId: {
        S: DynamoDB.StringAttributeValue
    }
}

export type EndpointRecord = EndpointKey & {
    [K in keyof EndpointInfo]:
    EndpointInfo[K] extends string
    ? {
        S: DynamoDB.StringAttributeValue
    }
    : K extends 'displayCategories'
    ? {
        L: {
            S: Discovery.DisplayCategoryType
        }[]
    }
    : {
        M: {
            [key: string]: {
                S: DynamoDB.StringAttributeValue
            }
        }
    }
} & {
        [K in keyof Required<EndpointCapability>]?:
        Required<EndpointCapability>[K] extends never
        ? never
        : Required<EndpointCapability>[K] extends string[]
        ? {
            L: {
                S: Required<EndpointCapability>[K][number]
            }[]
        }
        : Required<EndpointCapability>[K] extends boolean
        ? {
            B: DynamoDB.BooleanAttributeValue
        }
        : never
    }

export interface CapabilityHandler<NS extends Discovery.CapabilityInterfaces> {
    getCapability(capabilities: NonNullable<SubType<EndpointRecord, NS>>): SubType<Discovery.NamedCapabilities, NS>
}

export function listToTypedStringArray<T extends string>(values?: { S: T }[]): T[] {
    if (values) {
        return values.map(value => {
            return value.S
        })
    }
    return []
}
