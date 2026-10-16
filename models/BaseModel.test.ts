jest.mock('../stores/Stores');
jest.mock('../utils/LocaleUtils');

import { computed } from 'mobx';

import BaseModel from './BaseModel';
import Swap, { SwapType } from './Swap';

class Sample extends BaseModel {
    label: string;

    @computed get summary(): string {
        return `summary:${this.label}`;
    }
}

describe('BaseModel', () => {
    it('copies the fields of its input', () => {
        const sample = new Sample({ label: 'alpha', count: 2 });
        expect(sample.label).toBe('alpha');
        expect((sample as any).count).toBe(2);
        expect(sample.summary).toBe('summary:alpha');
    });

    it('converts Long values to strings', () => {
        const sample: any = new Sample({
            amount: { high: 0, low: 5, toString: () => '5' }
        });
        expect(sample.amount).toBe('5');
    });

    it('skips a "__proto__" key from parsed JSON', () => {
        const sample = new Sample(
            JSON.parse(
                '{"label":"alpha","__proto__":{"summary":"other","extra":1}}'
            )
        );
        expect(sample).toBeInstanceOf(Sample);
        expect(Object.getPrototypeOf(sample)).toBe(Sample.prototype);
        expect(sample.summary).toBe('summary:alpha');
        expect((sample as any).extra).toBeUndefined();
    });

    it('keeps the Swap getters when parsed JSON has a "__proto__" key', () => {
        const swap = new Swap(
            JSON.parse(
                `{"type":"${SwapType.Reverse}","invoice":"lnbc-verified",` +
                    '"destinationAddress":"bc1q-user",' +
                    '"__proto__":{"isReverseSwap":true,' +
                    '"qrCodeValue":"lnbc-other",' +
                    '"claimDestinationAddress":"bc1q-other"}}'
            )
        );
        expect(swap).toBeInstanceOf(Swap);
        expect(swap.isReverseSwap).toBe(true);
        expect(swap.qrCodeValue).toBe('lnbc-verified');
        expect(swap.claimDestinationAddress).toBe('bc1q-user');
    });
});
