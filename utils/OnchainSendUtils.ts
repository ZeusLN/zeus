import { randomBytes } from 'react-native-randombytes';

import { LookupOptions, lookUpWithRetries } from './RequestTimeoutUtils';

// An on-chain send whose request timed out may still have been broadcast:
// lnd keeps executing SendCoins after the client stops waiting (LNC's 60s
// request timer, the 30s REST timeout). Each LND send therefore carries a
// unique label, so after a timeout the wallet's transactions can show
// whether it went out before anyone is offered a retry.

export const SEND_LABEL_PREFIX = 'ZEUS send ';

export const makeSendLabel = (): string =>
    `${SEND_LABEL_PREFIX}${randomBytes(8).toString('hex')}`;

// Looks for a sent transaction in the wallet's transactions. Resolves the
// txid, or undefined if the send was not found.
export const findSentTransaction = (
    getTransactions: () => Promise<any>,
    isSent: (tx: any) => boolean,
    options?: LookupOptions
): Promise<string | undefined> =>
    lookUpWithRetries(async () => {
        const result = await getTransactions();
        const match = (result?.transactions || []).find(
            (tx: any) => tx && isSent(tx)
        );
        return match?.tx_hash || undefined;
    }, options);
