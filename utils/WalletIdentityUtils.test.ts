import { isSameWallet, resolveWalletIndex } from './WalletIdentityUtils';

const HOME: any = {
    implementation: 'lnd',
    nickname: 'Home',
    host: 'https://home.example.com',
    port: '8080',
    macaroonHex: 'aa'
};
const WORK: any = { ...HOME, nickname: 'Work', host: 'https://work.example' };
const SPENDING: any = {
    implementation: 'ldk-node',
    nickname: 'Spending',
    ldkNodeDir: 'dir-1',
    ldkMnemonic: 'one'
};
const SAVINGS: any = {
    implementation: 'ldk-node',
    nickname: 'Savings',
    ldkNodeDir: 'dir-2',
    ldkMnemonic: 'two'
};

describe('WalletIdentityUtils', () => {
    describe('isSameWallet', () => {
        it('matches a config with itself and with a copy', () => {
            expect(isSameWallet(HOME, HOME)).toBe(true);
            expect(isSameWallet(HOME, { ...HOME })).toBe(true);
        });

        it('tells different wallets apart', () => {
            expect(isSameWallet(HOME, WORK)).toBe(false);
            expect(isSameWallet(SPENDING, SAVINGS)).toBe(false);
            expect(
                isSameWallet(SPENDING, { ...SPENDING, ldkNodeDir: 'x' })
            ).toBe(false);
            expect(isSameWallet(HOME, { ...HOME, macaroonHex: 'bb' })).toBe(
                false
            );
        });

        it('treats missing, null and empty fields alike', () => {
            expect(isSameWallet({ ...HOME, rune: undefined }, HOME)).toBe(true);
            expect(isSameWallet({ ...HOME, rune: null }, HOME)).toBe(true);
            expect(isSameWallet({ ...HOME, rune: '' }, HOME)).toBe(true);
        });

        it('ignores fields the per-wallet settings screens change', () => {
            expect(
                isSameWallet(SPENDING, {
                    ...SPENDING,
                    ldkEsploraServer: 'https://esplora.example',
                    ldkRgsServer: 'https://rgs.example',
                    ldkScorerUrl: 'https://scorer.example',
                    ldkVssServer: 'https://vss.example',
                    dismissCustodialWarning: true,
                    photo: 'photo.png'
                })
            ).toBe(true);
        });

        it('matches nothing when either side is missing', () => {
            expect(isSameWallet(undefined, HOME)).toBe(false);
            expect(isSameWallet(HOME, null)).toBe(false);
            expect(isSameWallet(undefined, undefined)).toBe(false);
        });
    });

    describe('resolveWalletIndex', () => {
        it('keeps the given index while it holds the wallet', () => {
            expect(resolveWalletIndex([HOME, WORK], WORK, 1)).toBe(1);
        });

        it('finds a wallet that moved', () => {
            expect(resolveWalletIndex([WORK, HOME], HOME, 0)).toBe(1);
            expect(resolveWalletIndex([WORK, HOME], HOME)).toBe(1);
        });

        it('returns -1 when the wallet is no longer stored', () => {
            // Spending was deleted and Savings moved into its index
            expect(resolveWalletIndex([SAVINGS], SPENDING, 0)).toBe(-1);
            expect(resolveWalletIndex([], SPENDING, 0)).toBe(-1);
            expect(resolveWalletIndex(undefined, SPENDING, 0)).toBe(-1);
        });

        it('returns -1 when several configs match and the index does not', () => {
            expect(resolveWalletIndex([HOME, HOME, WORK], HOME, 2)).toBe(-1);
        });

        it('uses the index among identical configs', () => {
            expect(resolveWalletIndex([HOME, HOME], HOME, 1)).toBe(1);
        });
    });
});
