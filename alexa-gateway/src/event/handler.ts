import { Handler, Callback, Context } from "aws-lambda";
import { EndpointState, Providers, EndpointMetadata } from "@vestibule-link/iot-types";
import { keys } from 'lodash'
import { convertToContext, stateToMetadata } from "../directive";
import { Event, Alexa } from "@vestibule-link/alexa-video-skill-types";
import { sendAlexaEvent, createEndpointRequest } from "./";

const logger = console.debug;

interface ClientStateUpdate {
    userSub: string,
    endpoints: Providers<'alexa'>
}

async function directiveHandler(event: ClientStateUpdate, context: Context, callback: Callback<void>): Promise<void> {
    console.time('event-handler ' + context.awsRequestId);
    logger('Request: %j', event);
    const userSub = event.userSub
    const promises = keys(event.endpoints).map(async endpointId => {
        const endpointState = event.endpoints[endpointId]
        try {
            await sendEndpointEvent(endpointState, userSub, endpointId)
        } catch (err) {
            console.error(err)
        }
    })
    await Promise.all(promises)
    console.timeEnd('event-handler ' + context.awsRequestId);
}

async function sendEndpointEvent(endpointState: EndpointState, endpointId: string, userSub: string) {
    const metadata: EndpointMetadata = stateToMetadata(endpointState)
    const updatedContext = convertToContext({
        endpoint: endpointState,
        metadata: metadata
    })
    const endpointRequest = await createEndpointRequest(userSub, endpointId)
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
                messageId: 'messageId',
                correlationToken: 'correlationToken',
                payloadVersion: '3'
            },
            payload: changeMessage,
            endpoint: endpointRequest
        }
    }
    await sendAlexaEvent(message, userSub, endpointId)
}
export const handler: Handler<ClientStateUpdate, void> = directiveHandler;