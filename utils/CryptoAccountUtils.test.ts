import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import {
    CryptoAccount,
    CryptoCoinInfo,
    CryptoCoinInfoNetwork,
    CryptoCoinInfoType,
    CryptoECKey,
    CryptoHDKey,
    CryptoKeypath,
    CryptoOutput,
    MultiKey,
    PathComponent,
    ScriptExpressions
} from '@keystonehq/bc-ur-registry';
// not re-exported from the package index
import { ScriptExpression } from '@keystonehq/bc-ur-registry/dist/ScriptExpression';

import { cryptoAccountToWalletExport } from './CryptoAccountUtils';
import { walletrpc } from '../proto/lightning';

const MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const SEED = mnemonicToSeedSync(MNEMONIC);
const MASTER = HDKey.fromMasterSeed(SEED);
const XFP = Buffer.alloc(4);
XFP.writeUInt32BE(MASTER.fingerprint);

// ScriptExpressions in bc-ur-registry 0.8.0 has no taproot entry
const TAPROOT = new ScriptExpression(409, 'tr');

const VERSIONS = {
    xpub: 0x0488b21e,
    tpub: 0x043587cf,
    ypub: 0x049d7cb2,
    upub: 0x044a5262,
    zpub: 0x04b24746,
    vpub: 0x045f1cf6
};

// Encodes the account key at `path` with `version`, independently of the
// code under test
const expectedKey = (path: string, version: number) =>
    HDKey.fromMasterSeed(SEED, { public: version, private: 0 }).derive(path)
        .publicExtendedKey;

const accountHDKey = (
    purpose: number,
    coinType: number,
    network?: CryptoCoinInfoNetwork
) => {
    const key = MASTER.derive(`m/${purpose}'/${coinType}'/0'`);
    const parentFingerprint = Buffer.alloc(4);
    parentFingerprint.writeUInt32BE(key.parentFingerprint);
    return new CryptoHDKey({
        isMaster: false,
        key: Buffer.from(key.publicKey!),
        chainCode: Buffer.from(key.chainCode!),
        useInfo:
            network === undefined
                ? undefined
                : new CryptoCoinInfo(CryptoCoinInfoType.bitcoin, network),
        origin: new CryptoKeypath(
            [
                new PathComponent({ index: purpose, hardened: true }),
                new PathComponent({ index: coinType, hardened: true }),
                new PathComponent({ index: 0, hardened: true })
            ],
            XFP,
            3
        ),
        parentFingerprint
    });
};

const MAINNET = CryptoCoinInfoNetwork.mainnet;
const TESTNET = CryptoCoinInfoNetwork.testnet;

const pkh = () =>
    new CryptoOutput([ScriptExpressions.PUBLIC_KEY_HASH], accountHDKey(44, 0));
const shWpkh = (coinType = 0, network = MAINNET) =>
    new CryptoOutput(
        [
            ScriptExpressions.SCRIPT_HASH,
            ScriptExpressions.WITNESS_PUBLIC_KEY_HASH
        ],
        accountHDKey(49, coinType, network)
    );
const wpkh = (coinType = 0, network: CryptoCoinInfoNetwork | undefined) =>
    new CryptoOutput(
        [ScriptExpressions.WITNESS_PUBLIC_KEY_HASH],
        accountHDKey(84, coinType, network)
    );
const tr = (coinType = 0, network = MAINNET) =>
    new CryptoOutput([TAPROOT], accountHDKey(86, coinType, network));
const wshMulti = () =>
    new CryptoOutput(
        [
            ScriptExpressions.WITNESS_SCRIPT_HASH,
            ScriptExpressions.SORTED_MULTISIG
        ],
        new MultiKey(1, [accountHDKey(48, 0, MAINNET)])
    );

const accountCbor = (outputs: CryptoOutput[]) =>
    new CryptoAccount(XFP, outputs).toCBOR();

const XFP_HEX = XFP.toString('hex').toUpperCase();

