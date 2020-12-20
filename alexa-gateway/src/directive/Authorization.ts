import { Authorization, Message } from '@vestibule-link/alexa-video-skill-types';
import { DirectiveErrorResponse, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import { DirectiveHandler, DirectiveMessage, DirectiveResponseByNamespace } from './DirectiveTypes';
import { tokenManager } from '../event'



type DirectiveNamespace = Authorization.NamespaceType;

class Handler implements DirectiveHandler<DirectiveNamespace>{
    getScope(message: SubType<DirectiveMessage, DirectiveNamespace>): Message.Scope {
        return message.payload.grantee;
    }
    async getResponse(message: SubType<DirectiveMessage, DirectiveNamespace>,
        messageId: string, userSub: string): Promise<SubType<DirectiveResponseByNamespace, DirectiveNamespace>> {
        await tokenManager.lwaLogin(message.payload.grant.code, userSub);
        return {
            namespace: Authorization.namespace,
            name: 'AcceptGrant.Response',
            payload: {}
        }
    }
    getError(error: any, message: SubType<DirectiveMessage, DirectiveNamespace>,
        messageId: string): SubType<DirectiveErrorResponse, DirectiveNamespace> {
        if (error.errorType) {
            const vError: ErrorHolder = error;
            if (vError.errorType == Authorization.namespace) {
                return {
                    name: 'ErrorResponse',
                    namespace: Authorization.namespace,
                    payload: vError.errorPayload
                }
            } else {
                return {
                    name: 'ErrorResponse',
                    namespace: Authorization.namespace,
                    payload: {
                        type: 'ACCEPT_GRANT_FAILED',
                        message: vError.errorPayload.message
                    }
                }
            }
        } else if (error.message){
            return {
                name: 'ErrorResponse',
                namespace: Authorization.namespace,
                payload: {
                    type: 'ACCEPT_GRANT_FAILED',
                    message: error.message
                }
            }
        }
        return {
            name: 'ErrorResponse',
            namespace: Authorization.namespace,
            payload: {
                type: 'ACCEPT_GRANT_FAILED',
                message: 'Unknown Error'
            }
        }
    }
}

export default new Handler();