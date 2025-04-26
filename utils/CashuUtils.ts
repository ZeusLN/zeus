import { getDecodedToken } from '@cashu/cashu-ts';

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
}

const cashuUtils = new CashuUtils();
export default cashuUtils;
