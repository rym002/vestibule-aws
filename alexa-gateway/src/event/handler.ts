import { Alexa, Event } from "@vestibule-link/alexa-video-skill-types";
import { EndpointState, Shadow } from "@vestibule-link/iot-types";
import { Callback, Context, Handler } from "aws-lambda";
import { ValidEndpointState } from "../directive/DirectiveTypes";
import { convertToContext } from "../directive/DirectiveTypes";
import { createEndpointRequest, sendAlexaEvent } from "./";

const logger = console.debug;

interface ClientStateUpdate {
    userSub: string,
    endpointId: string,
    shadow: Shadow<EndpointState>
}

async function changeReportHandler(event: ClientStateUpdate, context: Context, callback: Callback<void>): Promise<void> {
    console.time('event-handler ' + context.awsRequestId);
    logger('Request: %j', event);
    const userSub = event.userSub
    const endpointId = event.endpointId
    const endpointState = event.shadow.state && event.shadow.state.reported
    const endpointMetadata = event.shadow.metadata && event.shadow.metadata.reported
    if (endpointState && endpointMetadata) {
        try {
            await sendEndpointEvent(endpointId, <ValidEndpointState>event.shadow, userSub, context.awsRequestId)
        } catch (err) {
            console.error(err)
        }
    }
    console.timeEnd('event-handler ' + context.awsRequestId);
}

async function sendEndpointEvent(endpointId: string, endpointShadow: ValidEndpointState,
    userSub: string, requestId: string) {
    const updatedContext = convertToContext(endpointShadow)
    const endpointRequest = await createEndpointRequest(userSub, endpointId)
    const token = endpointRequest.scope.type == 'BearerToken'
        ? endpointRequest.scope.token
        : ''
    const changeMessage: Alexa.ChangePayload = {
        change: {
            cause: {
                type: 'APP_INTERACTION'
            },
            properties: updatedContext.properties
        }
    }
    const message: Event.Message = {
        event: {
            header: {
                namespace: Alexa.namespace,
                name: 'ChangeReport',
                messageId: requestId,
                payloadVersion: '3'
            },
            payload: changeMessage,
            endpoint: endpointRequest
        }
    }
    logger('ChangeReport Request: %j', message);
    await sendAlexaEvent(message, userSub, token)
}
export const handler: Handler<ClientStateUpdate, void> = changeReportHandler;