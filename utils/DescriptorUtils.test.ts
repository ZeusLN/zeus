// @ts-ignore:next-line
import b58 from 'bs58check';

import {
    normalizeExtendedKey,
    recoverMasterFingerprintHex,
    resolveAddressType,
    buildWatchonlyDescriptors,
    WalletAddressType
} from './DescriptorUtils';
import Base64Utils from './Base64Utils';

// Golden vector shared with the ldk-node Rust watch-only tests:
// fingerprint 2de67592, testnet BIP84 account.
const TPUB =
    'tpubDCUJWjpCfXoCzDwWiHRwsALSWYSMXvHHzQ3q4CoiVgWAHcrvL2C89PUs1wC2QddbaDEvLNaL5PFVFdYm5oBf7DXZWoFK8X4PLXAUA8L9zsV';
const MFP = '2de67592';

// zpub/xpub pair (same key material) from the Passport keystore export fixture
// already used in AddressUtils.test.ts.
const ZPUB =
    'zpub6rPHMjrf6SMGmAbYo2n1BjoHfZTGYcnrBchwYpCaC5hrMZJVdkyappjQkW1Gu3napr3BCvYCpwbPRaex52RdFXv2YFtTtUBu6xYYscVK2n9';

describe('DescriptorUtils', () => {
    describe('buildWatchonlyDescriptors', () => {
        it('matches the ldk-node golden descriptor (native segwit, testnet)', () => {
            const { external, internal, derivationPath } =
                buildWatchonlyDescriptors({
                    xpub: TPUB,
                    mfpHex: MFP,
                    addressType: WalletAddressType.WITNESS_PUBKEY_HASH,
                    network: 'testnet'
                });
            expect(external).toEqual(`wpkh([2de67592/84'/1'/0']${TPUB}/0/*)`);
            expect(internal).toEqual(`wpkh([2de67592/84'/1'/0']${TPUB}/1/*)`);
            expect(derivationPath).toEqual("m/84'/1'/0'");
        });

        it('wraps nested segwit as sh(wpkh(...)) at purpose 49', () => {
            const { external, derivationPath } = buildWatchonlyDescriptors({
                xpub: TPUB,
                mfpHex: MFP,
                addressType: WalletAddressType.NESTED_WITNESS_PUBKEY_HASH,
                network: 'testnet'
            });
            expect(external).toEqual(
                `sh(wpkh([2de67592/49'/1'/0']${TPUB}/0/*))`
            );
            expect(derivationPath).toEqual("m/49'/1'/0'");
        });

        it('wraps taproot as tr(...) at purpose 86', () => {
            const { external } = buildWatchonlyDescriptors({
                xpub: TPUB,
                mfpHex: MFP,
                addressType: WalletAddressType.TAPROOT_PUBKEY,
                network: 'testnet'
            });
            expect(external).toEqual(`tr([2de67592/86'/1'/0']${TPUB}/0/*)`);
        });

        it("uses coin 0' on mainnet", () => {
            const { derivationPath } = buildWatchonlyDescriptors({
                xpub: TPUB,
                mfpHex: MFP,
                addressType: WalletAddressType.WITNESS_PUBKEY_HASH,
                network: 'mainnet'
            });
            expect(derivationPath).toEqual("m/84'/0'/0'");
        });

        it('omits the key origin when no fingerprint is given', () => {
            const { external } = buildWatchonlyDescriptors({
                xpub: TPUB,
                addressType: WalletAddressType.WITNESS_PUBKEY_HASH,
                network: 'testnet'
            });
            expect(external).toEqual(`wpkh(${TPUB}/0/*)`);
        });

        it('lowercases an uppercase fingerprint', () => {
            const { external } = buildWatchonlyDescriptors({
                xpub: TPUB,
                mfpHex: '2DE67592',
                addressType: WalletAddressType.WITNESS_PUBKEY_HASH,
                network: 'testnet'
            });
            expect(external).toEqual(`wpkh([2de67592/84'/1'/0']${TPUB}/0/*)`);
        });

        it('rejects UNKNOWN address type', () => {
            expect(() =>
                buildWatchonlyDescriptors({
                    xpub: TPUB,
                    addressType: WalletAddressType.UNKNOWN,
                    network: 'testnet'
                })
            ).toThrow();
        });

        it('rejects HYBRID_NESTED address type', () => {
            expect(() =>
                buildWatchonlyDescriptors({
                    xpub: TPUB,
                    addressType:
                        WalletAddressType.HYBRID_NESTED_WITNESS_PUBKEY_HASH,
                    network: 'testnet'
                })
            ).toThrow();
        });
    });

    describe('normalizeExtendedKey', () => {
        it('passes through a plain tpub unchanged', () => {
            expect(normalizeExtendedKey(TPUB, 'testnet')).toEqual(TPUB);
        });

        it('accepts a tpub on signet and regtest (testnet family)', () => {
            expect(normalizeExtendedKey(TPUB, 'signet')).toEqual(TPUB);
            expect(normalizeExtendedKey(TPUB, 'regtest')).toEqual(TPUB);
        });

        it('converts a zpub to an xpub with identical key material', () => {
            const result = normalizeExtendedKey(ZPUB, 'mainnet');
            expect(result.startsWith('xpub')).toBe(true);
            // everything after the 4-byte version prefix is unchanged
            expect(Buffer.from(b58.decode(result)).subarray(4)).toEqual(
                Buffer.from(b58.decode(ZPUB)).subarray(4)
            );
        });

        it('rejects a testnet key on mainnet', () => {
            expect(() => normalizeExtendedKey(TPUB, 'mainnet')).toThrow();
        });

        it('rejects a mainnet key on a non-mainnet network', () => {
            expect(() => normalizeExtendedKey(ZPUB, 'testnet')).toThrow();
        });

        it('throws on non-base58check input', () => {
            expect(() =>
                normalizeExtendedKey('not-a-key', 'testnet')
            ).toThrow();
        });
    });

    describe('resolveAddressType', () => {
        it('uses the explicit type for a plain xpub/tpub', () => {
            expect(
                resolveAddressType(
                    TPUB,
                    WalletAddressType.NESTED_WITNESS_PUBKEY_HASH
                )
            ).toEqual(WalletAddressType.NESTED_WITNESS_PUBKEY_HASH);
        });

        it('infers native segwit from a zpub when no type is given', () => {
            expect(resolveAddressType(ZPUB)).toEqual(
                WalletAddressType.WITNESS_PUBKEY_HASH
            );
        });

        it('accepts an explicit type that matches the prefix', () => {
            expect(
                resolveAddressType(ZPUB, WalletAddressType.WITNESS_PUBKEY_HASH)
            ).toEqual(WalletAddressType.WITNESS_PUBKEY_HASH);
        });

        it('rejects an explicit type that contradicts the prefix', () => {
            expect(() =>
                resolveAddressType(
                    ZPUB,
                    WalletAddressType.NESTED_WITNESS_PUBKEY_HASH
                )
            ).toThrow();
        });

        it('treats UNKNOWN (0) as not provided', () => {
            expect(resolveAddressType(ZPUB, WalletAddressType.UNKNOWN)).toEqual(
                WalletAddressType.WITNESS_PUBKEY_HASH
            );
        });

        it('requires a type for a plain xpub/tpub', () => {
            expect(() => resolveAddressType(TPUB)).toThrow();
        });
    });

    describe('recoverMasterFingerprintHex', () => {
        it('inverts the import request encoding', () => {
            // ImportAccount sends hexToBase64(reverseMfpBytes(hex)).
            const encoded = Base64Utils.hexToBase64(
                Base64Utils.reverseMfpBytes(MFP)
            );
            expect(recoverMasterFingerprintHex(encoded)).toEqual(MFP);
        });
    });
});
