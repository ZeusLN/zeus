// @ts-ignore:next-line
import b58 from 'bs58check';
import {
    CryptoHDKey,
    DataItem,
    decodeToDataItem,
    patchTags
} from '@keystonehq/bc-ur-registry';

import { walletrpc } from '../proto/lightning';

// CBOR tags from BCR-2020-010 (output descriptors) and BCR-2020-007 (hdkey)
const TAG_SCRIPT_HASH = 400;
const TAG_WITNESS_PUBLIC_KEY_HASH = 404;
const TAG_TAPROOT = 409;
const TAG_CRYPTO_HDKEY = 303;

// bc-ur-registry 0.8.0 does not register the taproot tag, so its CBOR
// decoder would drop it and a tr() descriptor would look like a bare key
patchTags([TAG_TAPROOT]);

// BCR-2020-007 network values in crypto-coin-info
const NETWORK_TESTNET = 1;

type SupportedScript = 'wpkh' | 'sh-wpkh' | 'tr';

// Order of preference when an account carries several descriptors
const SCRIPT_PREFERENCE: SupportedScript[] = ['wpkh', 'sh-wpkh', 'tr'];

// SLIP-0132 version bytes. Taproot has no version of its own, so it uses
// xpub / tpub and relies on the address type passed to LND.
const VERSIONS: {
    [script in SupportedScript]: { mainnet: string; testnet: string };
} = {
    wpkh: { mainnet: '04b24746', testnet: '045f1cf6' }, // zpub / vpub
    'sh-wpkh': { mainnet: '049d7cb2', testnet: '044a5262' }, // ypub / upub
    tr: { mainnet: '0488b21e', testnet: '043587cf' } // xpub / tpub
};

const ADDRESS_TYPES: { [script in SupportedScript]: number } = {
    wpkh: walletrpc.AddressType.WITNESS_PUBKEY_HASH,
    'sh-wpkh': walletrpc.AddressType.NESTED_WITNESS_PUBKEY_HASH,
    tr: walletrpc.AddressType.TAPROOT_PUBKEY
};

export interface CryptoAccountExport {
    MasterFingerprint: string;
    ExtPubKey: string;
    AddressType: number;
}

const scriptForTags = (tags: number[]): SupportedScript | undefined => {
    const key = tags.join(',');
    if (key === `${TAG_WITNESS_PUBLIC_KEY_HASH}`) return 'wpkh';
    if (key === `${TAG_SCRIPT_HASH},${TAG_WITNESS_PUBLIC_KEY_HASH}`)
        return 'sh-wpkh';
    if (key === `${TAG_TAPROOT}`) return 'tr';
    return undefined;
};

// Unwraps the script expression tags of one output descriptor. Returns the
// script type and the HD key data item, or undefined when the descriptor is
// not a single-key wpkh, sh(wpkh) or tr output.
const parseDescriptor = (
    item: DataItem
): { script: SupportedScript; hdKeyItem: DataItem } | undefined => {
    const tags: number[] = [];
    let current: any = item;
    while (
        current instanceof DataItem &&
        current.getTag() !== undefined &&
        current.getTag() !== TAG_CRYPTO_HDKEY
    ) {
        tags.push(current.getTag());
        current = current.getData();
    }
    if (!(current instanceof DataItem)) return undefined;
    if (current.getTag() !== TAG_CRYPTO_HDKEY) return undefined;

    const script = scriptForTags(tags);
    if (!script) return undefined;
    return { script, hdKeyItem: current };
};

const encodeExtendedKey = (hdKey: CryptoHDKey, version: string): string => {
    const origin = hdKey.getOrigin();
    const components = origin.getComponents();
    const depth =
        typeof origin.getDepth() === 'number'
            ? origin.getDepth()
            : components.length;
    const depthBuf = Buffer.alloc(1);
    depthBuf.writeUInt8(depth);

    const lastComponent = components[components.length - 1];
    const index = lastComponent.isHardened()
        ? lastComponent.getIndex() + 0x80000000
        : lastComponent.getIndex();
    const indexBuf = Buffer.alloc(4);
    indexBuf.writeUInt32BE(index);

    return b58.encode(
        Buffer.concat([
            Buffer.from(version, 'hex'),
            depthBuf,
            hdKey.getParentFingerprint(),
            indexBuf,
            hdKey.getChainCode(),
            hdKey.getKey()
        ])
    );
};

// Converts a BC-UR crypto-account CBOR payload into the
// {MasterFingerprint, ExtPubKey, AddressType} export used by ImportAccount.
// Picks the first supported single-sig descriptor in the order wpkh,
// sh(wpkh), tr, and encodes the key with the version bytes for that script
// and for the key's network. Returns undefined if the account has no
// supported descriptor (e.g. only pkh, wsh or multisig outputs). Throws on
// malformed input.
export const cryptoAccountToWalletExport = (
    cborPayload: Buffer
): CryptoAccountExport | undefined => {
    const map = decodeToDataItem(cborPayload).getData();
    const masterFingerprint: number = map[1];
    const outputDescriptors: DataItem[] = map[2];
    if (!Array.isArray(outputDescriptors)) {
        throw new Error('crypto-account has no output descriptors');
    }

    const parsed = outputDescriptors
        .map((item) => parseDescriptor(item))
        .filter((d) => d !== undefined) as Array<{
        script: SupportedScript;
        hdKeyItem: DataItem;
    }>;

    for (const script of SCRIPT_PREFERENCE) {
        const descriptor = parsed.find((d) => d.script === script);
        if (!descriptor) continue;

        const hdKey = CryptoHDKey.fromDataItem(descriptor.hdKeyItem);
        if (hdKey.isMaster() || hdKey.isPrivateKey()) return undefined;

        const isTestnet = hdKey.getUseInfo()?.getNetwork() === NETWORK_TESTNET;
        const version = isTestnet
            ? VERSIONS[script].testnet
            : VERSIONS[script].mainnet;

        const xfp = Buffer.alloc(4);
        xfp.writeUInt32BE(masterFingerprint || 0);

        return {
            MasterFingerprint: xfp.toString('hex').toUpperCase(),
            ExtPubKey: encodeExtendedKey(hdKey, version),
            AddressType: ADDRESS_TYPES[script]
        };
    }

    return undefined;
};
