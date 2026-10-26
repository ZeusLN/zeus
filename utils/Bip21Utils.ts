import { satsToBip21Amount } from './UnitsUtils';

// if format is case insensitive, format as all caps to save QR space,
// otherwise present in original format
const formatAddress = (address: string) =>
    address === address.toLowerCase() ? address.toUpperCase() : address;

const encodeMessage = (memo: string) => memo.replace(/ /g, '%20');

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
}) =>
    `bitcoin:${formatAddress(
        address
    )}?lightning=${paymentRequest.toUpperCase()}${
        Number(satAmount) > 0 ? `&amount=${satsToBip21Amount(satAmount)}` : ''
    }${memo ? `&message=${encodeMessage(memo)}` : ''}`;

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
    if (memo) params.push(`message=${encodeMessage(memo)}`);
    return `bitcoin:${formatAddress(address)}${
        params.length ? `?${params.join('&')}` : ''
    }`;
};
