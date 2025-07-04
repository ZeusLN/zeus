import { localeString } from './LocaleUtils';
// @ts-ignore:next-line
import b58 from 'bs58check';

interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export type AddressType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2tr';

export const addressTypeLabels = {
    p2pkh: 'Legacy',
    'p2sh-p2wpkh': 'Nested SegWit',
    p2wpkh: 'Native SegWit',
    p2tr: 'Taproot'
};

export class WIFUtils {
    validateWIF(wif: string): ValidationResult {
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

        const decoded = b58.decode(wif);
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

        return { isValid: true };
    }

    baseUrl(network: string) {
        if (network === 'mainnet') {
            return 'https://blockstream.info/api';
        } else if (network === 'testnet') {
            return 'https://blockstream.info/testnet/api';
        }
    }
}

const wifUtils = new WIFUtils();
export default wifUtils;
