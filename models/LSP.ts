export enum LSPOrderState {
    CREATED = 'CREATED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export interface LSPActivity {
    model: 'LSPS1Order' | 'LSPS7Order';
    state: LSPOrderState;
    getAmount: number;
    getTimestamp: number;
    getDate: Date;
    getDisplayTimeShort: string;
}
