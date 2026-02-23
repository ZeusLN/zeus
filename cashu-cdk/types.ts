/**
 * CDK (Cashu Development Kit) TypeScript Types
 * These types mirror the CDK FFI interfaces for React Native bridge
 */

// ============================================================================
// Core Types
// ============================================================================

export interface CDKProof {
    amount: number;
    secret: string;
    c: string;
    keyset_id: string;
    witness?: CDKWitness;
    dleq?: CDKProofDleq;
}

export interface CDKWitness {
    preimages?: string[];
    signatures?: string[];
}

export interface CDKProofDleq {
    e: string;
    s: string;
    r?: string;
}

export interface CDKToken {
    value: number;
    memo?: string;
    unit?: string;
    mint_url: string;
    encoded: string;
    proofs: CDKProof[];
}

// ============================================================================
// Mint Types
// ============================================================================

export interface CDKMintInfo {
    name?: string;
    pubkey?: string;
    version?: string;
    description?: string;
    description_long?: string;
    contact?: CDKMintContact[];
    motd?: string;
    icon_url?: string;
    nuts?: Record<string, any>;
}

export interface CDKMintContact {
    method: string;
    info: string;
}

export interface CDKKeyset {
    id: string;
    unit: string;
    active: boolean;
    input_fee_ppk?: number;
}

export interface CDKKeys {
    id: string;
    unit: string;
    keys: Record<string, string>;
}

// ============================================================================
// Quote Types
// ============================================================================

export type CDKQuoteState = 'Unpaid' | 'Paid' | 'Pending' | 'Issued';

export interface CDKMintQuote {
    id: string;
    amount?: number;
    unit: string;
    request: string;
    state: CDKQuoteState;
    expiry: number;
    mint_url: string;
}

export interface CDKMeltQuote {
    id: string;
    amount: number;
    unit: string;
    request: string;
    fee_reserve: number;
    state: CDKQuoteState;
    expiry: number;
    payment_preimage?: string;
}

export interface CDKMelted {
    state: CDKQuoteState;
    preimage?: string;
    change?: CDKProof[];
    amount: number;
    fee_paid: number;
}

// ============================================================================
// Spending Conditions (P2PK)
// ============================================================================

export interface CDKSpendingConditions {
    kind: 'P2PK' | 'HTLC';
    data: CDKP2PKCondition | CDKHTLCCondition;
}

export interface CDKP2PKCondition {
    pubkey: string;
    locktime?: number;
    refund_keys?: string[];
    num_sigs?: number;
    sig_flag?: 'SigInputs' | 'SigAll';
}

export interface CDKHTLCCondition {
    hash: string;
    locktime?: number;
    refund_keys?: string[];
}

// ============================================================================
// Send/Receive Options
// ============================================================================

export type CDKSendKind =
    | 'OnlineExact'
    | 'OnlineTolerance'
    | 'OfflineExact'
    | 'OfflineTolerance';

export interface CDKSendOptions {
    memo?: {
        memo: string;
        include_memo: boolean;
    };
    conditions?: CDKSpendingConditions;
    send_kind: CDKSendKind;
    include_fee: boolean;
}

export interface CDKReceiveOptions {
    p2pk_signing_keys?: string[]; // hex-encoded secret keys
    preimages?: string[];
}

// ============================================================================
// Wallet State Types
// ============================================================================

export interface CDKWalletBalance {
    mint_url: string;
    balance: number;
}

