import CashuDevKit, { CDKToken } from '../cashu-cdk';

export const cashuTokenPrefixes = [
    'https://wallet.nutstash.app/#',
    'https://wallet.cashu.me/?token=',
    'web+cashu://',
    'cashu://',
    'cashu:'
];

// Limits to mitigate resource exhaustion from malicious P2PK secret payloads
const MAX_P2PK_SECRET_LENGTH = 2048;
const MAX_P2PK_SECRET_DEPTH = 10;

/**
 * Safely parse JSON for P2PK secret. Rejects oversized or deeply nested
 * payloads to prevent resource exhaustion (DoS) from attacker-controlled input.
 */
function safeParseP2PKSecret(secret: string): unknown | null {
    if (typeof secret !== 'string') return null;
    if (secret.length > MAX_P2PK_SECRET_LENGTH) return null;

    let depth = 0;
    let maxDepth = 0;
    for (let i = 0; i < secret.length; i++) {
        const c = secret[i];
        if (c === '[' || c === '{') {
            depth++;
            maxDepth = Math.max(maxDepth, depth);
            if (maxDepth > MAX_P2PK_SECRET_DEPTH) return null;
        } else if (c === ']' || c === '}') {
            depth--;
        }
    }
    if (depth !== 0) return null; // unbalanced brackets

    try {
        return JSON.parse(secret);
    } catch {
        return null;
    }
}

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

    isValidCashuToken = (token: string): boolean => {
        if (!token || typeof token !== 'string') {
            return false;
        }

        const cleanToken = this.extractTokenString(token);
        if (!cleanToken) {
            return false;
        }

        return (
            cleanToken.startsWith('cashuA') || cleanToken.startsWith('cashuB')
        );
    };

    isValidCashuTokenAsync = async (token: string): Promise<boolean> => {
        if (!token || typeof token !== 'string') {
            return false;
        }

        const cleanToken = this.extractTokenString(token);
        if (!cleanToken) {
            return false;
        }

        return await CashuDevKit.isValidToken(cleanToken);
    };

    sumProofsValue = (proofs: any) => {
        if (!proofs || !Array.isArray(proofs)) {
            return 0;
        }
        return proofs.reduce((r: number, c: any) => {
            return r + c.amount;
        }, 0);
    };

    decodeCashuTokenAsync = async (token: string): Promise<CDKToken> => {
        const cleanToken = this.extractTokenString(token);
        return await CashuDevKit.decodeToken(cleanToken);
    };

    getTokenValue = async (token: string): Promise<number> => {
        try {
            const decoded = await CashuDevKit.decodeToken(
                this.extractTokenString(token)
            );
            return decoded.value;
        } catch {
            return 0;
        }
    };

    getTokenMintUrl = async (token: string): Promise<string | null> => {
        try {
            const decoded = await CashuDevKit.decodeToken(
                this.extractTokenString(token)
            );
            return decoded.mint_url;
        } catch {
            return null;
        }
    };

    isTokenP2PKLocked = (token: { proofs?: Array<{ secret: string }> }) => {
        if (!token.proofs || !Array.isArray(token.proofs)) {
            return false;
        }
        for (const proof of token.proofs) {
            if (typeof proof.secret !== 'string') continue;
            if (this.getP2PKPubkeySecret(proof.secret)) {
                const locktime = this.getP2PKLocktime(proof.secret);
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
        const secretObject = safeParseP2PKSecret(secret);
        if (secretObject == null) return undefined;
        if (
            Array.isArray(secretObject) &&
            secretObject[0] === 'P2PK' &&
            secretObject[1] != null &&
            typeof secretObject[1] === 'object' &&
            secretObject[1]['data'] != undefined
        ) {
            return secretObject[1]['data'];
        }
        return undefined;
    };

    getP2PKLocktime = (secret: string) => {
        const secretObject = safeParseP2PKSecret(secret);
        if (secretObject == null) return undefined;
        if (
            Array.isArray(secretObject) &&
            secretObject[0] === 'P2PK' &&
            secretObject[1] != null &&
            typeof secretObject[1] === 'object' &&
            Array.isArray(secretObject[1]['tags'])
        ) {
            const tag = secretObject[1]['tags'].find(
                ([name]: [string, string]) => name === 'locktime'
            );
            return tag ? tag[1] : undefined;
        }
        return undefined;
    };
}

const cashuUtils = new CashuUtils();
export default cashuUtils;
