import BigNumber from 'bignumber.js';

/**
 * BOLT 7 short channel ids pack three fields into a uint64:
 * block height (3 bytes), transaction index (3 bytes), output index (2 bytes).
 *
 * The number is handled with BigNumber because uint64 values exceed
 * Number.MAX_SAFE_INTEGER, and this replaces bolt07's chanFormat, which
 * needs Buffer BigInt methods that the buffer polyfill on device lacks.
 */

const MAX_SCID = new BigNumber('18446744073709551615');
const BLOCK_HEIGHT_DIVISOR = 2 ** 40;
const TX_INDEX_DIVISOR = 2 ** 16;
const TX_INDEX_MODULUS = 2 ** 24;
const OUTPUT_INDEX_MODULUS = 2 ** 16;

/**
 * Formats a numeric short channel id as `blockHeightxTxIndexxOutputIndex`.
 *
 * Accepts a decimal string, a number, or a protobuf Long (embedded LND
 * decodes uint64 fields as Long, and arrays of them are not converted to
 * strings by BaseModel). Returns undefined for anything that is not an
 * integer in the uint64 range.
 */
export const formatScid = (
    scid?: string | number | { toString(): string } | null
): string | undefined => {
    if (scid === undefined || scid === null) return undefined;

    const value = String(scid);
    if (!/^\d+$/.test(value)) return undefined;

    const number = new BigNumber(value);
    if (number.isGreaterThan(MAX_SCID)) return undefined;

    const blockHeight = number.idiv(BLOCK_HEIGHT_DIVISOR);
    const txIndex = number.idiv(TX_INDEX_DIVISOR).mod(TX_INDEX_MODULUS);
    const outputIndex = number.mod(OUTPUT_INDEX_MODULUS);

    return `${blockHeight.toFixed()}x${txIndex.toFixed()}x${outputIndex.toFixed()}`;
};
