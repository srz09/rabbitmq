import { DecodedContentMessage } from './decoded.content.message';
import { QueueBindingConfig } from './queue.binding.config';
import { QueueHandlerResponse } from './queue.handler.response';

export interface QueueConfig {
    name: string;
    handler: (message: DecodedContentMessage) => Promise<QueueHandlerResponse>;
    bindings?: QueueBindingConfig[];
    exclusive?: boolean;
    autoDelete?: boolean;
    durable?: boolean;
}
