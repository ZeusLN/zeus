import { localeString } from './LocaleUtils';
// @ts-ignore:next-line
import b58 from 'bs58check';

interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export type AddressType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2tr';

export class WIFUtils {
    validateWIF(wif: string): ValidationResult {
        try {
            if (!['K', 'L', '5', 'c', '9'].includes(wif[0])) {
                // 'K', 'L', '5' are the prefixes for mainnet, 'c', '9' are the prefixes for testnet
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

            const decoded = b58.decode(wif);
            if (decoded.length !== 33 && decoded.length !== 34) {
                return {
                    isValid: false,
                    error: localeString('views.Wif.invalidFormat')
                };
            }

            return { isValid: true };
        } catch (err) {
            return {
                isValid: false,
                error: localeString('views.Wif.invalidWif')
            };
        }
    }
}

const wifUtils = new WIFUtils();
export default wifUtils;
