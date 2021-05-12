import { Message } from 'amqplib';

export interface DecodedContentMessage extends Omit<Message, 'content'> {
    content: any;
}
