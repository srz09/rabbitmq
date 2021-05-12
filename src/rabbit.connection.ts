
import { Connection, Channel, ConsumeMessage, connect, Options } from 'amqplib';
import { ExchangeConfig, QueueConfig, SetupOptions } from './types';

const defaultLogger = {
    trace: (msg) => console.log(`(logger#trace) - ${msg}`),
    debug: (msg) => console.log(`(logger#debug) - ${msg}`),
    info: (msg) => console.log(`(logger#info) - ${msg}`),
    warn: (msg) => console.log(`(logger#warn) - ${msg}`),
    error: (msg) => console.log(`(logger#error) - ${msg}`)
};

export class RabbitConnection {

    private connection: Connection;
    private readChannel: Channel;
    private writeChannel: Channel;
    private consumerTags: string[];
    private disable: boolean;
    private logger: any;

    constructor() {
        this.connection = null;
        this.readChannel = null;
        this.writeChannel = null;

        this.consumerTags = [];
    }

    private async _connect(connectionString: string): Promise<void> {
        this.logger.trace('(RabbitModuleClass) - function #_connect starts');

        try {
            this.connection = await connect(connectionString);
        } catch (err) {
            const hiddenConnectionString = connectionString.replace(/\/\/.*@/, '//***:***@');
            this.logger
                .error(`Couldn't connect to "${hiddenConnectionString}" [err="${err.message}"]`);
        }
    }

    private async _createChannels(): Promise<void> {
        this.logger.trace('(RabbitModuleClass) - function #_createChannels starts');

        if (!this.connection) {
            this.logger
                .error(`Couldn't create read & write channels witout alived connection, skipping.`);

            return;
        }

        try {
            this.readChannel = await this.connection.createChannel();
        } catch (err) {
            this.logger
                .error(`Couldn't create channel "read" [err="${err.message}"]`);
        }

        try {
            this.writeChannel = await this.connection.createChannel();
        } catch (err) {
            this.logger
                .error(`Couldn't create channel "write" [err="${err.message}"]`);
        }
    }

    private async _initExchanges(exchangesConfig: ExchangeConfig[]): Promise<void> {
        this.logger.trace('(RabbitModuleClass) - function #_initExchanges starts');

        if (!this.readChannel) {
            this.logger
                .error(`Couldn't init exchanges without a read channel, skipping.`);

            return;
        }

        await Promise.all(
            exchangesConfig
                .map(exchangeConfig => ({
                    ...exchangeConfig,
                    durable: exchangeConfig.durable !== undefined ? exchangeConfig.durable : true,
                    internal: exchangeConfig.internal !== undefined ? exchangeConfig.internal : false,
                }))
                .map(
                    exchangeConfig => this.readChannel
                        .assertExchange(
                            exchangeConfig.name,
                            exchangeConfig.type,
                            { durable: exchangeConfig.durable }
                        )
                        .catch(err => {
                            this.logger
                                .error(`Couldn't assert exchange "${exchangeConfig.name}" [err="${err.message}"]`);
                        })
                )
        );
    }

    private async _initQueues(queuesConfig: QueueConfig[]): Promise<void> {
        this.logger.trace('(RabbitModuleClass) - function #_initQueues starts');

        if (!this.readChannel) {
            this.logger
                .error(`Couldn't init queues without a read channel, skipping.`);

            return;
        }

        await Promise.all(
            queuesConfig
                .map(queueConfig => ({
                    ...queueConfig,
                    autoDelete: queueConfig.autoDelete !== undefined ? queueConfig.autoDelete : false,
                    exclusive: queueConfig.exclusive !== undefined ? queueConfig.exclusive : false,
                    durable: queueConfig.durable !== undefined ? queueConfig.durable : true,
                }))
                .map(
                    queueConfig => this.readChannel
                        .assertQueue(queueConfig.name)
                        .then(() => queueConfig.bindings
                            ? Promise.all(
                                queueConfig.bindings.map(
                                    binding => this.readChannel
                                        .bindQueue(queueConfig.name, binding.exchange, binding.routing_key)
                                )
                            )
                            : Promise.resolve(null)
                        )
                        .then(() => this.readChannel
                            .consume(
                                queueConfig.name,
                                async function(rawMessage: ConsumeMessage) {
                                    const message = {
                                        ...rawMessage,
                                        content: JSON.parse(rawMessage.content.toString())
                                    };

                                    const res = await queueConfig.handler(message);
                                    if (res.ack) {
                                        this.readChannel.ack(rawMessage);
                                    } else if (res.reject) {
                                        this.readChannel.reject(rawMessage, res.requeue);
                                    }
                                }.bind(this)
                            )
                            .then(({ consumerTag }) => {
                                this.consumerTags.push(consumerTag);
                            })
                        )
                        .catch(err => {
                            this.logger
                                .error(`Couldn't configure queue "${queueConfig.name}" [err="${err.message}"]`);
                        })
                )
        );
    }

