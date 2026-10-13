jest.mock('./BackendUtils', () => ({
    __esModule: true,
    default: { supportsRouteHintUserChannelIds: jest.fn() }
}));

import BackendUtils from './BackendUtils';
import {
    maxRouteHints,
    MAX_ROUTE_HINTS_LDK,
    MAX_ROUTE_HINTS_LND
} from './RouteHintUtils';

describe('maxRouteHints', () => {
    it('uses the LDK limit for user-channel-id backends', () => {
        (
            BackendUtils.supportsRouteHintUserChannelIds as jest.Mock
        ).mockReturnValue(true);
        expect(maxRouteHints()).toBe(MAX_ROUTE_HINTS_LDK);
    });

    it('uses the LND limit otherwise', () => {
        (
            BackendUtils.supportsRouteHintUserChannelIds as jest.Mock
        ).mockReturnValue(false);
        expect(maxRouteHints()).toBe(MAX_ROUTE_HINTS_LND);
    });
});
