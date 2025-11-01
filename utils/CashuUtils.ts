import { getDecodedToken, Token } from '@cashu/cashu-ts';

export enum MintPaymentStatus {
    IDLE = 'idle',
    REQUESTING = 'requesting',
    PAYING = 'paying',
    SUCCESS = 'success',
    FAILED = 'failed'
}

export interface MintProgressInfo {
    mintUrl: string;
    mintName?: string;
    balance: number;
    selected: boolean;
    status: MintPaymentStatus;
    allocatedAmount?: number;
    error?: string;
}

export enum MultinutPaymentStep {
    SELECT = 'select',
    PROCESSING = 'processing',
    COMPLETE = 'complete',
    FAILED = 'failed'
}

export type MultimintProgressCallback = (progress: {
    step: MultinutPaymentStep;
    mints: MintProgressInfo[];
    totalSelectedBalance: number;
    isProcessing: boolean;
}) => void;

export const cashuTokenPrefixes = [
    'https://wallet.nutstash.app/#',
    'https://wallet.cashu.me/?token=',
    'web+cashu://',
    'cashu://',
    'cashu:'
];

class CashuUtils {
    isValidCashuToken = (token: string) => {
        if (!token || typeof token !== 'string') {
            return false;
        }
        token = token.trim();
        const idx = token.indexOf('cashuA');
        if (idx !== -1) {
            token = token.slice(idx);
        }
        cashuTokenPrefixes.forEach((prefix) => {
            if (!token.startsWith(prefix)) {
                return false;
            }
            token = token.slice(prefix.length).trim();
        });
        if (!token) {
            return false;
        }
        try {
            getDecodedToken(token.trim());
        } catch (_) {
            return false;
        }
        return true;
    };
    sumProofsValue = (proofs: any) => {
        return proofs.reduce((r: number, c: any) => {
            return r + c.amount;
        }, 0);
    };
    decodeCashuToken = (token: string) => getDecodedToken(token.trim());

    isTokenP2PKLocked = (token: Token) => {
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
