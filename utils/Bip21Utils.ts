import BigNumber from 'bignumber.js';

import { SATS_PER_BTC } from './UnitsUtils';

const encodeMessage = (message: string): string | undefined => {
    try {
        return encodeURIComponent(message);
    } catch {
        // encodeURIComponent throws on lone surrogates
        return undefined;
    }
};

// Builds a BIP21 URI. The message is percent-encoded so characters
// like &, =, # and ? stay part of the message value.
export const buildBip21Uri = ({
    address,
    lightning,
    satAmount,
    message
}: {
    address: string;
    lightning?: string;
    satAmount?: string | number;
    message?: string;
}): string => {
    const params: string[] = [];
    if (lightning) params.push(`lightning=${lightning}`);
    if (Number(satAmount) > 0) {
        params.push(
            `amount=${new BigNumber(satAmount!)
                .dividedBy(SATS_PER_BTC)
                .toFixed()}`
        );
    }
    const encodedMessage = message ? encodeMessage(message) : undefined;
    if (encodedMessage) params.push(`message=${encodedMessage}`);

    return `bitcoin:${address}${params.length ? `?${params.join('&')}` : ''}`;
};
