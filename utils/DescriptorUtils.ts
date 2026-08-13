// @ts-ignore:next-line
import b58 from 'bs58check';

import Base64Utils from './Base64Utils';

/**
 * Turns the { extended_public_key, master_key_fingerprint, address_type } that
 * ZEUS's account-import UI produces into the output descriptors the ldk-node
 * watch-only FFI expects.
 *
 * The LND family accepts the raw xpub + address type and builds the descriptor
 * server-side; the ldk-node FFI does not, so that conversion happens here.
 */

// BIP32 / SLIP-132 extended-key version bytes (4-byte big-endian, hex). The
// version prefix encodes BOTH the network and the intended script type.
const VERSION_XPUB = '0488b21e'; // mainnet, legacy / unspecified
const VERSION_YPUB = '049d7cb2'; // mainnet, BIP49 nested segwit
const VERSION_ZPUB = '04b24746'; // mainnet, BIP84 native segwit
const VERSION_TPUB = '043587cf'; // testnet, legacy / unspecified
const VERSION_UPUB = '044a5262'; // testnet, BIP49 nested segwit
const VERSION_VPUB = '045f1cf6'; // testnet, BIP84 native segwit

const MAINNET_VERSIONS = [VERSION_XPUB, VERSION_YPUB, VERSION_ZPUB];
const TESTNET_VERSIONS = [VERSION_TPUB, VERSION_UPUB, VERSION_VPUB];

// walletrpc.AddressType (see proto/walletrpc/walletkit.proto). ZEUS's import UI
// sends these numeric values.
export enum WalletAddressType {
    UNKNOWN = 0,
    WITNESS_PUBKEY_HASH = 1, // native segwit  → BIP84 → wpkh
    NESTED_WITNESS_PUBKEY_HASH = 2, // nested segwit → BIP49 → sh(wpkh)
    HYBRID_NESTED_WITNESS_PUBKEY_HASH = 3, // unsupported for watch-only import
    TAPROOT_PUBKEY = 4 // taproot → BIP86 → tr
}

const isMainnet = (network: string): boolean =>
    network === 'mainnet' || network === 'bitcoin';

/**
 * Normalize an extended public key to the plain BIP32 form BDK requires. A
 * SLIP-132 key (zpub/ypub/vpub/upub) is re-encoded to xpub/tpub by swapping its
 * version bytes — the underlying key material is identical, only the 4-byte
 * prefix differs. Also validates the key's network against the node's.
 */
export const normalizeExtendedKey = (key: string, network: string): string => {
    let decoded: Buffer;
    try {
        decoded = Buffer.from(b58.decode(key));
    } catch (e) {
        throw new Error('Invalid extended public key: not valid base58check.');
    }

    const version = decoded.slice(0, 4).toString('hex');
    const payload = decoded.slice(4);

    let targetVersion: string;
    if (MAINNET_VERSIONS.includes(version)) {
        if (!isMainnet(network)) {
            throw new Error(
                'Mainnet extended key provided for a non-mainnet network.'
            );
        }
        targetVersion = VERSION_XPUB;
    } else if (TESTNET_VERSIONS.includes(version)) {
        if (isMainnet(network)) {
            throw new Error(
                'Testnet extended key provided for the mainnet network.'
            );
        }
        targetVersion = VERSION_TPUB;
    } else {
        throw new Error(
            'Unrecognized extended key version (unsupported script type or multisig).'
        );
    }

    return b58.encode(
        Buffer.concat([Buffer.from(targetVersion, 'hex'), payload])
    );
};

/**
 * Recover the natural (big-endian) master-key-fingerprint hex from the base64
 * form carried in the import request. ImportAccount stores
 * hexToBase64(reverseMfpBytes(hex)); we invert both steps.
 */
export const recoverMasterFingerprintHex = (
    masterKeyFingerprintBase64: string
): string =>
    Base64Utils.reverseMfpBytes(
        Base64Utils.base64ToHex(masterKeyFingerprintBase64)
    );

