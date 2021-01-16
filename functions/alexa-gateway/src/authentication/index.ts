import { Message } from '@vestibule-link/alexa-video-skill-types';
import { ErrorHolder } from '@vestibule-link/iot-types';
import { getUserSub } from 'vestibule-common-layer'

export async function getSub(scope: Message.Scope): Promise<string> {
    if (scope.type == 'BearerToken') {
        const token = scope.token
        try {
            return getUserSub(token)
        } catch (e) {
            let errorMessage = e.message;
            const error: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    type: 'INVALID_AUTHORIZATION_CREDENTIAL',
                    message: errorMessage
                }
            }
            throw error;
        }
    }
    const error: ErrorHolder = {
        errorType: 'Alexa',
        errorPayload: {
            type: 'INVALID_AUTHORIZATION_CREDENTIAL',
            message: 'Invalid Scope'
        }
    }
    throw error;
}