describe('cryptoAccountToWalletExport', () => {
    it('encodes a mainnet wpkh account as a zpub with P2WPKH', () => {
        expect(
            cryptoAccountToWalletExport(accountCbor([wpkh(0, MAINNET)]))
        ).toEqual({
            MasterFingerprint: XFP_HEX,
            ExtPubKey: expectedKey("m/84'/0'/0'", VERSIONS.zpub),
            AddressType: walletrpc.AddressType.WITNESS_PUBKEY_HASH
        });
    });

    it('treats a key without use-info as mainnet', () => {
        expect(
            cryptoAccountToWalletExport(accountCbor([wpkh(0, undefined)]))
                ?.ExtPubKey
        ).toEqual(expectedKey("m/84'/0'/0'", VERSIONS.zpub));
    });

    it('encodes an sh(wpkh) account as a ypub with nested P2WPKH', () => {
        expect(cryptoAccountToWalletExport(accountCbor([shWpkh()]))).toEqual({
            MasterFingerprint: XFP_HEX,
            ExtPubKey: expectedKey("m/49'/0'/0'", VERSIONS.ypub),
            AddressType: walletrpc.AddressType.NESTED_WITNESS_PUBKEY_HASH
        });
    });

    it('encodes a tr account as an xpub with Taproot', () => {
        expect(cryptoAccountToWalletExport(accountCbor([tr()]))).toEqual({
            MasterFingerprint: XFP_HEX,
            ExtPubKey: expectedKey("m/86'/0'/0'", VERSIONS.xpub),
            AddressType: walletrpc.AddressType.TAPROOT_PUBKEY
        });
    });

    it('uses testnet version bytes for testnet keys', () => {
        expect(
            cryptoAccountToWalletExport(accountCbor([wpkh(1, TESTNET)]))
        ).toEqual({
            MasterFingerprint: XFP_HEX,
            ExtPubKey: expectedKey("m/84'/1'/0'", VERSIONS.vpub),
            AddressType: walletrpc.AddressType.WITNESS_PUBKEY_HASH
        });
        expect(
            cryptoAccountToWalletExport(accountCbor([shWpkh(1, TESTNET)]))
                ?.ExtPubKey
        ).toEqual(expectedKey("m/49'/1'/0'", VERSIONS.upub));
        expect(
            cryptoAccountToWalletExport(accountCbor([tr(1, TESTNET)]))
                ?.ExtPubKey
        ).toEqual(expectedKey("m/86'/1'/0'", VERSIONS.tpub));
    });

    it('prefers wpkh over the other descriptors regardless of order', () => {
        // pkh first, as multi-account signers commonly export it
        const result = cryptoAccountToWalletExport(
            accountCbor([pkh(), shWpkh(), tr(), wpkh(0, MAINNET)])
        );
        expect(result).toEqual({
            MasterFingerprint: XFP_HEX,
            ExtPubKey: expectedKey("m/84'/0'/0'", VERSIONS.zpub),
            AddressType: walletrpc.AddressType.WITNESS_PUBKEY_HASH
        });
    });

    it('prefers sh(wpkh) over tr when there is no wpkh descriptor', () => {
        expect(
            cryptoAccountToWalletExport(accountCbor([pkh(), tr(), shWpkh()]))
                ?.AddressType
        ).toEqual(walletrpc.AddressType.NESTED_WITNESS_PUBKEY_HASH);
    });

    it('returns undefined for a pkh-only account', () => {
        expect(cryptoAccountToWalletExport(accountCbor([pkh()]))).toBe(
            undefined
        );
    });

    it('returns undefined for a multisig-only account', () => {
        expect(cryptoAccountToWalletExport(accountCbor([wshMulti()]))).toBe(
            undefined
        );
    });

    it('returns undefined for an account with an EC key output', () => {
        const ecKey = new CryptoECKey({
            data: Buffer.from(MASTER.derive("m/84'/0'/0'").publicKey!)
        });
        expect(
            cryptoAccountToWalletExport(
                accountCbor([
                    new CryptoOutput(
                        [ScriptExpressions.WITNESS_PUBLIC_KEY_HASH],
                        ecKey
                    )
                ])
            )
        ).toBe(undefined);
    });

    it('returns undefined for an account with no descriptors', () => {
        expect(cryptoAccountToWalletExport(accountCbor([]))).toBe(undefined);
    });

    it('throws on a payload that is not a crypto-account', () => {
        expect(() =>
            cryptoAccountToWalletExport(Buffer.from('a10101', 'hex'))
        ).toThrow();
    });
});
