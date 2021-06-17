import AddressUtils from './AddressUtils';

describe('AddressUtils', () => {
    describe('isValidBitcoinAddress', () => {
        it('validates Bitcoin Addresses properly', () => {
            expect(AddressUtils.isValidBitcoinAddress('a', false)).toBeFalsy();
            expect(
                AddressUtils.isValidBitcoinAddress(
                    'bcrt1qqgdrlt97x4847rf85utak8gre5q7k83uwh3ajj',
                    true
                )
            ).toBeTruthy();
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
        it('validates BECH32 variations properly', () => {
            // handle all caps BECH32 addresses
            expect(
                AddressUtils.isValidBitcoinAddress(
                    'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU',
                    false
                )
            ).toBeTruthy();
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
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb?label=test&amount=0.00170003'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb',
                    amount: '170003' // amount in sats
                });

                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb?amount=0.00170003&label=testw&randomparams=rm2'
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

                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofd?label=BitMEX%20Deposit%20-%20randomUser'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofd',
                    amount: undefined
                });
            });
        });

        describe('isValidLNDHubAddress', () => {
            it('validates LNDHub account addreses properly', () => {
                expect(
                    AddressUtils.isValidLNDHubAddress(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb?amount=0.00170003'
                    )
                ).toBeFalsy();
                expect(
                    AddressUtils.isValidLNDHubAddress(
                        'lndhub://9a1e4e972f732352c75e:4a1e4e172f732352c75e'
                    )
                ).toBeTruthy();
                expect(
                    AddressUtils.isValidLNDHubAddress(
                        'lndhub://admin:99b46a0892f7404e8a6e3a5e41d095cf@https://lnbits.local.domain.url:16507/lndhub/ext/'
                    )
                ).toBeTruthy();
                expect(
                    AddressUtils.isValidLNDHubAddress(
                        'lndhub://123:9b9537fe3de0dc2a9c6b5b6475dd4047d5a4cf16e531fd4a3e37efb68c99b5d6@https://lntxbot.bigsun.xyz'
                    )
                ).toBeTruthy();
                expect(
                    AddressUtils.isValidLNDHubAddress(
                        'lndhub://9a1e4e972f732352c75e:4a1e4e172f732352c75e@https://test-domain.org:4324'
                    )
                ).toBeTruthy();
                expect(
                    AddressUtils.isValidLNDHubAddress(
                        'bluewallet:setlndhuburl?url=http%3A%2F%2Fnaf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion'
                    )
                ).toBeTruthy();
            });
            it('processes all BECH32 send address variations', () => {
                // with fee
                expect(
                    AddressUtils.processSendAddress(
                        'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU?amount=0.00170003'
                    )
                ).toEqual({
                    value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU',
                    amount: '170003' // amount in sats
                });
                expect(
                    AddressUtils.processSendAddress(
                        'BITCOIN:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu?amount=0.00170003'
                    )
                ).toEqual({
                    value: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu',
                    amount: '170003' // amount in sats
                });
                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU?amount=0.00170003'
                    )
                ).toEqual({
                    value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU',
                    amount: '170003' // amount in sats
                });
                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu?amount=0.00170003'
                    )
                ).toEqual({
                    value: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu',
                    amount: '170003' // amount in sats
                });
                // without fee
                expect(
                    AddressUtils.processSendAddress(
                        'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
                    )
                ).toEqual({
                    value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
                });
                expect(
                    AddressUtils.processSendAddress(
                        'BITCOIN:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                    )
                ).toEqual({
                    value: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                });
                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
                    )
                ).toEqual({
                    value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
                });
                expect(
                    AddressUtils.processSendAddress(
                        'bitcoin:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                    )
                ).toEqual({
                    value: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                });
            });
        });

        describe('processLNDHubAddress', () => {
            it('processes LNDHub account addreses properly', () => {
                expect(
                    AddressUtils.processLNDHubAddress(
                        'lndhub://9a1e4e972f732352c75e:4a1e4e172f732352c75e'
                    )
                ).toEqual({
                    host: 'https://lndhub.herokuapp.com',
                    username: '9a1e4e972f732352c75e',
                    password: '4a1e4e172f732352c75e'
                });
                expect(
                    AddressUtils.processLNDHubAddress(
                        'lndhub://9a1e4e972f732352c75e:4a1e4e172f732352c75e@https://test-domain.org:4324'
                    )
                ).toEqual({
                    username: '9a1e4e972f732352c75e',
                    password: '4a1e4e172f732352c75e',
                    host: 'https://test-domain.org:4324'
                });
            });
            it('processes hosts from Umbrel', () => {
                expect(
                    AddressUtils.processLNDHubAddress(
                        'bluewallet:setlndhuburl?url=http%3A%2F%2Fnaf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion'
                    )
                ).toEqual({
                    host:
                        'http://naf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion'
                });
            });
            it('processes hosts from MyNode', () => {
                expect(
                    AddressUtils.processLNDHubAddress(
                        'bluewallet:setlndhuburl?url=http%3A%2F%2Fnaf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion:3000'
                    )
                ).toEqual({
                    host:
                        'http://naf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion:3000'
                });
            });
        });
    });
});
