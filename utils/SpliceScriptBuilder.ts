import { SpliceOutRequest, SpliceInRequest } from '../models/SpliceRequest';

export default class SpliceScriptBuilder {
    static convertFeeRate(satsPerVbyte: number): number {
        return Math.round(satsPerVbyte * 250);
    }

    static buildSpliceOut(request: SpliceOutRequest): string {
        const { channelId, amount, feeRate } = request;
        const feeRateOp = feeRate ? `@${this.convertFeeRate(feeRate)}` : '';
        return `${channelId} -> ${amount}sat+fee${feeRateOp}`;
    }

    static buildSpliceIn(request: SpliceInRequest): string {
        const { channelId, amount, feeRate } = request;
        const feeRateOp = feeRate
            ? `-fee@${this.convertFeeRate(feeRate)}`
            : '-fee';
        return `wallet -> ${amount}sat; ${amount}sat${feeRateOp} -> ${channelId}`;
    }
}
