import {
    addRecoveryWallet,
    bindLegacyRecovery,
    clearRecoveryWallet,
    isRecoveryPending
} from './WalletRecoveryUtils';

describe('WalletRecoveryUtils', () => {
    describe('isRecoveryPending', () => {
        it('is false without the flag', () => {
            expect(isRecoveryPending({ recovery: false }, 'a')).toBe(false);
            expect(
                isRecoveryPending(
                    { recovery: false, recoveryWalletDirs: ['a'] },
                    'a'
                )
            ).toBe(false);
            expect(isRecoveryPending(undefined, 'a')).toBe(false);
        });

        it('is true only for the listed wallets', () => {
            const settings = { recovery: true, recoveryWalletDirs: ['a', 'b'] };
            expect(isRecoveryPending(settings, 'a')).toBe(true);
            expect(isRecoveryPending(settings, 'b')).toBe(true);
            expect(isRecoveryPending(settings, 'c')).toBe(false);
            expect(isRecoveryPending(settings, undefined)).toBe(false);
        });

        it('applies a flag without a list to every wallet', () => {
            expect(isRecoveryPending({ recovery: true }, 'a')).toBe(true);
        });
    });

    describe('addRecoveryWallet', () => {
        it('starts a list', () => {
            expect(addRecoveryWallet({ recovery: false }, 'a')).toEqual({
                recovery: true,
                recoveryWalletDirs: ['a']
            });
        });

        it('keeps earlier pending wallets', () => {
            expect(
                addRecoveryWallet(
                    { recovery: true, recoveryWalletDirs: ['a'] },
                    'b'
                )
            ).toEqual({ recovery: true, recoveryWalletDirs: ['a', 'b'] });
        });

        it('drops entries left while the flag was off', () => {
            expect(
                addRecoveryWallet(
                    { recovery: false, recoveryWalletDirs: ['a'] },
                    'b'
                )
            ).toEqual({ recovery: true, recoveryWalletDirs: ['b'] });
        });

        it('does not list a wallet twice', () => {
            expect(
                addRecoveryWallet(
                    { recovery: true, recoveryWalletDirs: ['a'] },
                    'a'
                )
            ).toEqual({ recovery: true, recoveryWalletDirs: ['a'] });
        });
    });

    describe('clearRecoveryWallet', () => {
        it('removes only the given wallet', () => {
            expect(
                clearRecoveryWallet(
                    { recovery: true, recoveryWalletDirs: ['a', 'b'] },
                    'a'
                )
            ).toEqual({ recovery: true, recoveryWalletDirs: ['b'] });
        });

        it('clears the flag and removes the list with the last wallet', () => {
            const update = clearRecoveryWallet(
                { recovery: true, recoveryWalletDirs: ['a'] },
                'a'
            );
            expect(update.recovery).toBe(false);
            expect('recoveryWalletDirs' in update).toBe(true);
            expect(update.recoveryWalletDirs).toBeUndefined();
        });

        it('clears a flag without a list', () => {
            const update = clearRecoveryWallet({ recovery: true }, 'a');
            expect(update.recovery).toBe(false);
            expect(update.recoveryWalletDirs).toBeUndefined();
        });
    });

    describe('bindLegacyRecovery', () => {
        it('binds a flag without a list to the wallet', () => {
            expect(bindLegacyRecovery({ recovery: true }, 'a')).toEqual({
                recovery: true,
                recoveryWalletDirs: ['a']
            });
        });

        it('leaves a flag that already has a list', () => {
            expect(
                bindLegacyRecovery(
                    { recovery: true, recoveryWalletDirs: [] },
                    'a'
                )
            ).toBeNull();
        });

        it('does nothing without the flag or a wallet directory', () => {
            expect(bindLegacyRecovery({ recovery: false }, 'a')).toBeNull();
            expect(
                bindLegacyRecovery({ recovery: true }, undefined)
            ).toBeNull();
        });
    });
});