// Script type implied by a SLIP-132 version prefix. Plain xpub/tpub imply
// nothing and are absent here.
const IMPLIED_ADDRESS_TYPE: { [version: string]: WalletAddressType } = {
    [VERSION_ZPUB]: WalletAddressType.WITNESS_PUBKEY_HASH,
    [VERSION_VPUB]: WalletAddressType.WITNESS_PUBKEY_HASH,
    [VERSION_YPUB]: WalletAddressType.NESTED_WITNESS_PUBKEY_HASH,
    [VERSION_UPUB]: WalletAddressType.NESTED_WITNESS_PUBKEY_HASH
};

/**
 * Decide the address type for an import request. An explicitly selected type
 * wins, but a SLIP-132 key whose prefix contradicts it is rejected rather than
 * silently deriving addresses the key was never used for. A plain xpub/tpub
 * carries no script-type hint, so the explicit type is required there.
 *
 * @param key          extended public key as provided (pre-normalization)
 * @param explicitType walletrpc.AddressType from the import UI; UNKNOWN (0) is
 *                     treated as not provided
 */
export const resolveAddressType = (
    key: string,
    explicitType?: number
): number => {
    let implied: WalletAddressType | undefined;
    try {
        // .slice(), not .subarray() — see normalizeExtendedKey above.
        const version = Buffer.from(b58.decode(key))
            .slice(0, 4)
            .toString('hex');
        implied = IMPLIED_ADDRESS_TYPE[version];
    } catch (e) {
        // invalid keys are rejected by normalizeExtendedKey
    }

    const explicit = explicitType || undefined; // UNKNOWN = 0 → undefined

    if (explicit !== undefined) {
        if (implied !== undefined && implied !== explicit) {
            throw new Error(
                'Selected address type contradicts the extended key prefix ' +
                    '(e.g. a zpub is a native segwit key).'
            );
        }
        return explicit;
    }
    if (implied !== undefined) return implied;
    throw new Error(
        'Address type is required to import a plain xpub/tpub key.'
    );
};

interface AddressTypeConfig {
    purpose: string;
    wrap: (inner: string) => string;
}

const ADDRESS_TYPE_CONFIG: { [key: number]: AddressTypeConfig } = {
    [WalletAddressType.WITNESS_PUBKEY_HASH]: {
        purpose: "84'",
        wrap: (inner) => `wpkh(${inner})`
    },
    [WalletAddressType.NESTED_WITNESS_PUBKEY_HASH]: {
        purpose: "49'",
        wrap: (inner) => `sh(wpkh(${inner}))`
    },
    [WalletAddressType.TAPROOT_PUBKEY]: {
        purpose: "86'",
        wrap: (inner) => `tr(${inner})`
    }
};

export interface WatchonlyDescriptors {
    external: string;
    internal: string;
    derivationPath: string;
}

/**
 * Build the external (receive, /0/*) and internal (change, /1/*) output
 * descriptors for a single-sig watch-only account. Output format matches the
 * descriptors the ldk-node watch-only wallet is tested against, e.g.
 * `wpkh([2de67592/84'/1'/0']tpub.../0/*)` — no checksum (BDK computes it).
 *
 * The account index is assumed to be 0' (as the LND import does); the xpub
 * alone does not carry it. This only affects the key-origin metadata used for
 * hardware signing, not address derivation.
 *
 * @param xpub        normalized xpub/tpub (see normalizeExtendedKey)
 * @param mfpHex      natural-order master fingerprint hex (see
 *                    recoverMasterFingerprintHex); omit to build descriptors
 *                    without a key origin
 * @param addressType walletrpc.AddressType numeric value
 * @param network     node network
 */
export const buildWatchonlyDescriptors = ({
    xpub,
    mfpHex,
    addressType,
    network
}: {
    xpub: string;
    mfpHex?: string;
    addressType: number;
    network: string;
}): WatchonlyDescriptors => {
    const config = ADDRESS_TYPE_CONFIG[addressType];
    if (!config) {
        throw new Error(
            `Unsupported address type for watch-only import: ${addressType}. ` +
                'Only native segwit, nested segwit, and taproot are supported.'
        );
    }

    const coin = isMainnet(network) ? "0'" : "1'";
    const account = "0'";
    const path = `${config.purpose}/${coin}/${account}`;
    const origin = mfpHex ? `[${mfpHex.toLowerCase()}/${path}]` : '';

    return {
        external: config.wrap(`${origin}${xpub}/0/*`),
        internal: config.wrap(`${origin}${xpub}/1/*`),
        derivationPath: `m/${path}`
    };
};
