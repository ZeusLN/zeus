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
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'lnbc10u1p0tr3zzpp5fh8qgluv6qv8p0a25x8zltrdggddeywdd278qqaz0h7nvcxpugpqdp6f35kw6r5de5kueeqf4skuettdykkuettdusyqgrnwfmzuerjv4skgtnr0gxqyjw5qcqp2rzjqdxjmlgn3dxl7t5098l03dctjxhg0vuyaw9c9999fmfwtrc37ggf6zvcfvqq9vgqqyqqqqrrqqqqqvsqxgjy4m2cx6ntrf6jj3582vf3ek5ax5xgm4gp3skdj5t9appt6d7jtyxjdluqsk9r93m9u67sn0h4gvn4ql3aax6uptanklsr2msu3rv8sp25v7fq'
                )
            ).toBeTruthy();
        });

        it('validates capitalized Lightning public keys properly', () => {
            expect(AddressUtils.isValidLightningPubKey('B')).toBeFalsy();
            expect(
                AddressUtils.isValidLightningPubKey(
                    '0368fea53f886ddaf541212f78e2ef426fdfef82c2df8ec7e2e100b4088ac0ff1d'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPubKey(
                    '02264ed0a325064edf66f20290003bede4c2122d8b27be396f700862dfdd925485'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidLightningPubKey(
                    '02f26071c249ea5cd7c346afda799d58f113852f7ab6c80f6f7f2bedd7c52cd01a'
                )
            ).toBeTruthy();
        });

        describe('processSendAddress', () => {
            it('process address inputed and scanned from the Send view', () => {
                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb?amount=0.00170003'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb',
                    amount: '170003' // amount in sats
                });

                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb',
                    amount: undefined
                });
            });
        });
    });
});
