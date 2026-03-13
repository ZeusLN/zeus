/* eslint-disable */

export enum WalletState {
    /** NON_EXISTING - NON_EXISTING means that the wallet has not yet been initialized. */
    NON_EXISTING = 'NON_EXISTING',
    /** LOCKED - LOCKED means that the wallet is locked and requires a password to unlock. */
    LOCKED = 'LOCKED',
    /**
     * UNLOCKED - UNLOCKED means that the wallet was unlocked successfully, but RPC server
     * isn't ready.
     */
    UNLOCKED = 'UNLOCKED',
    /**
     * RPC_ACTIVE - RPC_ACTIVE means that the lnd server is active but not fully ready for
     * calls.
     */
    RPC_ACTIVE = 'RPC_ACTIVE',
    /** SERVER_ACTIVE - SERVER_ACTIVE means that the lnd server is ready to accept calls. */
    SERVER_ACTIVE = 'SERVER_ACTIVE',
    /**
     * WAITING_TO_START - WAITING_TO_START means that node is waiting to become the leader in a
     * cluster and is not started yet.
     */
    WAITING_TO_START = 'WAITING_TO_START',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface SubscribeStateRequest {}

export interface SubscribeStateResponse {
    state: WalletState;
}

export interface GetStateRequest {}

export interface GetStateResponse {
    state: WalletState;
}

/**
 * State service is a always running service that exposes the current state of
 * the wallet and RPC server.
 */
export interface State {
    /**
     * SubscribeState subscribes to the state of the wallet. The current wallet
     * state will always be delivered immediately.
     */
    subscribeState(
        request?: DeepPartial<SubscribeStateRequest>,
        onMessage?: (msg: SubscribeStateResponse) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * GetState returns the current wallet state without streaming further
     * changes.
     */
    getState(request?: DeepPartial<GetStateRequest>): Promise<GetStateResponse>;
}

type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
