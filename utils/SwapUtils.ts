import BigNumber from 'bignumber.js';

export const bigCeil = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_CEIL);
};

export const bigFloor = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_FLOOR);
};

export const SWAPS_KEY = 'swaps';
export const REVERSE_SWAPS_KEY = 'reverse-swaps';
export const SWAPS_RESCUE_KEY = 'swaps-rescue-key';
export const SWAPS_LAST_USED_KEY = 'swaps-last-used-key';

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

export const privateKeyFromSwapKeys = (
    keys:
        | { __D?: number[] | Uint8Array | { data?: number[] | Uint8Array } }
        | null
        | undefined
): string | null => {
    const raw = keys?.__D;
    if (!raw) {
        return null;
    }

    let bytes: number[] | Uint8Array | null = null;

    if (Array.isArray(raw) || raw instanceof Uint8Array) {
        bytes = raw;
    } else if (Array.isArray(raw.data) || raw.data instanceof Uint8Array) {
        bytes = raw.data;
    } else if (typeof raw === 'object') {
        const numericValues = Object.keys(raw)
            .filter((key) => /^\d+$/.test(key))
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
            .map((key) =>
                Number((raw as Record<string, number | undefined>)[key])
            )
            .filter((value) => Number.isInteger(value));

        if (numericValues.length > 0) {
            bytes = numericValues;
        }
    }

    if (!bytes) {
        return null;
    }

    return Buffer.from(bytes).toString('hex');
};
