/* eslint-disable */
export enum PolicyType {
    /** LEGACY - Selects the policy from the legacy tower client. */
    LEGACY = 'LEGACY',
    /** ANCHOR - Selects the policy from the anchor tower client. */
    ANCHOR = 'ANCHOR',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface AddTowerRequest {
    /** The identifying public key of the watchtower to add. */
    pubkey: Uint8Array | string;
    /** A network address the watchtower is reachable over. */
    address: string;
}

export interface AddTowerResponse {}

export interface RemoveTowerRequest {
    /** The identifying public key of the watchtower to remove. */
    pubkey: Uint8Array | string;
    /**
     * If set, then the record for this address will be removed, indicating that is
     * is stale. Otherwise, the watchtower will no longer be used for future
     * session negotiations and backups.
     */
    address: string;
}

export interface RemoveTowerResponse {}

export interface GetTowerInfoRequest {
    /** The identifying public key of the watchtower to retrieve information for. */
    pubkey: Uint8Array | string;
    /** Whether we should include sessions with the watchtower in the response. */
    includeSessions: boolean;
    /**
     * Whether to exclude exhausted sessions in the response info. This option
     * is only meaningful if include_sessions is true.
     */
    excludeExhaustedSessions: boolean;
}

export interface TowerSession {
    /**
     * The total number of successful backups that have been made to the
     * watchtower session.
     */
    numBackups: number;
    /**
     * The total number of backups in the session that are currently pending to be
     * acknowledged by the watchtower.
     */
    numPendingBackups: number;
    /** The maximum number of backups allowed by the watchtower session. */
    maxBackups: number;
    /**
     * Deprecated, use sweep_sat_per_vbyte.
     * The fee rate, in satoshis per vbyte, that will be used by the watchtower for
     * the justice transaction in the event of a channel breach.
     *
     * @deprecated
     */
    sweepSatPerByte: number;
    /**
     * The fee rate, in satoshis per vbyte, that will be used by the watchtower for
     * the justice transaction in the event of a channel breach.
     */
    sweepSatPerVbyte: number;
}

export interface Tower {
    /** The identifying public key of the watchtower. */
    pubkey: Uint8Array | string;
    /** The list of addresses the watchtower is reachable over. */
    addresses: string[];
    /**
     * Deprecated, use the active_session_candidate field under the
     * correct identifier in the client_type map.
     * Whether the watchtower is currently a candidate for new sessions.
     *
     * @deprecated
     */
    activeSessionCandidate: boolean;
    /**
     * Deprecated, use the num_sessions field under the correct identifier
     * in the client_type map.
     * The number of sessions that have been negotiated with the watchtower.
     *
     * @deprecated
     */
    numSessions: number;
    /**
     * Deprecated, use the sessions field under the correct identifier in the
     * client_type map.
     * The list of sessions that have been negotiated with the watchtower.
     *
     * @deprecated
     */
    sessions: TowerSession[];
    /** A list sessions held with the tower. */
    sessionInfo: TowerSessionInfo[];
}

export interface TowerSessionInfo {
    /** Whether the watchtower is currently a candidate for new sessions. */
    activeSessionCandidate: boolean;
    /** The number of sessions that have been negotiated with the watchtower. */
    numSessions: number;
    /** The list of sessions that have been negotiated with the watchtower. */
    sessions: TowerSession[];
    /** The session's policy type. */
    policyType: PolicyType;
}

export interface ListTowersRequest {
    /** Whether we should include sessions with the watchtower in the response. */
    includeSessions: boolean;
    /**
     * Whether to exclude exhausted sessions in the response info. This option
     * is only meaningful if include_sessions is true.
     */
    excludeExhaustedSessions: boolean;
}

export interface ListTowersResponse {
    /** The list of watchtowers available for new backups. */
    towers: Tower[];
}

export interface StatsRequest {}

export interface StatsResponse {
    /**
     * The total number of backups made to all active and exhausted watchtower
     * sessions.
     */
    numBackups: number;
    /**
     * The total number of backups that are pending to be acknowledged by all
     * active and exhausted watchtower sessions.
     */
    numPendingBackups: number;
    /**
     * The total number of backups that all active and exhausted watchtower
     * sessions have failed to acknowledge.
     */
    numFailedBackups: number;
    /** The total number of new sessions made to watchtowers. */
    numSessionsAcquired: number;
    /** The total number of watchtower sessions that have been exhausted. */
    numSessionsExhausted: number;
}

export interface PolicyRequest {
    /** The client type from which to retrieve the active offering policy. */
    policyType: PolicyType;
}

export interface PolicyResponse {
    /**
     * The maximum number of updates each session we negotiate with watchtowers
     * should allow.
     */
    maxUpdates: number;
    /**
     * Deprecated, use sweep_sat_per_vbyte.
     * The fee rate, in satoshis per vbyte, that will be used by watchtowers for
     * justice transactions in response to channel breaches.
     *
     * @deprecated
     */
    sweepSatPerByte: number;
    /**
     * The fee rate, in satoshis per vbyte, that will be used by watchtowers for
     * justice transactions in response to channel breaches.
     */
    sweepSatPerVbyte: number;
}

/**
 * WatchtowerClient is a service that grants access to the watchtower client
 * functionality of the daemon.
 */
export interface WatchtowerClient {
    /**
     * AddTower adds a new watchtower reachable at the given address and
     * considers it for new sessions. If the watchtower already exists, then
     * any new addresses included will be considered when dialing it for
     * session negotiations and backups.
     */
    addTower(request?: DeepPartial<AddTowerRequest>): Promise<AddTowerResponse>;
    /**
     * RemoveTower removes a watchtower from being considered for future session
     * negotiations and from being used for any subsequent backups until it's added
     * again. If an address is provided, then this RPC only serves as a way of
     * removing the address from the watchtower instead.
     */
    removeTower(
        request?: DeepPartial<RemoveTowerRequest>
    ): Promise<RemoveTowerResponse>;
    /** ListTowers returns the list of watchtowers registered with the client. */
    listTowers(
        request?: DeepPartial<ListTowersRequest>
    ): Promise<ListTowersResponse>;
    /** GetTowerInfo retrieves information for a registered watchtower. */
    getTowerInfo(request?: DeepPartial<GetTowerInfoRequest>): Promise<Tower>;
    /** Stats returns the in-memory statistics of the client since startup. */
    stats(request?: DeepPartial<StatsRequest>): Promise<StatsResponse>;
    /** Policy returns the active watchtower client policy configuration. */
    policy(request?: DeepPartial<PolicyRequest>): Promise<PolicyResponse>;
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
