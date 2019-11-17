import { Alexa, Event } from "@vestibule-link/alexa-video-skill-types";
import { getShadowEndpoint, getShadowEndpointMetadata, Shadow, toLocalEndpoint } from "@vestibule-link/iot-types";
import { Callback, Context, Handler } from "aws-lambda";
import { keys } from 'lodash';
import { convertToContext } from "../directive";
import { TrackedEndpointShadow } from "../directive/Endpoint";
import { createEndpointRequest, sendAlexaEvent } from "./";

const logger = console.debug;

interface ClientStateUpdate {
    userSub: string,
    shadow: Shadow
}

async function changeReportHandler(event: ClientStateUpdate, context: Context, callback: Callback<void>): Promise<void> {
    console.time('event-handler ' + context.awsRequestId);
    logger('Request: %j', event);
    const userSub = event.userSub
    const reported = event.shadow.state && event.shadow.state.reported
    if (reported && reported.endpoints) {
        const endpoints = reported.endpoints
        const promises = keys(endpoints).map(async endpointId => {
            const endpoint = toLocalEndpoint(endpointId);
            const endpointState = getShadowEndpoint(event.shadow, endpoint)
            const endpointMetadata = getShadowEndpointMetadata(event.shadow, endpoint)
            if (endpointState && endpointMetadata) {
                try {
                    await sendEndpointEvent({
                        endpoint: endpointState,
                        metadata: endpointMetadata
                    }, endpointId, userSub, context.awsRequestId + endpointId)
                } catch (err) {
                    console.error(err)
                }
            }
        })
        await Promise.all(promises)
    }
    console.timeEnd('event-handler ' + context.awsRequestId);
}

async function sendEndpointEvent(trackedEndpoint: TrackedEndpointShadow, endpointId: string, userSub: string, requestId: string) {
    const updatedContext = convertToContext(trackedEndpoint)
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
    await sendAlexaEvent(message, userSub, token)
}
export const handler: Handler<ClientStateUpdate, void> = changeReportHandler;