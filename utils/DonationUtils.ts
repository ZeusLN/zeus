// DonationUtils.ts
import BigNumber from 'bignumber.js';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { verifyLnurlPayInvoice } from './LnurlPayUtils';

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
 * Calculates the balance needed to pay an invoice and then send the donation
 * that follows it. The donation is a separate payment drawn from the same
 * balance once the invoice is paid, so a balance that only covers the invoice
 * and its fee reserve leaves the donation unpayable.
 * @param paymentAmount - Invoice amount, can be a number or string
 * @param feeReserve - Fee reserve quoted for the invoice
 * @param donationAmount - Donation sent after the payment, 0 when disabled
 * @returns The total amount that has to be available
 */
export const calculateTotalWithDonation = (
    paymentAmount: number | string,
    feeReserve: number | string = 0,
    donationAmount: number | string = 0
): number => {
    return new BigNumber(paymentAmount || 0)
        .plus(feeReserve || 0)
        .plus(donationAmount || 0)
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
    const protocol = bolt11Domain.includes('.onion') ? 'http' : 'https';
    const url = `${protocol}://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`;

    try {
        const amountMsat = new BigNumber(donationAmount || 0).multipliedBy(
            1000
        );
        if (!amountMsat.isInteger() || amountMsat.lte(0)) {
            console.error(
                'loadLnurl error: invalid donation amount:',
                donationAmount
            );
            return null;
        }

        const response = await ReactNativeBlobUtil.fetch('GET', url);
        const lnurlData = response.json();

        // The invoice returned by this callback is paid silently, with no
        // confirmation screen, so never follow it off the donation domain
        const callback = lnurlData?.callback;
        const origin = `${protocol}://${bolt11Domain}`;
        if (
            typeof callback !== 'string' ||
            (callback !== origin && !callback.startsWith(`${origin}/`))
        ) {
            console.error('loadLnurl error: unexpected callback URL');
            return null;
        }

        const callbackUrl = `${callback}?amount=${amountMsat.toString()}`;

        const invoiceResponse = await ReactNativeBlobUtil.fetch(
            'GET',
            callbackUrl
        );
        const invoiceData = invoiceResponse.json();
        const pr = invoiceData?.pr;
        if (typeof pr !== 'string') {
            console.error('loadLnurl error: no payment request returned');
            return null;
        }

        // Since there is no confirmation screen, a compromised server must
        // not be able to name its own price: enforce LUD-06 client-side by
        // requiring an exact amount match and a description_hash committing
        // to the served metadata
        const check = verifyLnurlPayInvoice(
            pr,
            lnurlData?.metadata,
            amountMsat
        );
        if (!check.ok) {
            console.error('loadLnurl error:', check.reason);
            return null;
        }

        return pr;
    } catch (err) {
        console.error('loadLnurl error:', err);
        return null;
    }
};
