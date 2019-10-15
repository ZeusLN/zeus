import AddressUtils from './AddressUtils';

describe('AddressUtils', () => {
    describe('isValidBitcoinAddress', () => {
        it('validates Bitcoin Addresses properly', () => {
            expect(AddressUtils.isValidBitcoinAddress('a', false)).toBeFalsy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    '1AY6gTALH7bGrbN73qqTRnkW271JvBJc9o',
                    false
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    '1AevDm7EU7TQn5q4QizTrbkZfEg5xpLM7s',
                    false
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    '3BZj8Xf72guNcHCvaTCyhJqzyKhNJZuSUK',
                    false
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    '3BMEXKKbiLv8a4v6Q482EfQAtecQUDAE6w',
                    false
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu',
                    false
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    'bc1q073ezlgdrqj8ug8gpmlnh0qa7ztlx65cm62sck',
                    false
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    'bc1q073ezlgdrqj8ug8gpmlnh0qa7ztlx65cm62sck-',
                    false
                )
            ).toBeFalsy();
        });
    });

    describe('isValidLightningPaymentRequest', () => {
        it('validates Lightning payment requests properly', () => {
            expect(
                AddressUtils.isValidLightningPaymentRequest('b')
            ).toBeFalsy();
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'lnbcrt421fs1mmv3982skms'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'lntb4fe03rfsd41fefw'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPaymentRequest('lnbc5fasdfa')
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'lnbc1pwxmpg5pp5pfc6hq9cn2059n8q6n0qhlxlyk6y38f7yxsg0cdq0s3s8xryaj6qdph235hqurfdcsyuet9wfsk5j6pyq58g6tswp5kutndv55jsaf5x5mrs2gcqzysxqyz5vq54gltey50ra8utdya5xj5yr9d30s4p627ftz4fjp78ky2slka2gskvp096jjefq3d5ujhnqwrrh70espxyh09kdmq8q64n3jaj8ldegq5m4ddp'
                )
            ).toBeTruthy();
        });
        it('validates capitalized Lightning payment requests properly', () => {
            expect(
                AddressUtils.isValidLightningPaymentRequest('B')
            ).toBeFalsy();
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'LNBCRT421FS1MMV3982SKMS'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'LNTB4FE03RFSD41FEFW'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPaymentRequest('LNBC5FASDFA')
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'LNBC1PWXMPG5PP5PFC6HQ9CN2059N8Q6N0QHLXLYK6Y38F7YXSG0CDQ0S3S8XRYAJ6QDPH235HQURFDCSYUET9WFSK5J6PYQ58G6TSWP5KUTNDV55JSAF5X5MRS2GCQZYSXQYZ5VQ54GLTEY50RA8UTDYA5XJ5YR9D30S4P627FTZ4FJP78KY2SLKA2GSKVP096JJEFQ3D5UJHNQWRRH70ESPXYH09KDMQ8Q64N3JAJ8LDEGQ5M4DDP'
                )
            ).toBeTruthy();
        });
    });
});
