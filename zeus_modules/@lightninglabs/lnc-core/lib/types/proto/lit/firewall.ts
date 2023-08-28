/* eslint-disable */
export enum ActionState {
    /** STATE_UNKNOWN - No state was assigned to the action. This should never be the case. */
    STATE_UNKNOWN = 'STATE_UNKNOWN',
    /**
     * STATE_PENDING - Pending means that the request resulting in the action being created
     * came through but that no response came back from the appropriate backend.
     * This means that the Action is either still being processed or that it
     * did not successfully complete.
     */
    STATE_PENDING = 'STATE_PENDING',
    /** STATE_DONE - Done means that the action successfully completed. */
    STATE_DONE = 'STATE_DONE',
    /** STATE_ERROR - Error means that the Action did not successfully complete. */
    STATE_ERROR = 'STATE_ERROR',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface PrivacyMapConversionRequest {
    /**
     * If set to true, then the input string will be taken as the real value and
     * the response will the the pseudo value it if exists. Otherwise, the input
     * string will be assumed to be the pseudo value.
     */
    realToPseudo: boolean;
    /** The session ID under which to search for the real-pseudo pair. */
    sessionId: Uint8Array | string;
    /** The input to be converted into the real or pseudo value. */
    input: string;
}

export interface PrivacyMapConversionResponse {
    /** The resulting real or pseudo output. */
    output: string;
}

export interface ListActionsRequest {
    /**
     * The feature name which the filter the actions by. If left empty, all feature
     * actions will be returned.
     */
    featureName: string;
    /**
     * The actor name to filter on. If left empty, all actor actions will be
     * returned.
     */
    actorName: string;
    /**
     * The method name to filter on. If left empty, actions for any method will be
     * returned.
     */
    methodName: string;
    /**
     * The action state to filter on. If set to zero, actions for any state will
     * be returned.
     */
    state: ActionState;
    /**
     * The index of an action that will be used as the start of a query to
     * determine which actions should be returned in the response.
     */
    indexOffset: string;
    /** The max number of actions to return in the response to this query. */
    maxNumActions: string;
    /**
     * If set, the actions returned will result from seeking backwards from the
     * specified index offset. This can be used to paginate backwards.
     */
    reversed: boolean;
    /**
     * Set to true if the total number of all actions that match the given filters
     * should be counted and returned in the request. Note that setting this will
     * significantly decrease the performance of the query if there are many
     * actions in the db.
     */
    countTotal: boolean;
    /**
     * The session ID to filter on. If left empty, actions for any session will
     * be returned.
     */
    sessionId: Uint8Array | string;
    /**
     * If specified, then only actions created after the given timestamp will be
     * considered.
     */
    startTimestamp: string;
    /**
     * If specified, then only actions created before the given timestamp will be
     * considered.
     */
    endTimestamp: string;
}

export interface ListActionsResponse {
    /** A list of actions performed by the autopilot server. */
    actions: Action[];
    /**
     * The index of the last item in the set of returned actions. This can be used
     * to seek further, pagination style.
     */
    lastIndexOffset: string;
    /**
     * The total number of actions that matched the filter in the request. It is
     * only set if count_total was set in the request.
     */
    totalCount: string;
}

export interface Action {
    /** The name of the actor that initiated the action. */
    actorName: string;
    /** The name of the feature that triggered the action. */
    featureName: string;
    /** A human readable reason that the action was performed. */
    trigger: string;
    /**
     * A human readable string describing the intended outcome successfully
     * performing the action.
     */
    intent: string;
    /** Structured info added by the action performer. */
    structuredJsonData: string;
    /** The URI of the method called. */
    rpcMethod: string;
    /** The parameters of the method call in compact json form. */
    rpcParamsJson: string;
    /** The unix timestamp in seconds at which the action was attempted. */
    timestamp: string;
    /** The action state. See ActionState for the meaning of each state. */
    state: ActionState;
    /**
     * If the state is Error, then this string will show the human readable reason
     * for why the action errored out.
     */
    errorReason: string;
    /** The ID of the session under which the action was performed. */
    sessionId: Uint8Array | string;
}

export interface Firewall {
    /**
     * litcli: `actions`
     * ListActions will return a list of actions that have been performed on the
     * node. The actions that will be persisted depends on the value of the
     * `--firewall.request-logger.level` config option. The default value of the
     * option is the "interceptor" mode which will persist only the actions (with
     * all request parameters) made with macaroons with caveats that force them
     * to be checked by an rpc middleware interceptor. If the "all" mode is used
     * then all actions will be persisted but only full request parameters will
     * only be stored if the actions are interceptor actions, otherwise only the
     * URI and timestamp of the actions will be stored. The "full" mode will
     * persist all request data for all actions.
     */
    listActions(
        request?: DeepPartial<ListActionsRequest>
    ): Promise<ListActionsResponse>;
    /**
     * litcli: `privacy`
     * PrivacyMapConversion can be used map real values to their pseudo
     * counterpart and vice versa.
     */
    privacyMapConversion(
        request?: DeepPartial<PrivacyMapConversionRequest>
    ): Promise<PrivacyMapConversionResponse>;
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
