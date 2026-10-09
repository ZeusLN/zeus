import BigNumber from 'bignumber.js';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { saveDocuments } from '@react-native-documents/picker';
import { validateMnemonic } from '@scure/bip39';
import ecc from '@bitcoinerlab/secp256k1';
import {
    address as bitcoinAddress,
    crypto,
    initEccLib,
    opcodes,
    payments,
    script as bitcoinScript
} from 'bitcoinjs-lib';

import { BIP39_WORD_LIST } from './Bip39Utils';

import Bolt11Utils from './Bolt11Utils';

export const bigCeil = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_CEIL);
};

/**
 * Verifies a reverse-swap invoice returned by the swap host before it is
 * paid. In a reverse swap ZEUS chooses the preimage and sends only its
 * hash to the host; the host must return a hold invoice whose payment
 * hash equals that hash, for the requested amount. A malicious or
 * compromised host (custom hosts are supported) could otherwise return an
 * invoice paying itself with an unrelated payment hash: the user pays it,
 * the on-chain lockup that ZEUS can claim is never bound to that payment,
 * and the lightning funds are lost. Returns { valid: false, reason } on
 * any mismatch so the caller can abort before paying.
 */
export const verifyReverseSwapInvoice = (
    invoice: string,
    expectedPaymentHash: string,
    expectedAmountSats: number
): { valid: boolean; reason?: string } => {
    let decoded;
    try {
        decoded = Bolt11Utils.decode(invoice);
    } catch (e) {
        return { valid: false, reason: 'undecodable' };
    }

    const paymentHash = (decoded.payment_hash || '').toLowerCase();
    if (!paymentHash) {
        return { valid: false, reason: 'missing-payment-hash' };
    }
    if (paymentHash !== expectedPaymentHash.toLowerCase()) {
        return { valid: false, reason: 'payment-hash-mismatch' };
    }

    const invoiceSats = new BigNumber(decoded.num_satoshis || 0);
    if (!invoiceSats.isEqualTo(expectedAmountSats)) {
        return { valid: false, reason: 'amount-mismatch' };
    }

    return { valid: true };
};

const SECP256K1_ORDER = new BigNumber(
    'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
    16
);
const TAPSCRIPT_LEAF_VERSION = 0xc0;

// Always returns a Buffer. In the app, the buffer polyfill's subarray
// returns a plain Uint8Array, which bitcoinjs script.compile does not
// treat as data: it compiles the key as OP_0 and every leaf check fails.
const toXOnly = (pubkey: Uint8Array): Buffer =>
    Buffer.from(pubkey.length === 32 ? pubkey : pubkey.subarray(1, 33));

/**
 * BIP 327 KeyAgg over 33-byte compressed public keys, in the order given
 * (no sorting). Returns the x-only aggregate key. Boltz aggregates
 * [serverKey, ourKey] in that order for the taproot internal key.
 */
export const aggregateMusigKeys = (pubkeys: Buffer[]): Buffer => {
    const keyList = crypto.taggedHash('KeyAgg list', Buffer.concat(pubkeys));
    const secondKey = pubkeys.find((pubkey) => !pubkey.equals(pubkeys[0]));

    let aggregate: Uint8Array | null = null;
    for (const pubkey of pubkeys) {
        const coefficient =
            secondKey && pubkey.equals(secondKey)
                ? new BigNumber(1)
                : new BigNumber(
                      crypto
                          .taggedHash(
                              'KeyAgg coefficient',
                              Buffer.concat([keyList, pubkey])
                          )
                          .toString('hex'),
                      16
                  ).mod(SECP256K1_ORDER);
        const tweak = Buffer.from(
            coefficient.toString(16).padStart(64, '0'),
            'hex'
        );
        const term = ecc.pointMultiply(pubkey, tweak, true);
        if (!term) throw new Error('KeyAgg: invalid public key');
        aggregate = aggregate ? ecc.pointAdd(aggregate, term, true) : term;
        if (!aggregate) throw new Error('KeyAgg: point at infinity');
    }
    return toXOnly(Buffer.from(aggregate!));
};

/**
 * The two tapscript leaves of a Boltz reverse swap, as boltz-client's
 * SwapTree.Check expects them. The claim leaf pays our key against the
 * preimage, the refund leaf pays the server's key after the timeout.
 */
