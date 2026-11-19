import * as bitcoin from 'bitcoinjs-lib';
// @ts-ignore:next-line
import b58 from 'bs58check';

import AddressUtils from './AddressUtils';
import { localeString } from './LocaleUtils';

export type AddressType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2tr';

interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export class WIFUtils {
    // The key is swept on the connected node's network, so it must have been
    // encoded for that network
    validateWIF(
        wif: string,
        network: bitcoin.Network = AddressUtils.bitcoinNetworkForNode()
    ): ValidationResult {
        const firstChar = wif[0];

        if (!['K', 'L', '5', 'c', '9'].includes(firstChar)) {
            return {
                isValid: false,
                error: localeString('views.Wif.invalidPrefix')
            };
        }

        if (wif.length !== 51 && wif.length !== 52) {
            return {
                isValid: false,
                error: localeString('views.Wif.invalidLength')
            };
        }

        if (
            !/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(
                wif
            )
        ) {
            return {
                isValid: false,
                error: localeString('views.Wif.invalidBase58Chars')
            };
        }

        let decoded;
        try {
            decoded = b58.decode(wif);
        } catch (e) {
            return {
                isValid: false,
                error: localeString('views.Wif.invalidFormat')
            };
        }

        if (
            decoded.length !== 33 &&
            decoded.length !== 34 &&
            decoded.length !== 38
        ) {
            return {
                isValid: false,
                error: localeString('views.Wif.invalidFormat')
            };
        }

        if (decoded[0] !== network.wif) {
            return {
                isValid: false,
                error: localeString('views.Wif.wrongNetwork')
            };
        }

        return { isValid: true };
    }
}

const wifUtils = new WIFUtils();
export default wifUtils;