    public async setup({ disable, logger, connectionString, exchanges, queues }: SetupOptions): Promise<void> {
        this.disable = disable || false;
        this.logger = logger || defaultLogger;

        this.logger.trace('(RabbitModuleClass) - function #setup starts');

        if (this.disable) {
            this.logger
                .debug(`[#setup] - rabbit is disabled, skipping.`);

            return;
        }

        await this._connect(connectionString);
        await this._createChannels();

        if (exchanges && exchanges.length) {
            await this._initExchanges(exchanges);
        }

        if (queues && queues.length) {
            await this._initQueues(queues);
        }
    }

    public publish(exchange: string, routingKey: string, content: any, options: Options.Publish): void {
        this.logger.trace('(RabbitModuleClass) - function #publish starts');

        if (this.disable) {
            this.logger
                .debug(`[#publish] - rabbit is disabled, skipping.`);

            return;
        }

        if (!this.writeChannel) {
            this.logger
                .error(`Couldn't publish message without a write channel, skipping.`);

            return;
        }

        try {
            const buffContent = Buffer.from(JSON.stringify(content));
            this.writeChannel
                .publish(exchange, routingKey, buffContent, options);
        } catch (err) {
            this.logger
                .error(`Couldn't publish message (exchange="${exchange}", routing_key="${routingKey}") [err="${err.message}"]`);
        }
    }

    public sendToQueue(queue: string, content: any, options: Options.Publish): void {
        this.logger.trace('(RabbitModuleClass) - function #sendToQueue starts');

        if (this.disable) {
            this.logger
                .debug(`[#sendToQueue] - rabbit is disabled, skipping.`);

            return;
        }

        if (!this.writeChannel) {
            this.logger
                .error(`Couldn't send message to queue without a write channel, skipping.`);

            return;
        }

        try {
            const buffContent = Buffer.from(JSON.stringify(content));
            this.writeChannel
                .sendToQueue(queue, buffContent, options);
        } catch (err) {
            this.logger
                .error(`Couldn't send message to queue "${queue}" [err="${err.message}"]`);
        }
    }

    public async close(): Promise<void> {
        this.logger.trace('(RabbitModuleClass) - function #close starts');

        if (this.disable) {
            this.logger
                .debug(`[#close] - rabbit is disabled, skipping.`);

            return;
        }

        await Promise.all(
            this.consumerTags.map(
                consumerTag => this.readChannel
                    .cancel(consumerTag)
                    .catch(err => {
                        this.logger
                            .error(`Couldn't cancel consumer "${consumerTag}" [err="${err.message}"]`);
                    })
            )
        );

        this.consumerTags = [];

        try {
            await this.readChannel.close();
        } catch (err) {
            this.logger
                .error(`Couldn't cancel "readChannel" [err="${err.message}"]`);
        }

        try {
            await this.writeChannel.close();
        } catch (err) {
            this.logger
                .error(`Couldn't cancel "writeChannel" [err="${err.message}"]`);
        }

        try {
            await this.connection.close();
        } catch (err) {
            this.logger
                .error(`Couldn't close connection [err="${err.message}"]`);
        }
    }

}