export const buildReverseSwapLeaves = ({
    claimPubKey,
    refundPubKey,
    preimageHash,
    timeoutBlockHeight
}: {
    claimPubKey: Buffer;
    refundPubKey: Buffer;
    preimageHash: Buffer;
    timeoutBlockHeight: number;
}): { claimLeaf: Buffer; refundLeaf: Buffer } => ({
    claimLeaf: bitcoinScript.compile([
        opcodes.OP_SIZE,
        bitcoinScript.number.encode(32),
        opcodes.OP_EQUALVERIFY,
        opcodes.OP_HASH160,
        crypto.ripemd160(preimageHash),
        opcodes.OP_EQUALVERIFY,
        toXOnly(claimPubKey),
        opcodes.OP_CHECKSIG
    ]),
    refundLeaf: bitcoinScript.compile([
        toXOnly(refundPubKey),
        opcodes.OP_CHECKSIGVERIFY,
        bitcoinScript.number.encode(timeoutBlockHeight),
        opcodes.OP_CHECKLOCKTIMEVERIFY
    ])
});

/**
 * The taproot output key of a reverse swap lockup: the MuSig2 aggregate of
 * [serverKey, ourKey] tweaked with the two-leaf script tree.
 */
export const deriveReverseSwapOutputKey = ({
    ourPubKey,
    serverPubKey,
    claimLeaf,
    refundLeaf
}: {
    ourPubKey: Buffer;
    serverPubKey: Buffer;
    claimLeaf: Buffer;
    refundLeaf: Buffer;
}): Buffer => {
    initEccLib(ecc);
    const { pubkey } = payments.p2tr({
        internalPubkey: aggregateMusigKeys([serverPubKey, ourPubKey]),
        scriptTree: [
            { output: claimLeaf, version: TAPSCRIPT_LEAF_VERSION },
            { output: refundLeaf, version: TAPSCRIPT_LEAF_VERSION }
        ]
    });
    return Buffer.from(pubkey!);
};

// CLTV values below this threshold are block heights, not timestamps.
const LOCKTIME_THRESHOLD = 500000000;
// Leave time for a unilateral claim if the provider refuses to co-sign.
export const MIN_REVERSE_SWAP_CLAIM_BLOCKS = 6;

// A rescued reverse swap is claimed without asking only if the lockup is at
// least this share of the wallet's own payment for it. Real swap fees are
// well under this; a larger shortfall goes to the user to confirm.
export const RESCUED_SWAP_MIN_LOCKUP_PERCENT = 90;

/**
 * The smallest lockup to claim without asking for a rescued reverse swap,
 * given the amount in sats this wallet paid for it. A rescued swap's
 * on-chain amount only comes from the host, so the floor comes from the
 * user's own payment instead. Proportional, so a small payment can't be
 * all but wiped out by a fixed allowance.
 */
export const rescuedLockupFloor = (paidSats: number): number =>
    bigCeil(
        new BigNumber(paidSats).times(RESCUED_SWAP_MIN_LOCKUP_PERCENT).div(100)
    ).toNumber();

const refundHeightFor = (
    refundLeaf: Buffer,
    serverPubKey: Buffer,
    timeoutBlockHeight?: number
): number | undefined => {
    // Rescued swaps omit the timeout field. Read the actual CLTV operand
    // from the committed script, rather than trusting optional metadata.
    const chunks = bitcoinScript.decompile(refundLeaf);
    if (
        !chunks ||
        chunks.length !== 4 ||
        !Buffer.isBuffer(chunks[0]) ||
        !chunks[0].equals(toXOnly(serverPubKey)) ||
        chunks[1] !== opcodes.OP_CHECKSIGVERIFY ||
        chunks[3] !== opcodes.OP_CHECKLOCKTIMEVERIFY
    )
        return undefined;

    let height: number;
    try {
        const operand = chunks[2];
        height = Buffer.isBuffer(operand)
            ? bitcoinScript.number.decode(operand, 5, true)
            : operand >= opcodes.OP_1 && operand <= opcodes.OP_16
            ? operand - opcodes.OP_1 + 1
            : 0;
    } catch {
        return undefined;
    }
    if (
        !Number.isSafeInteger(height) ||
        height <= 0 ||
        height >= LOCKTIME_THRESHOLD ||
        (timeoutBlockHeight != null && timeoutBlockHeight !== height)
    )
        return undefined;

    const expected = buildReverseSwapLeaves({
        claimPubKey: serverPubKey,
        refundPubKey: serverPubKey,
        preimageHash: Buffer.alloc(32),
        timeoutBlockHeight: height
    }).refundLeaf;
    return refundLeaf.equals(expected) ? height : undefined;
};

