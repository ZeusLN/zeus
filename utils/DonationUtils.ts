// DonationUtils.ts
import BigNumber from 'bignumber.js';
import ReactNativeBlobUtil from 'react-native-blob-util';

const DONATION_ADDRESS = 'tips@pay.zeusln.app';

/**
 * Calculates donation amount based on a given percentage of a base amount.
 * @param requestAmount - Invoice amount, can be a number or string
 * @param percentage - The donation percentage to apply
 * @returns The calculated donation amount
 */
export const calculateDonationAmount = (
    requestAmount: number | string,
    percentage: number
): number => {
    return new BigNumber(requestAmount || 0)
        .multipliedBy(percentage)
        .dividedBy(100)
        .integerValue(BigNumber.ROUND_DOWN)
        .toNumber();
};

/**
 * Finds the index of a matching percentage in predefined percentage options.
 * @param value - The donation percentage value to find
 * @param options - The list of available percentage options
 * @returns Index if found, otherwise null
 */
export const findDonationPercentageIndex = (
    value: number,
    options: number[]
): number | null => {
    const index = options.indexOf(value);
    return index === -1 ? null : index;
};

export const loadDonationLnurl = async (
    donationAmount: string
): Promise<string | null> => {
    const [username, bolt11Domain] = DONATION_ADDRESS.split('@');
    const url = bolt11Domain.includes('.onion')
        ? `http://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`
        : `https://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`;

    try {
        const response = await ReactNativeBlobUtil.fetch('GET', url);
        const lnurlData = response.json();
        const amount = parseFloat(donationAmount) * 1000;
        const callbackUrl = `${lnurlData.callback}?amount=${amount}`;

        const invoiceResponse = await ReactNativeBlobUtil.fetch(
            'GET',
            callbackUrl
        );
        const invoiceData = invoiceResponse.json();

        return invoiceData.pr;
    } catch (err) {
        console.error('loadLnurl error:', err);
        return null;
    }
};
