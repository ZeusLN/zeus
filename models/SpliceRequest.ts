export interface SpliceOutRequest {
    channelId: string;
    amount: string;
    destination: string;
    feeRate?: number;
    forceFeerate?: boolean;
}

export interface SpliceInRequest {
    channelId: string;
    amount: string;
    feeRate?: number;
    forceFeerate?: boolean;
}

export interface SpliceDryrunResult {
    txid: string;
    psbt?: string;
    tx?: string;
    fee: number;
    transcript?: string[];
    script: string;
}

export interface SpliceExecutionResult {
    txid: string;
    psbt?: string;
    tx?: string;
    script: string;
}