export type ReverseSwapResponseCheck =
    | { valid: true; outputScript: Buffer; timeoutBlockHeight: number }
    | {
          valid: false;
          reason:
              | 'missing-fields'
              | 'server-key-encoding'
              | 'leaf-version'
              | 'claim-leaf-mismatch'
              | 'refund-leaf-mismatch'
              | 'lockup-address-mismatch'
              | 'onchain-amount-low';
      };

/**
 * Verifies the provider's reverse swap details against what ZEUS chose:
 * the claim leaf must pay our key against our preimage hash, the refund
 * leaf must pay the server key, and the lockup address must be the
 * taproot output of exactly that tree. When minOnchainAmount is given,
 * the provider must also lock up more than that (the amount the Swaps
 * screen showed the user they would receive).
 *
 * Without this a provider can hand out a lockup address it controls, or
 * a tree we can't claim from, and still get the preimage when we claim.
 * Returns the lockup output script so the caller can match it on chain.
 */
export const verifyReverseSwapResponse = ({
    swapTree,
    lockupAddress,
    serverPubKey,
    timeoutBlockHeight,
    onchainAmount,
    ourPubKey,
    preimageHash,
    minOnchainAmount
}: {
    swapTree?: {
        claimLeaf?: { output?: string; version?: number };
        refundLeaf?: { output?: string; version?: number };
    };
    lockupAddress?: string;
    serverPubKey?: string;
    timeoutBlockHeight?: number;
    onchainAmount?: number;
    ourPubKey: Buffer;
    preimageHash: Buffer;
    minOnchainAmount?: number;
}): ReverseSwapResponseCheck => {
    const claimLeafHex = swapTree?.claimLeaf?.output;
    const refundLeafHex = swapTree?.refundLeaf?.output;
    if (!claimLeafHex || !refundLeafHex || !lockupAddress || !serverPubKey) {
        return { valid: false, reason: 'missing-fields' };
    }

    // the native claim assumes tapscript leaves when no version is given
    for (const leaf of [swapTree!.claimLeaf!, swapTree!.refundLeaf!]) {
        if (leaf.version != null && leaf.version !== TAPSCRIPT_LEAF_VERSION) {
            return { valid: false, reason: 'leaf-version' };
        }
    }

    let serverKey: Buffer;
    try {
        serverKey = Buffer.from(serverPubKey, 'hex');
        if (!ecc.isPoint(serverKey)) throw new Error('invalid server key');
    } catch (e) {
        return { valid: false, reason: 'missing-fields' };
    }
    // KeyAgg hashes the key bytes as given, while the native claim hashes
    // the compressed encoding. An uncompressed key would pass here against
    // a different output key than the one the claim signs for.
    if (
        serverKey.length !== 33 ||
        (serverKey[0] !== 0x02 && serverKey[0] !== 0x03)
    ) {
        return { valid: false, reason: 'server-key-encoding' };
    }

    const claimLeaf = Buffer.from(claimLeafHex, 'hex');
    const refundLeaf = Buffer.from(refundLeafHex, 'hex');
    const { claimLeaf: expectedClaimLeaf } = buildReverseSwapLeaves({
        claimPubKey: ourPubKey,
        refundPubKey: serverKey,
        preimageHash,
        timeoutBlockHeight: 0
    });
    if (!claimLeaf.equals(expectedClaimLeaf)) {
        return { valid: false, reason: 'claim-leaf-mismatch' };
    }
    const refundHeight = refundHeightFor(
        refundLeaf,
        serverKey,
        timeoutBlockHeight
    );
    if (refundHeight === undefined) {
        return { valid: false, reason: 'refund-leaf-mismatch' };
    }

    const outputKey = deriveReverseSwapOutputKey({
        ourPubKey,
        serverPubKey: serverKey,
        claimLeaf,
        refundLeaf
    });
    // compare the witness program, so this holds on every network
    let addressKey: Buffer | undefined;
    try {
        const decoded = bitcoinAddress.fromBech32(lockupAddress);
        if (decoded.version === 1) addressKey = Buffer.from(decoded.data);
    } catch (e) {
        addressKey = undefined;
    }
    if (!addressKey || !addressKey.equals(outputKey)) {
        return { valid: false, reason: 'lockup-address-mismatch' };
    }

    if (
        minOnchainAmount != null &&
        !(Number(onchainAmount) > minOnchainAmount)
    ) {
        return { valid: false, reason: 'onchain-amount-low' };
    }

    return {
        valid: true,
        outputScript: Buffer.concat([Buffer.from([0x51, 0x20]), outputKey]),
        timeoutBlockHeight: refundHeight
    };
};

export type LockupOutputStatus =
    | 'ok'
    | 'unconfirmed'
    | 'missing-output'
    | 'underfunded';

