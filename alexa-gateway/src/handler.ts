import { Directive, Event } from '@vestibule-link/alexa-video-skill-types'
import { Handler, Context, Callback } from 'aws-lambda';
import { getSub } from './authentication';
import { getShadow, ensureDeviceActive } from './iot';
import { findDirectiveHandler, DirectiveMessage } from './handlers';
import { SubType, DirectiveResponse, DirectiveErrorResponse } from '@vestibule-link/iot-types';

const SHADOW_PREFIX = 'vestibule-bridge-'
const logger = console.debug;

async function directiveHandler(directive: Directive.Message, context: Context, callback: Callback<any>): Promise<Event.Message> {
    console.time('handler');
    logger('Request: %j', directive);
    const header = directive.directive.header;
    const namespace = header.namespace;
    const messageHandler = findDirectiveHandler(namespace);
    const messageId = context.awsRequestId;
    let response: SubType<DirectiveResponse, any> | SubType<DirectiveErrorResponse, any>;
    const directiveMessage = toDirectiveMessage(directive);
    try {
        const scope = messageHandler.getScope(directiveMessage);
        const userInfo = await getSub(scope);
        const clientId = SHADOW_PREFIX + userInfo;
        const shadow = await getShadow(clientId);
        ensureDeviceActive(shadow);
        response = await messageHandler.getResponse(directiveMessage, messageId, clientId, shadow);
    } catch (err) {
        console.log(err);
        response = messageHandler.getError(err, directiveMessage, messageId);
    }
    const event = toEventMessage(response, directiveMessage, messageId);
    console.timeEnd('handler');
    logger('Response: %j', event);
    return event;
}

function toEventMessage(response: SubType<DirectiveResponse, any> | SubType<DirectiveErrorResponse, any>, request: SubType<DirectiveMessage, any>, messageId: String): Event.Message {
    const { namespace, name, context, ...eventData } = response;

    return <Event.Message>{
        context: context,
        event: {
            header: {
                namespace: namespace,
                name: name,
                messageId: messageId,
                payloadVersion: '3',
                correlationToken: request.header.correlationToken
            },
            ...eventData
        }
    }
}
function toDirectiveMessage<NS extends Directive.Namespaces>(message: Directive.Message): SubType<DirectiveMessage, NS> {
    const directive = message.directive;
    const header = directive.header;
    return <SubType<DirectiveMessage, NS>>{
        namespace: header.namespace,
        name: header.name,
        ...directive
    }
}
export const handler: Handler<any,Event.Message> = directiveHandler;