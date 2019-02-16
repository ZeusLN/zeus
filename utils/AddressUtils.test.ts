import AddressUtils from './AddressUtils';

describe('AddressUtils', () => {
    describe('isValidBitcoinAddress', () => {
        it('validates Bitcoin Addresses properly', () => {
            expect(AddressUtils.isValidBitcoinAddress('a', false)).toBeFalsy()
            expect(AddressUtils.isValidBitcoinAddress('1AY6gTALH7bGrbN73qqTRnkW271JvBJc9o', false)).toBeTruthy();
            expect(AddressUtils.isValidBitcoinAddress('1AevDm7EU7TQn5q4QizTrbkZfEg5xpLM7s', false)).toBeTruthy();
            expect(AddressUtils.isValidBitcoinAddress('3BZj8Xf72guNcHCvaTCyhJqzyKhNJZuSUK', false)).toBeTruthy();
            expect(AddressUtils.isValidBitcoinAddress('3BMEXKKbiLv8a4v6Q482EfQAtecQUDAE6w', false)).toBeTruthy();
            expect(AddressUtils.isValidBitcoinAddress('bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu', false)).toBeTruthy();
            expect(AddressUtils.isValidBitcoinAddress('bc1q073ezlgdrqj8ug8gpmlnh0qa7ztlx65cm62sck', false)).toBeTruthy();
            expect(AddressUtils.isValidBitcoinAddress('bc1q073ezlgdrqj8ug8gpmlnh0qa7ztlx65cm62sck-', false)).toBeFalsy();
        });
    });

    describe('isValidLightningInvoice', () => {
        it('validates Lightning invoices properly', () => {
            expect(AddressUtils.isValidLightningInvoice('b')).toBeFalsy();
            expect(AddressUtils.isValidLightningInvoice('lnbcrt421fs1mmv3982skms')).toBeTruthy();
            expect(AddressUtils.isValidLightningInvoice('lntb4fe03rfsd41fefw')).toBeTruthy();
            expect(AddressUtils.isValidLightningInvoice('lnbc5fasdfa')).toBeTruthy();
        });
    });
});