/**
 * Checks an Esplora /tx/:txid response for the swap's lockup output.
 * Checks the output the native claim will spend: boltz-client's FindVout
 * takes the first output whose script after the 2-byte version/length
 * prefix equals the witness program, whatever the witness version. That
 * output must be our exact taproot script and hold at least minAmount.
 * minAmount is skipped when the swap has no recorded amount (rescued
 * swaps).
 */
export const checkLockupOutput = (
    tx: {
        vout?: Array<{ scriptpubkey?: string; value?: number }>;
        status?: { confirmed?: boolean };
    },
    outputScript: Buffer,
    minAmount?: number
): LockupOutputStatus => {
    const scriptHex = outputScript.toString('hex');
    const programHex = scriptHex.slice(4);
    const claimed = (tx?.vout || []).find(
        (output) =>
            (output?.scriptpubkey || '').toLowerCase().slice(4) === programHex
    );
    if (!claimed || claimed.scriptpubkey!.toLowerCase() !== scriptHex) {
        return 'missing-output';
    }
    if (minAmount != null && (Number(claimed.value) || 0) < minAmount) {
        return 'underfunded';
    }
    if (!tx?.status?.confirmed) return 'unconfirmed';
    return 'ok';
};

/**
 * Derives a reverse swap's preimage from the rescue key's child private
 * key at that swap's key index.
 *
 * The preimage is never sent to or stored by the swap host (only
 * sha256(preimage), as the hold invoice's payment hash), so it exists
 * nowhere but this derivation. Deriving it deterministically from the
 * rescue key is what makes a reverse swap claimable after restoring that
 * key on another device.
 *
 * The creation path and the rescue path MUST derive it identically or the
 * rescued claim is unspendable and the host reclaims the lockup at
 * timeout, so both share this function rather than repeating the
 * expression.
 */
export const deriveSwapPreimage = (privateKey: Uint8Array): Buffer =>
    crypto.sha256(Buffer.from(privateKey));

export const bigFloor = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_FLOOR);
};

/**
 * Builds the swap-update WebSocket URL for a swap host. The scheme
 * rewrites are anchored to `^`: a bare string replace rewrites the first
 * match anywhere in the string, so a host whose own name contains `http`
 * had it rewritten instead of the scheme, sending swap updates to a
 * different — and attacker-registrable — host. Custom swap hosts are
 * user-supplied (settings.swaps.customHost), so that input is reachable.
 * See LND.getURL for the same fix on the backend side.
 */
export const swapWebSocketUrl = (endpoint: string): string =>
    endpoint.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/ws';

export const SWAPS_KEY = 'swaps';
export const REVERSE_SWAPS_KEY = 'reverse-swaps';
export const SWAPS_RESCUE_KEY = 'swaps-rescue-key';
export const SWAPS_LAST_USED_KEY = 'swaps-last-used-key';

export const RESCUE_KEY_WORD_COUNT = 12;

export const RESCUE_KEY_FILENAME = 'rescue_key.json';

// Older builds' rescue-key download wrote the mnemonic as plaintext JSON to
// shared storage: the public Downloads dir on Android and the Files-app
// visible Documents dir on iOS. Those files outlive the app, so they must be
// purged wherever the rescue key itself is deleted. The paths must stay in
// sync with the legacy writer, which used RNFS.DownloadDirectoryPath (public
// /sdcard/Download) and RNFS.DocumentDirectoryPath. Best-effort only: under
// Android scoped storage the file can only be removed by the install that
// created it, and a failed unlink can never succeed on a later retry.
export const purgeLegacyRescueKeyFiles = async (): Promise<void> => {
    const dir =
        Platform.OS === 'android'
            ? RNFS.DownloadDirectoryPath
            : RNFS.DocumentDirectoryPath;
    const path = `${dir}/${RESCUE_KEY_FILENAME}`;
    try {
        if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
            console.log('[SwapUtils] Legacy rescue key file deleted:', path);
        }
    } catch (e) {
        console.warn(
            `[SwapUtils] Error deleting legacy rescue key file ${path}:`,
            e
        );
    }
};

// Staging file for the rescue-key export, in app-private cache on both
// platforms. saveRescueKeyFile removes it before returning; the launch-time
// and wipe-path unlinks are belt-and-braces for saves interrupted by a
// crash and for files staged by earlier share-sheet builds of this flow.
export const rescueKeyStagingPath = `${RNFS.CachesDirectoryPath}/${RESCUE_KEY_FILENAME}`;

