import { Agent } from 'https';
import axios, { } from 'axios';
import { getParameters } from '../config';
import { EventGateway, Event, Message } from '@vestibule-link/alexa-video-skill-types';
import tokenManager from './Lwa'
const alexaAxios = axios.create({
    httpsAgent: new Agent(
        { keepAlive: true }
    )
});
interface AlexaParameters {
    gatewayUri: string
}

export async function sendAlexaEvent(request: Event.Message, clientId: string, endpointId:string) {
    try {
        const token = await tokenManager.getToken(clientId)
        const bearerToken: Message.BearerToken = {
            type: 'BearerToken',
            token: token
        }
        const endpoint: Message.EndpointRequest = {
            endpointId: endpointId,
            scope: bearerToken
        }
        request.event['endpoint'] = endpoint
        
        const alexaParameters = await getParameters<AlexaParameters>('alexa');
        console.time('sendAlexaEvent' + clientId)
        await alexaAxios.post(alexaParameters.gatewayUri, request, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
    } catch (err) {
        const errorResponse: EventGateway.AlexaErrorResponse = err.response.data;
        console.log(errorResponse);
        switch (errorResponse.payload.type) {
            case 'SKILL_DISABLED_EXCEPTION':
                await tokenManager.deleteClientTokens(clientId);
                break;
        }
        throw new Error(errorResponse.payload.message)
    } finally {
        console.timeEnd('sendAlexaEvent' + clientId)
    }
}
