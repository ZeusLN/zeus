export enum SpliceOperationType {
    OUT = 'out',
    IN = 'in'
}

export enum SpliceStatus {
    PENDING = 'pending',
    EXECUTING = 'executing',
    CONFIRMING = 'confirming',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface SpliceOperation {
    channelId: string;
    txid: string | null;
    type: SpliceOperationType;
    status: SpliceStatus;
    amount: string;
    destination?: string;
    fee: number;
    script: string;
    startedAt: number;
    confirmations: number;
    error?: string;
    previousLocalBalance?: string;
}
