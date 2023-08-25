export declare enum SessionType {
    TYPE_MACAROON_READONLY = "TYPE_MACAROON_READONLY",
    TYPE_MACAROON_ADMIN = "TYPE_MACAROON_ADMIN",
    TYPE_MACAROON_CUSTOM = "TYPE_MACAROON_CUSTOM",
    TYPE_UI_PASSWORD = "TYPE_UI_PASSWORD",
    TYPE_AUTOPILOT = "TYPE_AUTOPILOT",
    TYPE_MACAROON_ACCOUNT = "TYPE_MACAROON_ACCOUNT",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum SessionState {
    STATE_CREATED = "STATE_CREATED",
    STATE_IN_USE = "STATE_IN_USE",
    STATE_REVOKED = "STATE_REVOKED",
    STATE_EXPIRED = "STATE_EXPIRED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface AddSessionRequest {
    /** A user assigned label for the session. */
    label: string;
    /**
     * The session type. This will be used during macaroon construction to
     * determine how restrictive to make the macaroon and thus the session access.
     */
    sessionType: SessionType;
    /** The time at which the session should automatically be revoked. */
    expiryTimestampSeconds: string;
    /** The address of the mailbox server that the LNC connection should use. */
    mailboxServerAddr: string;
    /** If set to true, tls will be skipped  when connecting to the mailbox. */
    devServer: boolean;
    /** Any custom permissions to add the session's macaroon. */
    macaroonCustomPermissions: MacaroonPermission[];
    /**
     * The ID of the account to associate this session with. This should only be
     * set if the session_type is TYPE_MACAROON_ACCOUNT.
     */
    accountId: string;
}
export interface MacaroonPermission {
    /**
     * The entity a permission grants access to. If a entity is set to the
     * "uri" keyword then the action entry should be one of the special cases
     * described in the comment for action.
     */
    entity: string;
    /**
     * The action that is granted. If entity is set to "uri", then action must
     * be set to either:
     * - a particular URI to which access should be granted.
     * - a URI regex, in which case access will be granted to each URI that
     * matches the regex.
     * - the "***readonly***" keyword. This will result in the access being
     * granted to all read-only endpoints.
     */
    action: string;
}
export interface AddSessionResponse {
    /** The session of the newly created session. */
    session: Session | undefined;
}
export interface Session {
    /**
     * A unique ID assigned to the session. It is derived from the session
     * macaroon.
     */
    id: Uint8Array | string;
    /** A user assigned label for the session. */
    label: string;
    /**
     * The current state that the session is in. This will give an indication of
     * if the session is currently usable or not.
     */
    sessionState: SessionState;
    /**
     * The session type. The will given an indication of the restrictions applied
     * to the macaroon assigned to the session.
     */
    sessionType: SessionType;
    /** The time at which the session will automatically be revoked. */
    expiryTimestampSeconds: string;
    /** The address of the mailbox server that the LNC connection should use. */
    mailboxServerAddr: string;
    /** If set to true, tls will be skipped  when connecting to the mailbox. */
    devServer: boolean;
    /** The LNC pairing phrase in byte form. */
    pairingSecret: Uint8Array | string;
    /** The LNC pairing phrase in mnemonic form. */
    pairingSecretMnemonic: string;
    /**
     * The long term, local static public key used by this node for the LNC
     * connection.
     */
    localPublicKey: Uint8Array | string;
    /**
     * The long term, remote static public key used by the remote party for the
     * LNC connection.
     */
    remotePublicKey: Uint8Array | string;
    /** The time at which the session was created. */
    createdAt: string;
    /**
     * The recipe used for creating a macaroon to use with this session. This will
     * be closely linked to the session type.
     */
    macaroonRecipe: MacaroonRecipe | undefined;
    /**
     * If the session is for a specific account, then this will be the account ID
     * it is associated with.
     */
    accountId: string;
    /**
     * If this session is for Autopilot use, then this will be the set of features
     * that the session can be used for along with the rules for each feature.
     */
    autopilotFeatureInfo: {
        [key: string]: RulesMap;
    };
    /**
     * The unix timestamp indicating the time at which the session was revoked.
     * Note that this field has not been around since the beginning and so it
     * could be the case that a session has been revoked but that this field
     * will not have been set for that session. Therefore, it is suggested that
     * readers should not assume that if this field is zero that the session is
     * not revoked. Readers should instead first check the session_state field.
     */
    revokedAt: string;
}
export interface Session_AutopilotFeatureInfoEntry {
    key: string;
    value: RulesMap | undefined;
}
export interface MacaroonRecipe {
    /** A list of permissions that should be included in the macaroon. */
    permissions: MacaroonPermission[];
    /** A list of caveats to add to the macaroon. */
    caveats: string[];
}
export interface ListSessionsRequest {
}
export interface ListSessionsResponse {
    /** A list of sessions. */
    sessions: Session[];
}
export interface RevokeSessionRequest {
    /**
     * The local static key of the session to be revoked.
     * When using REST, this field must be encoded as base64url.
     */
    localPublicKey: Uint8Array | string;
}
export interface RevokeSessionResponse {
}
export interface RulesMap {
    /**
     * A map of rule name to RuleValue. The RuleValue should be parsed based on
     * the name of the rule.
     */
    rules: {
        [key: string]: RuleValue;
    };
}
export interface RulesMap_RulesEntry {
    key: string;
    value: RuleValue | undefined;
}
export interface RuleValue {
    rateLimit: RateLimit | undefined;
    chanPolicyBounds: ChannelPolicyBounds | undefined;
    historyLimit: HistoryLimit | undefined;
    offChainBudget: OffChainBudget | undefined;
    onChainBudget: OnChainBudget | undefined;
    sendToSelf: SendToSelf | undefined;
    channelRestrict: ChannelRestrict | undefined;
    peerRestrict: PeerRestrict | undefined;
}
export interface RateLimit {
    /** The rate limit for read-only calls. */
    readLimit: Rate | undefined;
    /** The rate limit for write/execution calls. */
    writeLimit: Rate | undefined;
}
export interface Rate {
    /** The number of times a call is allowed in num_hours number of hours. */
    iterations: number;
    /** The number of hours in which the iterations count takes place over. */
    numHours: number;
}
export interface HistoryLimit {
    /**
     * The absolute unix timestamp in seconds before which no information should
     * be shared. This should only be set if duration is not set.
     */
    startTime: string;
    /**
     * The maximum relative duration in seconds that a request is allowed to query
     * for. This should only be set if start_time is not set.
     */
    duration: string;
}
export interface ChannelPolicyBounds {
    /** The minimum base fee in msat that the autopilot can set for a channel. */
    minBaseMsat: string;
    /** The maximum base fee in msat that the autopilot can set for a channel. */
    maxBaseMsat: string;
    /** The minimum ppm fee in msat that the autopilot can set for a channel. */
    minRatePpm: number;
    /** The maximum ppm fee in msat that the autopilot can set for a channel. */
    maxRatePpm: number;
    /** The minimum cltv delta that the autopilot may set for a channel. */
    minCltvDelta: number;
    /** The maximum cltv delta that the autopilot may set for a channel. */
    maxCltvDelta: number;
    /** The minimum htlc msat that the autopilot may set for a channel. */
    minHtlcMsat: string;
    /** The maximum htlc msat that the autopilot may set for a channel. */
    maxHtlcMsat: string;
}
export interface OffChainBudget {
    /** The maximum amount that can be spent off-chain excluding fees. */
    maxAmtMsat: string;
    /** The maximum amount that can be spent off-chain on fees. */
    maxFeesMsat: string;
}
export interface OnChainBudget {
    /** The maximum amount that can be spent on-chain including fees. */
    absoluteAmtSats: string;
    /** The maximum amount that can be spent on-chain in fees. */
    maxSatPerVByte: string;
}
export interface SendToSelf {
}
export interface ChannelRestrict {
    /**
     * A list of channel IDs that the Autopilot should _not_ perform any actions
     * on.
     */
    channelIds: string[];
}
export interface PeerRestrict {
    /** A list of peer IDs that the Autopilot should _not_ perform any actions on. */
    peerIds: string[];
}
/**
 * Sessions is a service that gives access to the core functionalities of the
 * daemon's session system.
 */
export interface Sessions {
    /**
     * litcli: `sessions add`
     * AddSession adds and starts a new LNC session.
     */
    addSession(request?: DeepPartial<AddSessionRequest>): Promise<AddSessionResponse>;
    /**
     * litcli: `sessions list`
     * ListSessions returns all sessions known to the session store.
     */
    listSessions(request?: DeepPartial<ListSessionsRequest>): Promise<ListSessionsResponse>;
    /**
     * litcli: `sessions revoke`
     * RevokeSession revokes a single session and also stops it if it is currently
     * active.
     */
    revokeSession(request?: DeepPartial<RevokeSessionRequest>): Promise<RevokeSessionResponse>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=lit-sessions.d.ts.map