export interface CDKProofState {
    y: string;
    state: 'Unspent' | 'Pending' | 'Spent';
    witness?: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

export type CDKTransactionDirection = 'incoming' | 'outgoing';

export interface CDKTransaction {
    id: string;
    direction: CDKTransactionDirection;
    amount: number;
    fee?: number;
    mint_url: string;
    timestamp: number;
    memo?: string;
    state: string;
}

// ============================================================================
// Error Types
// ============================================================================

export enum CDKErrorType {
    Generic = 'Generic',
    AmountOverflow = 'AmountOverflow',
    PaymentFailed = 'PaymentFailed',
    PaymentPending = 'PaymentPending',
    InsufficientFunds = 'InsufficientFunds',
    Database = 'Database',
    Network = 'Network',
    InvalidToken = 'InvalidToken',
    Wallet = 'Wallet',
    KeysetUnknown = 'KeysetUnknown',
    UnitNotSupported = 'UnitNotSupported',
    InvalidMnemonic = 'InvalidMnemonic',
    InvalidUrl = 'InvalidUrl',
    MintNotFound = 'MintNotFound',
    QuoteExpired = 'QuoteExpired',
    QuoteNotPaid = 'QuoteNotPaid'
}

export interface CDKError {
    type: CDKErrorType;
    message: string;
}

// ============================================================================
// Native Module Interface
// ============================================================================

export interface CashuDevKitNativeModule {
    // Wallet Management
    initializeWallet(mnemonic: string, unit: string): Promise<void>;
    addMint(mintUrl: string, targetProofCount?: number): Promise<void>;
    removeMint(mintUrl: string): Promise<void>;
    getMintUrls(): Promise<string[]>;

    // Balance
    getTotalBalance(): Promise<number>;
    getBalances(): Promise<string>; // JSON string of Record<string, number>

    // Mint Info
    fetchMintInfo(mintUrl: string): Promise<string | null>; // JSON string
    getMintKeysets(mintUrl: string): Promise<string>; // JSON string

    // Mint Quotes (Receiving)
    createMintQuote(
        mintUrl: string,
        amount: number,
        description?: string
    ): Promise<string>;
    checkMintQuote(mintUrl: string, quoteId: string): Promise<string>;
    checkExternalMintQuote(mintUrl: string, quoteId: string): Promise<string>;
    addExternalMintQuote(
        mintUrl: string,
        quoteId: string,
        amount: number,
        request: string,
        state: string,
        expiry: number,
        secretKey?: string
    ): Promise<boolean>;
    mint(
        mintUrl: string,
        quoteId: string,
        conditionsJson?: string
    ): Promise<string>;
    mintExternal(
        mintUrl: string,
        quoteId: string,
        amount: number
    ): Promise<string>;

    // Melt Quotes (Paying)
    createMeltQuote(
        mintUrl: string,
        request: string,
        optionsJson?: string
    ): Promise<string>;
    checkMeltQuote(mintUrl: string, quoteId: string): Promise<string>;
    melt(mintUrl: string, quoteId: string): Promise<string>;

    // Token Operations
    prepareSend(
        mintUrl: string,
        amount: number,
        optionsJson?: string
    ): Promise<string>;
    confirmSend(preparedSendId: string, memo?: string): Promise<string>;
    cancelSend(preparedSendId: string): Promise<void>;
    receive(encodedToken: string, optionsJson?: string): Promise<number>;

    // Token Utility
    decodeToken(encodedToken: string): Promise<string>;
    isValidToken(encodedToken: string): Promise<boolean>;

    // Restore
    restore(mintUrl: string): Promise<number>;
    restoreFromSeed(mintUrl: string, seedHex: string): Promise<number>;

    // Proof Management
    checkProofsState(mintUrl: string, proofsJson: string): Promise<string>;

    // BOLT12 Support
    createMintBolt12Quote(
        mintUrl: string,
        amount?: number,
        description?: string
    ): Promise<string>;
    createMeltBolt12Quote(
        mintUrl: string,
        request: string,
        optionsJson?: string
    ): Promise<string>;
    createMeltHumanReadableQuote(
        mintUrl: string,
        address: string,
        amountMsat: number
    ): Promise<string>;

    // Transactions
    listTransactions(direction?: string): Promise<string>;

    // Database
    getDatabasePath(): Promise<string>;
}
