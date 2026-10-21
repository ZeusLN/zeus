import BackendUtils from './BackendUtils';

export const MAX_ROUTE_HINTS_LND = 20;
export const MAX_ROUTE_HINTS_LDK = 3;

// LDK Node (user channel id based hints) caps hints lower than LND
export const maxRouteHints = (): number =>
    BackendUtils.supportsRouteHintUserChannelIds()
        ? MAX_ROUTE_HINTS_LDK
        : MAX_ROUTE_HINTS_LND;
