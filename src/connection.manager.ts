import { RabbitConnection } from './rabbit.connection';

class RabbitManager {

    private static _instances: { [connectionName: string]: RabbitConnection }

    public static getInstance(name: string = 'default') {
        if (!this._instances) {
            this._instances = {};
        }

        if (!this._instances[name]) {
            this._instances[name] = new RabbitConnection();
        }

        return this._instances[name];
    }

}

export function getInstance(name?: string) {
    return RabbitManager.getInstance(name);
}