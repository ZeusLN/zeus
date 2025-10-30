export enum LSPOrderState {
    CREATED = 'CREATED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export interface LSPS1Activity {
    model: 'LSPS1Order';
    state: LSPOrderState;
    getAmount: number;
    getTimestamp: number;
    getDate: Date;
    getDisplayTimeShort: string;
}

export interface LSPS7Activity {
    model: 'LSPS7Order';
    state: LSPOrderState;
    getAmount: number;
    getTimestamp: number;
    getDate: Date;
    getDisplayTimeShort: string;
}
