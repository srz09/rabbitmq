export interface QueueHandlerResponse {
    ack?: boolean;
    reject?: boolean;
    requeue?: boolean;
}
