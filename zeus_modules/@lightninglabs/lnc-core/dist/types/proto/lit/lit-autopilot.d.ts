import type { RulesMap, Session, RuleValue, MacaroonPermission } from './lit-sessions';
export interface AddAutopilotSessionRequest {
    /** A human readable label to assign to the session. */
    label: string;
    /** The unix timestamp at which this session should be revoked. */
    expiryTimestampSeconds: string;
    /** The address of the mailbox server to connect to for this session. */
    mailboxServerAddr: string;
    /** Set to true if tls should be skipped for when connecting to the mailbox. */
    devServer: boolean;
    /**
     * The features that the session should subscribe to. Each feature maps to
     * a FeatureConfig that should be applied to that feature.
     */
    features: {
        [key: string]: FeatureConfig;
    };
    /**
     * Rules that apply to the entire session. By default, no rules will apply
     * to the entire session.
     */
    sessionRules: RulesMap | undefined;
    /** Set to true of the session should not make use of the privacy mapper. */
    noPrivacyMapper: boolean;
}
export interface AddAutopilotSessionRequest_FeaturesEntry {
    key: string;
    value: FeatureConfig | undefined;
}
export interface FeatureConfig {
    /**
     * The RulesMap acts as an override map. In other words, by default the rules
     * values recommended by the Auto Pilot server will be used but the RulesMap
     * can be used to override the defaults.
     */
    rules: RulesMap | undefined;
    /** Serialised configuration for the feature. */
    config: Uint8Array | string;
}
export interface ListAutopilotSessionsRequest {
}
export interface ListAutopilotSessionsResponse {
    /** A list of the Autopilot sessions. */
    sessions: Session[];
}
export interface AddAutopilotSessionResponse {
    /** Details of the session that was just created. */
    session: Session | undefined;
}
export interface ListAutopilotFeaturesRequest {
}
export interface ListAutopilotFeaturesResponse {
    /** A map of feature names to Feature objects describing the feature. */
    features: {
        [key: string]: Feature;
    };
}
export interface ListAutopilotFeaturesResponse_FeaturesEntry {
    key: string;
    value: Feature | undefined;
}
export interface RevokeAutopilotSessionRequest {
    /**
     * The local static public key of the Autopilot session to be revoked.
     * When using REST, this field must be encoded as base64url.
     */
    localPublicKey: Uint8Array | string;
}
export interface RevokeAutopilotSessionResponse {
}
export interface Feature {
    /** Name is the name of the Autopilot feature. */
    name: string;
    /** A human readable description of what the feature offers. */
    description: string;
    /**
     * A map of rules that make sense for this feature. Each rule is accompanied
     * with appropriate default values for the feature along with minimum and
     * maximum values for the rules.
     */
    rules: {
        [key: string]: RuleValues;
    };
    /** A list of URI permissions required by the feature. */
    permissionsList: Permissions[];
    /**
     * A boolean indicating if the user would need to upgrade their Litd version in
     * order to subscribe to the Autopilot feature. This will be true if the
     * feature rules set contains a rule that Litd is unaware of.
     */
    requiresUpgrade: boolean;
}
export interface Feature_RulesEntry {
    key: string;
    value: RuleValues | undefined;
}
export interface RuleValues {
    /** Whether or not the users version of Litd is aware of this rule. */
    known: boolean;
    /**
     * The default values for the rule that the Autopilot server recommends for
     * the associated feature.
     */
    defaults: RuleValue | undefined;
    /** The minimum sane value for this rule for the associated feature. */
    minValue: RuleValue | undefined;
    /** The maximum sane value for this rule for the associated feature. */
    maxValue: RuleValue | undefined;
}
export interface Permissions {
    /** The URI in question. */
    method: string;
    /** A list of the permissions required for this method. */
    operations: MacaroonPermission[];
}
export interface Autopilot {
    /**
     * litcli: `autopilot features`
     * ListAutopilotFeatures fetches all the features supported by the Autopilot
     * server along with the rules that we need to support in order to subscribe
     * to those features.
     */
    listAutopilotFeatures(request?: DeepPartial<ListAutopilotFeaturesRequest>): Promise<ListAutopilotFeaturesResponse>;
    /**
     * litcli: `autopilot add`
     * AddAutopilotSession creates a new LNC session and attempts to register it
     * with the Autopilot server.
     */
    addAutopilotSession(request?: DeepPartial<AddAutopilotSessionRequest>): Promise<AddAutopilotSessionResponse>;
    /**
     * litcli: `autopilot list`
     * ListAutopilotSessions lists all the sessions that are of type
     * TypeAutopilot.
     */
    listAutopilotSessions(request?: DeepPartial<ListAutopilotSessionsRequest>): Promise<ListAutopilotSessionsResponse>;
    /**
     * litcli: `autopilot revoke`
     * RevokeAutopilotSession revokes an Autopilot session.
     */
    revokeAutopilotSession(request?: DeepPartial<RevokeAutopilotSessionRequest>): Promise<RevokeAutopilotSessionResponse>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=lit-autopilot.d.ts.map