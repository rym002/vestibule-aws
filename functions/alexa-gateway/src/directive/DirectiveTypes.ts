import { Directive, Message } from "@vestibule-link/alexa-video-skill-types";
import { DirectiveErrorResponse, DirectiveResponse, SubType } from "@vestibule-link/iot-types";
export const SHADOW_PREFIX = 'vestibule-bridge-'


export type DirectiveMessage = {
    [NS in Directive.Namespaces]: {
        [N in keyof Directive.NamedMessage[NS]]: {
            namespace: NS
            name: N
        }
        & Directive.NamedMessage[NS][N]
    }[keyof Directive.NamedMessage[NS]]
}

export interface DirectiveHandler<NS extends Directive.Namespaces> {
    getScope(message: SubType<DirectiveMessage, NS>): Message.Scope
    getResponse(message: SubType<DirectiveMessage, NS>, messageId: string, userSub: string): Promise<SubType<DirectiveResponseByNamespace, NS>>
    getError(error: any, message: SubType<DirectiveMessage, NS>, messageId: string): SubType<DirectiveErrorResponse, NS>
}

export type DirectiveResponseByNamespace = {
    [NS in keyof DirectiveResponse]: {
        [N in keyof DirectiveResponse[NS]]: DirectiveResponse[NS][N]
    }[keyof DirectiveResponse[NS]]
}

