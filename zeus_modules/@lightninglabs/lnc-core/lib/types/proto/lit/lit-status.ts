/* eslint-disable */
export interface SubServerStatusReq {}

export interface SubServerStatusResp {
    /** A map of sub-server names to their status. */
    subServers: { [key: string]: SubServerStatus };
}

export interface SubServerStatusResp_SubServersEntry {
    key: string;
    value: SubServerStatus | undefined;
}

export interface SubServerStatus {
    /**
     * disabled is true if the sub-server is available in the LiT package but
     * has explicitly been disabled.
     */
    disabled: boolean;
    /** running is true if the sub-server is currently running. */
    running: boolean;
    /**
     * error describes an error that might have resulted in the sub-server not
     * starting up properly.
     */
    error: string;
    /**
     * custom_status details a custom state that the sub-server has entered,
     * which is unique to the sub-server, and which is not the standard
     * disabled, running or errored state.
     */
    customStatus: string;
}

/** The Status server can be used to query the state of various LiT sub-servers. */
export interface Status {
    subServerStatus(
        request?: DeepPartial<SubServerStatusReq>
    ): Promise<SubServerStatusResp>;
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
