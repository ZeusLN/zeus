import { sendCommand } from './utils';
import { wtclientrpc } from './../proto/lightning';

/**
 * The type of policy to retrieve.
 */
export enum PolicyType {
    LEGACY = 0,
    ANCHOR = 1
}

/**
 * Adds a new watchtower reachable at the given address.
 * If the watchtower already exists, any new addresses will be considered for session negotiations and backups.
 * @throws
 */
export const addTower = async (
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
        method: 'AddTower',
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
export const removeTower = async (
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
        method: 'RemoveTower',
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
export const listTowers = async (
    includeSessions: boolean = false
): Promise<wtclientrpc.ListTowersResponse> => {
    console.log('Calling listTowers with method: ListTowers');
    const response = await sendCommand<
        wtclientrpc.IListTowersRequest,
        wtclientrpc.ListTowersRequest,
        wtclientrpc.ListTowersResponse
    >({
        request: wtclientrpc.ListTowersRequest,
        response: wtclientrpc.ListTowersResponse,
        method: 'ListTowers',
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
export const getTowerInfo = async (
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
        method: 'GetTowerInfo',
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
export const getStats = async (): Promise<wtclientrpc.StatsResponse> => {
    const response = await sendCommand<
        wtclientrpc.IStatsRequest,
        wtclientrpc.StatsRequest,
        wtclientrpc.StatsResponse
    >({
        request: wtclientrpc.StatsRequest,
        response: wtclientrpc.StatsResponse,
        method: 'Stats',
        options: {}
    });
    return response;
};

/**
 * Retrieves the active watchtower client policy configuration.
 * @throws
 */
export const getPolicy = async (
    policyType: PolicyType = PolicyType.LEGACY
): Promise<wtclientrpc.PolicyResponse> => {
    const response = await sendCommand<
        wtclientrpc.IPolicyRequest,
        wtclientrpc.PolicyRequest,
        wtclientrpc.PolicyResponse
    >({
        request: wtclientrpc.PolicyRequest,
        response: wtclientrpc.PolicyResponse,
        method: 'Policy',
        options: {
            policy_type: policyType
        }
    });
    return response;
};
