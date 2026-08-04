// DonationUtils.ts
import BigNumber from 'bignumber.js';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { sha256 } from '@noble/hashes/sha256';

import Base64Utils from './Base64Utils';
import Bolt11Utils from './Bolt11Utils';

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
        const decoded = Bolt11Utils.decode(pr);
        if (!new BigNumber(decoded.num_msat).isEqualTo(amountMsat)) {
            console.error(
                'loadLnurl error: invoice amount mismatch:',
                decoded.num_msat,
                'msat !==',
                amountMsat.toString(),
                'msat'
            );
            return null;
        }

        const metadata = lnurlData?.metadata;
        const expectedDescriptionHash =
            typeof metadata === 'string'
                ? Base64Utils.bytesToHex(
                      Array.from(sha256(Base64Utils.utf8ToBytes(metadata)))
                  )
                : null;
        if (
            !expectedDescriptionHash ||
            decoded.description_hash !== expectedDescriptionHash
        ) {
            console.error('loadLnurl error: description hash mismatch');
            return null;
        }

        return pr;
    } catch (err) {
        console.error('loadLnurl error:', err);
        return null;
    }
};
