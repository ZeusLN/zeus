import {
    SpliceOutRequest,
    SpliceInRequest,
    SpliceRebalanceRequest
} from '../models/SpliceRequest';

export default class SpliceScriptBuilder {
    static convertFeeRate(satsPerVbyte: number): number {
        return Math.round(satsPerVbyte * 250);
    }

    static buildSpliceOut(request: SpliceOutRequest): string {
        const { channelId, amount, destination, feeRate } = request;
        const feeRateOp = feeRate ? `@${this.convertFeeRate(feeRate)}` : '';

        if (destination === 'wallet' || !destination) {
            return `${channelId} -> ${amount}sat+fee${feeRateOp}`;
        }

        return `${channelId} -> ${amount}sat+fee${feeRateOp}; ${amount}sat -> ${destination}`;
    }

    static buildSpliceIn(request: SpliceInRequest): string {
        const { channelId, amount, feeRate } = request;
        const feeRateOp = feeRate ? `@${this.convertFeeRate(feeRate)}` : '';
        return `wallet -> ${amount}sat+fee${feeRateOp}; ${amount}sat -> ${channelId}`;
    }

    static buildRebalance(request: SpliceRebalanceRequest): string {
        const { fromChannelId, toChannelId, amount, feeRate } = request;
        const feeRateOp = feeRate ? `@${this.convertFeeRate(feeRate)}` : '';
        return `${fromChannelId} -> ${amount}sat; 100%${feeRateOp} -> ${toChannelId}`;
    }

    static buildSpliceOutToWallet(
        channelId: string,
        amount: string,
        feeRate?: number
    ): string {
        const feeRateOp = feeRate ? `+fee@${this.convertFeeRate(feeRate)}` : '';
        return `${channelId} -> ${amount}sat${feeRateOp}`;
    }
}
