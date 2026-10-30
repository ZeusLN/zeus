import { NWCClient } from '@getalby/sdk';

// NIP-47 methods that move funds or sign with the wallet's keys.
// create_connection is included because it can mint new connections
// with any of these permissions.
export const NWC_SPEND_METHODS = [
    'pay_invoice',
    'pay_keysend',
    'multi_pay_invoice',
    'multi_pay_keysend',
    'sign_message',
    'create_connection'
];

export const NWC_SCOPE_CHECK_TIMEOUT_MS = 20000;

export type NWCScopeStatus =
    | 'receiveOnly'
    | 'canSpend'
    | 'missingMakeInvoice'
    | 'unknown';

export interface NWCScopeResult {
    status: NWCScopeStatus;
    spendMethods: string[];
}

const isSpendMethod = (method: string) =>
    NWC_SPEND_METHODS.includes(method) ||
    method.startsWith('pay_') ||
    method.startsWith('multi_pay_');

/**
 * Classifies the methods a NIP-47 connection is allowed to call, as
 * reported by its own get_info response. A missing or empty list is
 * treated as unknown rather than as receive-only.
 */
export const classifyNWCConnectionMethods = (
    methods?: unknown
): NWCScopeResult => {
    if (!Array.isArray(methods) || methods.length === 0) {
        return { status: 'unknown', spendMethods: [] };
    }
    const names = methods.filter(
        (method): method is string => typeof method === 'string'
    );
    const spendMethods = names.filter(isSpendMethod);
    if (spendMethods.length > 0) {
        return { status: 'canSpend', spendMethods };
    }
    if (!names.includes('make_invoice')) {
        return { status: 'missingMakeInvoice', spendMethods: [] };
    }
    return { status: 'receiveOnly', spendMethods: [] };
};

/**
 * Asks the wallet service which methods this connection may call
 * (NIP-47 get_info) and classifies them. Any failure, including a
 * connection that is not allowed to call get_info, returns unknown.
 */
export const checkNWCConnectionScope = async (
    nostrWalletConnectUrl: string,
    timeoutMs: number = NWC_SCOPE_CHECK_TIMEOUT_MS
): Promise<NWCScopeResult> => {
    let client: NWCClient | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        client = new NWCClient({ nostrWalletConnectUrl });
        const info = await Promise.race([
            client.getInfo(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error('get_info timed out')),
                    timeoutMs
                );
            })
        ]);
        return classifyNWCConnectionMethods(info?.methods);
    } catch (e) {
        return { status: 'unknown', spendMethods: [] };
    } finally {
        if (timer) clearTimeout(timer);
        try {
            client?.close();
        } catch (e) {
            // discarding the client
        }
    }
};
