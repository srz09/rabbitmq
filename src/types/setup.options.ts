import { ExchangeConfig } from './exchange.config';
import { QueueConfig } from './queue.config';

export interface SetupOptions {
    connectionString: string;
    exchanges?: ExchangeConfig[];
    queues?: QueueConfig[];
    disable?: boolean;
    logger?: any;
}
