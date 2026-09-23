jest.mock('./LocaleUtils', () => ({
    localeString: (key: string, substitutions?: { [key: string]: any }) => {
        let text: string = require('../locales/en.json')[key];
        Object.keys(substitutions || {}).forEach((subKey) => {
            text = text.replace(
                `{{${subKey}}}`,
                String(substitutions![subKey])
            );
        });
        return text;
    }
}));

import {
    SPLICE_OUT_MIN_SATS,
    getSpliceAmountError,
    getSpliceInAvailableSats,
    getSpliceOutAvailableSats
} from './SpliceUtils';

const en = require('../locales/en.json');

describe('SpliceUtils', () => {
    describe('getSpliceInAvailableSats', () => {
        it('keeps the anchor reserve out of the confirmed balance', () => {
            expect(getSpliceInAvailableSats(100000, 25000)).toEqual(75000);
        });

        it('is the full confirmed balance without anchor channels', () => {
            expect(getSpliceInAvailableSats(100000, 0)).toEqual(100000);
        });

        it('never goes below zero when the reserve exceeds the balance', () => {
            expect(getSpliceInAvailableSats(10000, 25000)).toEqual(0);
        });
    });

    describe('getSpliceOutAvailableSats', () => {
        it('rounds a fractional outbound capacity down', () => {
            expect(getSpliceOutAvailableSats('299999.999')).toEqual(299999);
        });

        it('accepts numbers', () => {
            expect(getSpliceOutAvailableSats(150000)).toEqual(150000);
        });

        it('treats a missing capacity as zero', () => {
            expect(getSpliceOutAvailableSats('')).toEqual(0);
            expect(getSpliceOutAvailableSats('0')).toEqual(0);
        });
    });

    describe('getSpliceAmountError', () => {
        it('rejects zero and non-numeric amounts', () => {
            const message = en['views.Splice.error.amountNotPositive'];
            expect(getSpliceAmountError('in', 0, 100000)).toEqual(message);
            expect(getSpliceAmountError('out', NaN, 100000)).toEqual(message);
            expect(getSpliceAmountError('out', -1, 100000)).toEqual(message);
        });

        it('rejects a splice-in above the available on-chain funds', () => {
            expect(getSpliceAmountError('in', 75001, 75000)).toEqual(
                en['views.Splice.error.insufficientOnchainFunds']
            );
        });

        it('rejects a splice-out above the channel balance', () => {
            expect(getSpliceAmountError('out', 300000, 299999)).toEqual(
                en['views.Splice.error.insufficientChannelBalance']
            );
        });

        it('accepts exactly the available amount', () => {
            expect(getSpliceAmountError('in', 75000, 75000)).toBeNull();
            expect(getSpliceAmountError('out', 299999, 299999)).toBeNull();
        });

        it('rejects a splice-out below the dust limit', () => {
            expect(
                getSpliceAmountError('out', SPLICE_OUT_MIN_SATS - 1, 100000)
            ).toEqual('Splice-out amount must be at least 546 sats');
            expect(
                getSpliceAmountError('out', SPLICE_OUT_MIN_SATS, 100000)
            ).toBeNull();
        });

        it('has no minimum for a splice-in', () => {
            expect(getSpliceAmountError('in', 1, 100000)).toBeNull();
        });
    });
});
