import { getDecodedToken } from '@cashu/cashu-ts';
import CashuDevKit, { CDKToken } from '../cashu-cdk';

export const cashuTokenPrefixes = [
    'https://wallet.nutstash.app/#',
    'https://wallet.cashu.me/?token=',
    'web+cashu://',
    'cashu://',
    'cashu:'
];

class CashuUtils {
    /**
     * Extract raw token string from various URL formats
     */
    extractTokenString = (token: string): string => {
        if (!token || typeof token !== 'string') {
            return '';
        }
        token = token.trim();

        // Find cashuA prefix if present
        const idx = token.indexOf('cashuA');
        if (idx !== -1) {
            token = token.slice(idx);
        }

        // Remove URL prefixes
        for (const prefix of cashuTokenPrefixes) {
            if (token.startsWith(prefix)) {
                token = token.slice(prefix.length).trim();
                break;
            }
        }

        return token.trim();
    };

    isValidCashuToken = (token: string) => {
        if (!token || typeof token !== 'string') {
            return false;
        }

        const cleanToken = this.extractTokenString(token);
        if (!cleanToken) {
            return false;
        }

        try {
            getDecodedToken(cleanToken);
            return true;
        } catch (_) {
            return false;
        }
    };

    /**
     * Async token validation using CDK (more accurate)
     */
    isValidCashuTokenAsync = async (token: string): Promise<boolean> => {
        if (!token || typeof token !== 'string') {
            return false;
        }

        const cleanToken = this.extractTokenString(token);
        if (!cleanToken) {
            return false;
        }

        if (CashuDevKit.isAvailable()) {
            return await CashuDevKit.isValidToken(cleanToken);
        }

        // Fall back to sync validation if CDK not available
        return this.isValidCashuToken(token);
    };

    sumProofsValue = (proofs: any) => {
        if (!proofs || !Array.isArray(proofs)) {
            return 0;
        }
        return proofs.reduce((r: number, c: any) => {
            return r + c.amount;
        }, 0);
    };

    /**
     * Decode cashu token (sync - uses cashu-ts)
     */
    decodeCashuToken = (token: string) => getDecodedToken(token.trim());

    /**
     * Decode cashu token using CDK (async)
     */
    decodeCashuTokenAsync = async (token: string): Promise<CDKToken> => {
        const cleanToken = this.extractTokenString(token);
        return await CashuDevKit.decodeToken(cleanToken);
    };

    /**
     * Get token value without receiving it
     */
    getTokenValue = async (token: string): Promise<number> => {
        try {
            if (CashuDevKit.isAvailable()) {
                const decoded = await CashuDevKit.decodeToken(
                    this.extractTokenString(token)
                );
                return decoded.value;
            }

            // Fall back to cashu-ts if CDK not available
            const decoded = this.decodeCashuToken(token);
            return this.sumProofsValue(decoded.proofs);
        } catch {
            return 0;
        }
    };

    /**
     * Get token mint URL
     */
    getTokenMintUrl = async (token: string): Promise<string | null> => {
        try {
            if (CashuDevKit.isAvailable()) {
                const decoded = await CashuDevKit.decodeToken(
                    this.extractTokenString(token)
                );
                return decoded.mint_url;
            }

            // Fall back to cashu-ts if CDK not available
            const decoded = this.decodeCashuToken(token);
            return decoded.mint || null;
        } catch {
            return null;
        }
    };

    isTokenP2PKLocked = (token: { proofs?: Array<{ secret: string }> }) => {
        if (!token.proofs || !Array.isArray(token.proofs)) {
            return false;
        }
        const secrets = token.proofs.map((proof) => proof.secret);
        for (const secret of secrets) {
            if (this.getP2PKPubkeySecret(secret)) {
                const locktime = this.getP2PKLocktime(secret);
                const currentTime = Date.now() / 1000;
                if (!locktime) {
                    return true;
                } else if (locktime > currentTime) {
                    return true;
                }
            }
        }
        return false;
    };
    getP2PKPubkeySecret = (secret: string) => {
        try {
            let secretObject = JSON.parse(secret);
            if (
                secretObject[0] == 'P2PK' &&
                secretObject[1]['data'] != undefined
            ) {
                return secretObject[1]['data'];
            }
            return undefined;
        } catch {
            return undefined;
        }
    };

    getP2PKLocktime = (secret: string) => {
        try {
            let secretObject = JSON.parse(secret);
            if (
                secretObject[0] == 'P2PK' &&
                secretObject[1]['tags'] != undefined
            ) {
                const tag = secretObject[1]['tags'].find(
                    ([name]: [string, string]) => name === 'locktime'
                );
                return tag ? tag[1] : undefined;
            }
            return undefined;
        } catch {
            return undefined;
        }
    };
}

const cashuUtils = new CashuUtils();
export default cashuUtils;
