import BigNumber from 'bignumber.js';
import { validateMnemonic } from '@scure/bip39';

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
