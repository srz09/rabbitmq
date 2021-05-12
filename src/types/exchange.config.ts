import { ExchangeType } from './exchange.type';

export interface ExchangeConfig {
    name: string;
    type: ExchangeType;
    durable?: boolean;
    internal?: boolean;
}
