/* eslint-disable */
export interface StatusRequest {}

export interface StatusResponse {
    /** Indicates whether the autopilot is active or not. */
    active: boolean;
}

export interface ModifyStatusRequest {
    /** Whether the autopilot agent should be enabled or not. */
    enable: boolean;
}

export interface ModifyStatusResponse {}

export interface QueryScoresRequest {
    pubkeys: string[];
    /** If set, we will ignore the local channel state when calculating scores. */
    ignoreLocalState: boolean;
}

export interface QueryScoresResponse {
    results: QueryScoresResponse_HeuristicResult[];
}

export interface QueryScoresResponse_HeuristicResult {
    heuristic: string;
    scores: { [key: string]: number };
}

export interface QueryScoresResponse_HeuristicResult_ScoresEntry {
    key: string;
    value: number;
}

export interface SetScoresRequest {
    /** The name of the heuristic to provide scores to. */
    heuristic: string;
    /**
     * A map from hex-encoded public keys to scores. Scores must be in the range
     * [0.0, 1.0].
     */
    scores: { [key: string]: number };
}

export interface SetScoresRequest_ScoresEntry {
    key: string;
    value: number;
}

export interface SetScoresResponse {}

/**
 * Autopilot is a service that can be used to get information about the current
 * state of the daemon's autopilot agent, and also supply it with information
 * that can be used when deciding where to open channels.
 */
export interface Autopilot {
    /** Status returns whether the daemon's autopilot agent is active. */
    status(request?: DeepPartial<StatusRequest>): Promise<StatusResponse>;
    /**
     * ModifyStatus is used to modify the status of the autopilot agent, like
     * enabling or disabling it.
     */
    modifyStatus(
        request?: DeepPartial<ModifyStatusRequest>
    ): Promise<ModifyStatusResponse>;
    /**
     * QueryScores queries all available autopilot heuristics, in addition to any
     * active combination of these heruristics, for the scores they would give to
     * the given nodes.
     */
    queryScores(
        request?: DeepPartial<QueryScoresRequest>
    ): Promise<QueryScoresResponse>;
    /**
     * SetScores attempts to set the scores used by the running autopilot agent,
     * if the external scoring heuristic is enabled.
     */
    setScores(
        request?: DeepPartial<SetScoresRequest>
    ): Promise<SetScoresResponse>;
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
