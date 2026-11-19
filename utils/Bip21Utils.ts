import { satsToBip21Amount } from './UnitsUtils';

// if format is case insensitive, format as all caps to save QR space,
// otherwise present in original format
const formatAddress = (address: string) =>
    address === address.toLowerCase() ? address.toUpperCase() : address;

// Percent-encode the memo so characters like &, =, # and ? stay part
// of the message value. Gives undefined when there is no memo or it
// cannot be encoded (encodeURIComponent throws on lone surrogates).
const encodeMessage = (memo?: string): string | undefined => {
    if (!memo) return undefined;
    try {
        return encodeURIComponent(memo);
    } catch {
        return undefined;
    }
};

export const buildUnifiedUri = ({
    address,
    paymentRequest,
    satAmount,
    memo
}: {
    address: string;
    paymentRequest: string;
    satAmount: string | number;
    memo?: string;
}) => {
    const message = encodeMessage(memo);
    return `bitcoin:${formatAddress(
        address
    )}?lightning=${paymentRequest.toUpperCase()}${
        Number(satAmount) > 0 ? `&amount=${satsToBip21Amount(satAmount)}` : ''
    }${message ? `&message=${message}` : ''}`;
};

export const buildOnChainUri = ({
    address,
    satAmount,
    memo
}: {
    address: string;
    satAmount: string | number;
    memo?: string;
}) => {
    const params: string[] = [];
    if (Number(satAmount) > 0) {
        params.push(`amount=${satsToBip21Amount(satAmount)}`);
    }
    const message = encodeMessage(memo);
    if (message) params.push(`message=${message}`);
    return `bitcoin:${formatAddress(address)}${
        params.length ? `?${params.join('&')}` : ''
    }`;
};