export const unlinkRescueKeyStagingFile = async (): Promise<void> => {
    try {
        if (await RNFS.exists(rescueKeyStagingPath)) {
            await RNFS.unlink(rescueKeyStagingPath);
        }
    } catch (e) {
        console.warn('[SwapUtils] Error deleting rescue key staging file:', e);
    }
};

// Exports the rescue key as plaintext JSON through the system save dialog,
// staged from app-private cache. Unlike a share sheet, saveDocuments copies
// the staged file into the user-chosen destination before resolving - there
// are no lazy readers, so the staging copy is always removed before this
// returns. The dialog is also the only Android path that can write to local
// device storage (the share sheet offers no save-to-device target). Rejects
// with code OPERATION_CANCELED when the user dismisses the dialog.
export const saveRescueKeyFile = async (mnemonic: string): Promise<void> => {
    try {
        await unlinkRescueKeyStagingFile();
        await RNFS.writeFile(
            rescueKeyStagingPath,
            JSON.stringify({ mnemonic }, null, 2),
            'utf8'
        );

        const [result] = await saveDocuments({
            sourceUris: [`file://${rescueKeyStagingPath}`],
            fileName: RESCUE_KEY_FILENAME,
            mimeType: 'application/json',
            copy: true
        });
        if (result?.error) {
            throw new Error(result.error);
        }
    } finally {
        await unlinkRescueKeyStagingFile();
    }
};

// Swap rescue keys are 12-word BIP39 mnemonics; the checksum must be
// enforced before persisting, since refund keys derived from a corrupted
// seed cannot be reproduced from the user's real backup.
export const isValidRescueKey = (mnemonic: string): boolean => {
    const words = mnemonic?.trim().split(/\s+/) || [];
    if (words.length !== RESCUE_KEY_WORD_COUNT) return false;
    return validateMnemonic(words.join(' '), BIP39_WORD_LIST);
};

export const calculateReceiveAmount = (
    sendAmount: BigNumber,
    serviceFee: number,
    minerFee: number,
    reverse: boolean
): BigNumber => {
    const receiveAmount = reverse
        ? sendAmount
              .minus(bigCeil(sendAmount.times(serviceFee).div(100)))
              .minus(minerFee)
        : sendAmount
              .minus(minerFee)
              .div(new BigNumber(1).plus(new BigNumber(serviceFee).div(100)));

    return BigNumber.maximum(bigFloor(receiveAmount), 0);
};

export const calculateServiceFeeOnSend = (
    sendAmount: BigNumber,
    serviceFee: number,
    minerFee: number,
    reverse: boolean
): BigNumber => {
    if (sendAmount.isNaN() || sendAmount.isLessThanOrEqualTo(0)) {
        return new BigNumber(0);
    }

    let feeNum: BigNumber;

    if (reverse) {
        feeNum = bigCeil(sendAmount.times(serviceFee).div(100));
    } else {
        const receiveAmt = calculateReceiveAmount(
            sendAmount,
            serviceFee,
            minerFee,
            reverse
        );

        if (sendAmount.isLessThanOrEqualTo(receiveAmt.plus(minerFee))) {
            // If send amount isn't enough to cover receive + miner
            feeNum = new BigNumber(0);
        } else {
            feeNum = sendAmount.minus(receiveAmt).minus(minerFee);
        }

        if (sendAmount.toNumber() < minerFee) {
            feeNum = new BigNumber(0);
        }
    }

    return bigCeil(BigNumber.maximum(feeNum, 0)); // Ensure fee is not negative
};

export const calculateSendAmount = (
    receiveAmount: BigNumber,
    serviceFee: number,
    minerFee: number,
    reverse: boolean
): BigNumber => {
    if (receiveAmount.isNaN() || receiveAmount.isLessThanOrEqualTo(0)) {
        return new BigNumber(0);
    }

    return reverse
        ? bigCeil(
              receiveAmount
                  .plus(minerFee)
                  .div(
                      new BigNumber(1).minus(new BigNumber(serviceFee).div(100))
                  )
          )
        : bigCeil(
              // ensure enough is sent
              receiveAmount
                  .plus(
                      bigCeil(
                          // service fee is on receiveAmount for submarine
                          receiveAmount.times(
                              new BigNumber(serviceFee).div(100)
                          )
                      )
                  )
                  .plus(minerFee)
          );
};

export const calculateLimit = (
    limit: number,
    serviceFeePct: number,
    minerFee: number,
    reverse: boolean
): number => {
    return !reverse
        ? calculateSendAmount(
              new BigNumber(limit),
              serviceFeePct,
              minerFee,
              reverse
          ).toNumber()
        : limit;
};
