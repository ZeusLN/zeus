import BigNumber from 'bignumber.js';

export const bigCeil = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_CEIL);
};

export const bigFloor = (big: BigNumber): BigNumber => {
    return big.integerValue(BigNumber.ROUND_FLOOR);
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
