import { sendCommand } from './utils';
import { wtclientrpc } from './../proto/lightning';

/**
 * Adds a new watchtower reachable at the given address.
 * If the watchtower already exists, any new addresses will be considered for session negotiations and backups.
 * @throws
 */
export const WatchtowerClientAddTower = async (
    pubkey: string,
    address: string
): Promise<wtclientrpc.AddTowerResponse> => {
    const response = await sendCommand<
        wtclientrpc.IAddTowerRequest,
        wtclientrpc.AddTowerRequest,
        wtclientrpc.AddTowerResponse
    >({
        request: wtclientrpc.AddTowerRequest,
        response: wtclientrpc.AddTowerResponse,
        method: 'WatchtowerClientAddTower',
        options: {
            pubkey: new Uint8Array(Buffer.from(pubkey, 'hex')),
            address
        }
    });
    return response;
};

/**
 * Removes a watchtower from being considered for future session negotiations.
 * If an address is provided, only that address is removed from the watchtower.
 * @throws
 */
export const WatchtowerClientRemoveTower = async (
    pubkey: string,
    address?: string
): Promise<wtclientrpc.RemoveTowerResponse> => {
    const response = await sendCommand<
        wtclientrpc.IRemoveTowerRequest,
        wtclientrpc.RemoveTowerRequest,
        wtclientrpc.RemoveTowerResponse
    >({
        request: wtclientrpc.RemoveTowerRequest,
        response: wtclientrpc.RemoveTowerResponse,
        method: 'WatchtowerClientRemoveTower',
        options: {
            pubkey: new Uint8Array(Buffer.from(pubkey, 'hex')),
            address
        }
    });
    return response;
};

/**
 * Lists all registered watchtowers.
 * @throws
 */
export const WatchtowerClientListTowers = async (
    includeSessions: boolean = false
): Promise<wtclientrpc.ListTowersResponse> => {
    const response = await sendCommand<
        wtclientrpc.IListTowersRequest,
        wtclientrpc.ListTowersRequest,
        wtclientrpc.ListTowersResponse
    >({
        request: wtclientrpc.ListTowersRequest,
        response: wtclientrpc.ListTowersResponse,
        method: 'WatchtowerClientListTowers',
        options: {
            include_sessions: includeSessions
        }
    });
    return response;
};

/**
 * Retrieves information for a specific watchtower.
 * @throws
 */
export const WatchtowerClientGetTowerInfo = async (
    pubkey: string,
    includeSessions: boolean = false
): Promise<wtclientrpc.Tower> => {
    const response = await sendCommand<
        wtclientrpc.IGetTowerInfoRequest,
        wtclientrpc.GetTowerInfoRequest,
        wtclientrpc.Tower
    >({
        request: wtclientrpc.GetTowerInfoRequest,
        response: wtclientrpc.Tower,
        method: 'WatchtowerClientGetTowerInfo',
        options: {
            pubkey: new Uint8Array(Buffer.from(pubkey, 'hex')),
            include_sessions: includeSessions
        }
    });
    return response;
};

/**
 * Gets watchtower client statistics since startup.
 * @throws
 */
export const WatchtowerClientGetStats =
    async (): Promise<wtclientrpc.StatsResponse> => {
        const response = await sendCommand<
            wtclientrpc.IStatsRequest,
            wtclientrpc.StatsRequest,
            wtclientrpc.StatsResponse
        >({
            request: wtclientrpc.StatsRequest,
            response: wtclientrpc.StatsResponse,
            method: 'WatchtowerClientStats',
            options: {}
        });
        return response;
    };

/**
 * Retrieves the active watchtower client policy configuration.
 * @throws
 */
export const WatchtowerClientGetPolicy = async (
    policyType: wtclientrpc.PolicyType = wtclientrpc.PolicyType.LEGACY
): Promise<wtclientrpc.PolicyResponse> => {
    const response = await sendCommand<
        wtclientrpc.IPolicyRequest,
        wtclientrpc.PolicyRequest,
        wtclientrpc.PolicyResponse
    >({
        request: wtclientrpc.PolicyRequest,
        response: wtclientrpc.PolicyResponse,
        method: 'WatchtowerClientPolicy',
        options: {
            policy_type: policyType
        }
    });
    return response;
};

/**
 * Deactivates a watchtower so that it is not considered for session negotiation.
 * Its sessions will also not be used while the tower is inactive.
 * @throws
 */
export const WatchtowerClientDeactivateTower = async (
    pubkey: string
): Promise<wtclientrpc.DeactivateTowerResponse> => {
    const response = await sendCommand<
        wtclientrpc.IDeactivateTowerRequest,
        wtclientrpc.DeactivateTowerRequest,
        wtclientrpc.DeactivateTowerResponse
    >({
        request: wtclientrpc.DeactivateTowerRequest,
        response: wtclientrpc.DeactivateTowerResponse,
        method: 'WatchtowerClientDeactivateTower',
        options: {
            pubkey: new Uint8Array(Buffer.from(pubkey, 'hex'))
        }
    });
    return response;
};

/**
 * Terminates a watchtower session and marks it as terminal so that it is not used for backups anymore.
 * @throws
 */
export const WatchtowerClientTerminateSession = async (
    sessionId: string
): Promise<wtclientrpc.TerminateSessionResponse> => {
    const response = await sendCommand<
        wtclientrpc.ITerminateSessionRequest,
        wtclientrpc.TerminateSessionRequest,
        wtclientrpc.TerminateSessionResponse
    >({
        request: wtclientrpc.TerminateSessionRequest,
        response: wtclientrpc.TerminateSessionResponse,
        method: 'WatchtowerClientTerminateSession',
        options: {
            session_id: new Uint8Array(Buffer.from(sessionId, 'hex'))
        }
    });
    return response;
};
