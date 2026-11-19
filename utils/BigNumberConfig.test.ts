import BigNumber from 'bignumber.js';
import Long from 'long';

/**
 * Jest loads utils/BigNumberConfig.ts through setupFiles, as index.js does in
 * the app. These pin the 9.x behavior ZEUS depends on, which bignumber.js 10+
 * only gives with STRICT: false.
 */
describe('BigNumberConfig', () => {
    it('turns strict mode off', () => {
        expect(BigNumber.config({}).STRICT).toBe(false);
    });

    it.each(['', ' ', '.', '-', 'abc', '1,5', '₿0.00012618', undefined, null])(
        'returns NaN instead of throwing for %p',
        (input) => {
            expect(new BigNumber(input as any).isNaN()).toBe(true);
        }
    );

    it('returns NaN for an invalid argument to an arithmetic method', () => {
        expect(new BigNumber(1).plus('abc' as any).isNaN()).toBe(true);
    });

    it('reads a protobufjs Long, as embedded LND returns for int64 fields', () => {
        // proto/lightning.js is generated with --force-long, so balances and
        // amounts arrive as Long objects rather than numbers or strings.
        expect(new BigNumber(Long.fromNumber(123456) as any).toString()).toBe(
            '123456'
        );
        expect(
            new BigNumber(
                Long.fromString('18446744073709551615', true) as any
            ).toFixed()
        ).toBe('18446744073709551615');
    });
});
