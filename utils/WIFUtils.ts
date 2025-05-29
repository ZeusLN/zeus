import { localeString } from './LocaleUtils';
// @ts-ignore:next-line
import b58 from 'bs58check';

interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export class WIFUtils {
    validateWIF(wif: string): ValidationResult {
        try {
            if (!['K', 'L', '5'].includes(wif[0])) {
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
