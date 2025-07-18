jest.mock('react-native-encrypted-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve())
}));

jest.mock('../stores/Stores', () => ({
    SettingsStore: {
        settings: {
            display: {
                removeDecimalSpaces: false
            }
        }
    },
    nodeInfoStore: {
        nodeInfo: {
            isTestNet: false,
            isRegTest: false
        }
    }
}));

import AddressUtils from './AddressUtils';
import { walletrpc } from '../proto/lightning';

describe('AddressUtils', () => {
    describe('isValidBIP21Uri', () => {
        it('validates all BIP-21 URI variations', () => {
            expect(
                AddressUtils.isValidBIP21Uri(
                    'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU?amount=0.00170003'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'BITCOIN:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu?amount=0.00170003'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'BITCOIN:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'bitcoin:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU?amount=0.00170003'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'bitcoin:?lno=lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'bitcoin:?lno=lno1qsgqmqvgm96frzdg8m0gc6nzeqffvzsqzrxqy32afmr3jn9ggkwg3egfwch2hy0l6jut6vfd8vpsc3h89l6u3dm4q2d6nuamav3w27xvdmv3lpgklhg7l5teypqz9l53hj7zvuaenh34xqsz2sa967yzqkylfu9xtcd5ymcmfp32h083e805y7jfd236w9afhavqqvl8uyma7x77yun4ehe9pnhu2gekjguexmxpqjcr2j822xr7q34p078gzslf9wpwz5y57alxu99s0z2ql0kfqvwhzycqq45ehh58xnfpuek80hw6spvwrvttjrrq9pphh0dpydh06qqspp5uq4gpyt6n9mwexde44qv7lstzzq60nr40ff38u27un6y53aypmx0p4qruk2tf9mjwqlhxak4znvna5y'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'BITCOIN:?LNO=lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
                )
            ).toEqual(true);
            expect(
                AddressUtils.isValidBIP21Uri(
                    'shitcoin:?LNO=lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
                )
            ).toEqual(false);
        });
    });

    describe('processBIP21Uri', () => {
        it('processes all BIP-21 URI variations', () => {
            // with fee
            expect(
                AddressUtils.processBIP21Uri(
                    'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU?amount=0.00170003'
                )
            ).toEqual({
                value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU',
                satAmount: '170003'
            });
            expect(
                AddressUtils.processBIP21Uri(
                    'BITCOIN:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu?amount=0.00170003'
                )
            ).toEqual({
                value: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu',
                satAmount: '170003'
            });

            // without fee
            expect(
                AddressUtils.processBIP21Uri(
                    'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
                )
            ).toEqual({
                value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
            });
            expect(
                AddressUtils.processBIP21Uri(
                    'BITCOIN:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                )
            ).toEqual({
                value: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
            });
            expect(
                AddressUtils.processBIP21Uri(
                    'bitcoin:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
                )
            ).toEqual({
                value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU'
            });
            expect(
                AddressUtils.processBIP21Uri(
                    'bitcoin:bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
                )
            ).toEqual({
                value: 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu'
            });
            expect(
                AddressUtils.processBIP21Uri(
                    'BITCOIN:BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU?amount=0.00170003'
                )
            ).toEqual({
                value: 'BC1Q7065EZYHCD3QTQLCVWCMP9T2WEAXC4SGUUVLWU',
                satAmount: '170003'
            });

            // bolt12 offers
            expect(
                AddressUtils.processBIP21Uri(
                    'bitcoin:?lno=lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
                )
            ).toEqual({
                value: '',
                offer: 'lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
            });
            expect(
                AddressUtils.processBIP21Uri(
                    'BITCOIN:?lno=lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
                )
            ).toEqual({
                value: '',
                offer: 'lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
            });
            expect(
                AddressUtils.processBIP21Uri(
                    'BITCOIN:?LNO=lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
                )
            ).toEqual({
                value: '',
                offer: 'lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes'
            });
        });
    });

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
                    'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
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

            expect(
                AddressUtils.isValidBitcoinAddress(
                    'lndhub://db48dd0a-a298-405f-b70e-a62d8df5ae45:85f8a5a56c547fd561f6d8902b0ca9d66fc0152a@https://mybtcpayserver.com/plugins/lnbank/api/lndhub',
                    false
                )
            ).toBeFalsy();
        });

        it('validates Bech32m - P2TR properly', () => {
            expect(
                AddressUtils.isValidBitcoinAddress(
                    'bc1pmfr3p9j00pfxjh0zmgp99y8zftmd3s5pmedqhyptwy6lm87hf5sspknck9',
                    true
                )
            ).toBeTruthy();

            expect(
                AddressUtils.isValidBitcoinAddress(
                    'BC1PMFR3P9J00PFXJH0ZMGP99Y8ZFTMD3S5PMEDQHYPTWY6LM87HF5SSPKNCK9',
                    true
                )
            ).toBeTruthy();

            expect(
                AddressUtils.isValidBitcoinAddress(
                    'bc1pveaamy78cq5hvl74zmfw52fxyjun3lh7lgt44j03ygx02zyk8lesgk06f6',
                    true
                )
            ).toBeTruthy();

            expect(
                AddressUtils.isValidBitcoinAddress(
                    'BC1PVEAAMY78CQ5HVL74ZMFW52FXYJUN3LH7LGT44J03YGX02ZYK8LESGK06F6',
                    true
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
            // signet
            expect(
                AddressUtils.isValidLightningPaymentRequest(
                    'lntbs567780n1pnqr26ypp5c0wcrpzwxwqnwu2nld5q36dfc9yjrfdp87nn9d5y093jjncvqresdq0w3jhxar8v3n8xeccqzpuxqrrsssp5r94e3nwnw63gjaxc8wex38ufv2m6442vnrw49m7dad9jdum3tdsq9qyyssqk4dvvuk7zhhju8ztf7nfc2hzqq9gqtzuyc0ljz8nl93laxwv4869lt9fsxkxacje6eh4ur5ymg83hvakn4tfpzdu6fq49705sar7fxspga8qjp'
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

        it('validates Lightning public keys properly', () => {
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
            // Nostr pubkeys aren't valid
            expect(
                AddressUtils.isValidLightningPubKey(
                    '91c9a5e1a9744114c6fe2d61ae4de82629eaaa0fb52f48288093c7e7e036f832'
                )
            ).toBeFalsy();
        });

        describe('processBIP21Uri', () => {
            it('process address inputed and scanned from the Send view', () => {
                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb?amount=0.00170003'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb',
                    satAmount: '170003'
                });

                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb?label=test&amount=0.00170003'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb',
                    satAmount: '170003'
                });

                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb?amount=0.00170003&label=testw&randomparams=rm2'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb',
                    satAmount: '170003'
                });

                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofb',
                    satAmount: undefined
                });

                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:34K6tvoWM7k2ujeXVuimv29WyAsqzhWofd?label=BitMEX%20Deposit%20-%20randomUser'
                    )
                ).toEqual({
                    value: '34K6tvoWM7k2ujeXVuimv29WyAsqzhWofd',
                    satAmount: undefined
                });
            });

            it('processes BIP21 invoices', () => {
                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightning=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6'
                    )
                ).toEqual({
                    value: 'BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U',
                    lightning:
                        'LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6',
                    satAmount: '1000'
                });
            });

            it('processes BIP21 invoices - with hanging values after lightning param', () => {
                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightning=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6&test=haha'
                    )
                ).toEqual({
                    value: 'BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U',
                    lightning:
                        'LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6',
                    satAmount: '1000'
                });
            });

            it('processes BIP21 invoices - with lightning param in all caps', () => {
                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&LIGHTNING=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6&test=haha'
                    )
                ).toEqual({
                    value: 'BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U',
                    lightning:
                        'LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6',
                    satAmount: '1000'
                });
            });

            it('processes BIP21 invoices - with amount param in all caps', () => {
                expect(
                    AddressUtils.processBIP21Uri(
                        'bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?AMOUNT=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&LIGHTNING=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6&test=haha'
                    )
                ).toEqual({
                    value: 'BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U',
                    lightning:
                        'LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6',
                    satAmount: '1000'
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
                expect(
                    AddressUtils.isValidLNDHubAddress(
                        'lndhub://db48dd0a-a298-405f-b70e-a62d8df5ae45:85f8a5a56c547fd561f6d8902b0ca9d66fc0152a@https://mybtcpayserver.com/plugins/lnbank/api/lndhub'
                    )
                ).toBeTruthy();
            });
        });

        describe('isValidLightningAddress', () => {
            it('validates LNURLPay Lightning Addresses properly', () => {
                expect(
                    AddressUtils.isValidLightningAddress('lnaddress@zbd.gg')
                ).toBeTruthy();
                expect(
                    AddressUtils.isValidLightningAddress(
                        'notzeuslnaddress@payaddress.co'
                    )
                ).toBeTruthy();
                expect(
                    AddressUtils.isValidLightningAddress(
                        'evankaloudis@ln.twitter.com'
                    )
                ).toBeTruthy();
                expect(
                    AddressUtils.isValidLightningAddress(
                        'oniontip@7tpv3ynajkv6cdocmzitcd4z3xrstp3ic6xtv5om3dc2ned3fffll5qd.onion'
                    )
                ).toBeTruthy();
            });

            it('validates lightning addresses with uppercase chars in the handle', () => {
                // will be converted to lowercase in handleAnything
                expect(
                    AddressUtils.isValidLightningAddress('Evan@zeuspay.com')
                ).toBeTruthy();

                expect(
                    AddressUtils.isValidLightningAddress('Acronym@zeuspay.com')
                ).toBeTruthy();
            });

            it("rejects LNURLPay Lightning Addresses with ports - let's not mix this up with nodes", () => {
                expect(
                    AddressUtils.isValidLightningAddress(
                        'lnaddress@zbd.gg:31337'
                    )
                ).toBeFalsy();
                expect(
                    AddressUtils.isValidLightningAddress(
                        'notzeuslnaddress@payaddress.co:8008'
                    )
                ).toBeFalsy();
                expect(
                    AddressUtils.isValidLightningAddress(
                        'dontacceptports@payaddress.co:9735'
                    )
                ).toBeFalsy();
            });
        });

        describe('processLNDHubAddress', () => {
            it('processes LNDHub account addreses properly', () => {
                expect(
                    AddressUtils.processLNDHubAddress(
                        'lndhub://9a1e4e972f732352c75e:4a1e4e172f732352c75e'
                    )
                ).toEqual({
                    host: 'https://lndhub.io',
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
                expect(
                    AddressUtils.processLNDHubAddress(
                        'lndhub://db48dd0a-a298-405f-b70e-a62d8df5ae45:85f8a5a56c547fd561f6d8902b0ca9d66fc0152a@https://mybtcpayserver.com/plugins/lnbank/api/lndhub'
                    )
                ).toEqual({
                    username: 'db48dd0a-a298-405f-b70e-a62d8df5ae45',
                    password: '85f8a5a56c547fd561f6d8902b0ca9d66fc0152a',
                    host: 'https://mybtcpayserver.com/plugins/lnbank/api/lndhub'
                });
            });
            it('processes hosts from Umbrel', () => {
                expect(
                    AddressUtils.processLNDHubAddress(
                        'bluewallet:setlndhuburl?url=http%3A%2F%2Fnaf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion'
                    )
                ).toEqual({
                    host: 'http://naf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion'
                });
            });
            it('processes hosts from MyNode', () => {
                expect(
                    AddressUtils.processLNDHubAddress(
                        'bluewallet:setlndhuburl?url=http%3A%2F%2Fnaf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion:3000'
                    )
                ).toEqual({
                    host: 'http://naf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion:3000'
                });
            });

            it('processes hosts from MyNode - alt encoding', () => {
                expect(
                    AddressUtils.processLNDHubAddress(
                        'bluewallet:setlndhuburl?url=http://naf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion:3000'
                    )
                ).toEqual({
                    host: 'http://naf3121nfadoxnwer1s5x2rkirdqbmvuws2ojvgood.onion:3000'
                });
            });
        });
    });
    describe('isValidNpub', () => {
        it('validates npub properly', () => {
            expect(
                AddressUtils.isValidNpub(
                    'npub18sqwdw687krnx0d23qa6a4mq38743xx5nfd3f9h5yts39srcl8qsf6k5jy'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidNpub(
                    'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidNpub(
                    'npub1hlgjrgmhwd257thnarjjfc8rxlemlpfwk4wdjejw9jgp298sv0nsq3mr2u'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidNpub(
                    'npub1h87dwd37896498f2236h54f274f524f4'
                )
            ).toBeFalsy();
            expect(
                AddressUtils.isValidNpub(
                    'bc463495cb345634cbc63498b65c34786bc538746b3cb47cb34875398c4b476'
                )
            ).toBeFalsy();
            expect(
                AddressUtils.isValidNpub('njkd7d484jffj4f4n37n4c7c3n4c7n34c38')
            ).toBeFalsy();
        });
    });
    describe('isValidXpub', () => {
        it('validates xpub properly', () => {
            expect(
                AddressUtils.isValidXpub(
                    'xpub5Y6A79VDz9HKqnZfg2jGKtxKBYq6XG7zzbfjnifSUEWAkiHSiWSYxaFHz3iGfVeHW7y7KrgfnZBE9RNvZ6iWoadBRzwzPSBWVYsK7rb3zdr'
                )
            ).toBeTruthy();
        });
        it('validates vpub properly', () => {
            expect(
                AddressUtils.isValidXpub(
                    'vpub5Y6A79VDz9HKqnZfg2jGKtxKBYq6XG7zzbfjnifSUEWAkiHSiWSYxaFHz3iGfVeHW7y7KrgfnZBE9RNvZ6iWoadBRzwzPSBWVYsK7rb3zdr'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidXpub(
                    'jpub18sqwdw687krnx0d23qa6a4mq38743xx5nfd3f9h5yts39srcl8qsf6k5jy'
                )
            ).toBeFalsy();
        });
        it('validates tpub properly', () => {
            expect(
                AddressUtils.isValidXpub(
                    'vpub5Y6A79VDz9HKqnZfg2jGKtxKBYq6XG7zzbfjnifSUEWAkiHSiWSYxaFHz3iGfVeHW7y7KrgfnZBE9RNvZ6iWoadBRzwzPSBWVYsK7rb3zdr'
                )
            ).toBeTruthy();
        });
    });
    describe('isPsbt', () => {
        it('validates psbt properly', () => {
            expect(
                AddressUtils.isPsbt(
                    'cHNidP8BAHECAAAAASH1DD3EVDhwv9tSQTJiP5zHwX+r/dEkCg8a7jVAT3N3AQAAAAAAAAAAAoaFAQAAAAAAFgAU5EVuafp35OihR2hkWQB50y6Q3X+AGgYAAAAAABYAFFsrnHDuXZoqJBYsPMz8ItUEe01GAAAAAAABAMEBAAAAAAEBlzXH9atX6TbXS5BnBN/amHnoFXR86c1j9ihXBvgU+A0BAAAAAP////8CoqhDAAAAAAAiUSCVsyzvZIUrZJU4d8WX/+sqnNuwTnHim3Pv9K4MoN4qCiChBwAAAAAAFgAUahn0mwgCctQ0oldF/530wrmS/EYBQCaXiuS3Rt5NDqdGclWKLgkppsq4eR5zQ8ragsUsmwmPgtJgHfAY4VO4Iihc4aWLItM0wRoro4wwU+DyE7IG1acAAAAAAQEfIKEHAAAAAAAWABRqGfSbCAJy1DSiV0X/nfTCuZL8RgEDBAEAAAAiBgJAWL0W3k238nrOLt7M01BcyMno0QGpEN1seOdLEdeKshhf1vdJVAAAgAAAAIAAAACAAAAAAAAAAAAAIgICUIo27fi/31T2NPCbSTKnUsTxGJs6L8PjOz2RNLW+iQ4YAAAAAFQAAIAAAACAAAAAgAEAAAACAAAAAAA='
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isPsbt(
                    'cHNidP8BAHECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isPsbt(
                    'cHNidP8BAHECAAAAAeejupRyIcZufE+3b+ZiAh3bgxbLiOIg/K2RHcGzXWPYAQAAAAAAAAAAAhcWBQAAAAAAFgAUOJBr8EWH5PSIFmBgbHSTkbCTz6CeKwoAAAAAABYAFOluX+Vt7OhhZIJIWXsgOIcBrNMyAAAAAAABAMEBAAAAAAEB6gSs29VxUCwh270TN8OkpN98GeteiQDZHXXXcyWsBdYBAAAAAP////8CdTc8AAAAAAAiUSADfpNfR2FsBlCN0nSJIotJnZFz+ymZRZpWOdu4Bbt/sEJCDwAAAAAAFgAUiv+GA89mInZrHtu+o1OiiP4LGksBQNT5+bhk3TOJiTn9c9cPONnTKylnTOEhXD264qyAGO5wnjB79h8p0wREoNc/BhsLSF1Wrz5XwN7wwTMHsmStmfMAAAAAAQEfQkIPAAAAAAAWABSK/4YDz2Yidmse276jU6KI/gsaSwEDBAEAAAAiBgNchw+CoUkI5FdtT6GQpGGQvbIjcLTWYO2oaUkCp8A2uhgwSz7BVAAAgAAAAIAAAACAAAAAAAAAAAAAACICA4IRekfpL6gnOM7Jv/PZXcqIMCv3ojVCZ1f2/Qh+Lq/QGAAAAABUAACAAAAAgAAAAIABAAAAAAAAAAA='
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isPsbt(
                    'psbt:cHNidP8BAHECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isPsbt(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeFalsy();
        });
    });
    describe('isValidTxHex', () => {
        it('validates TX hexes properly', () => {
            expect(
                AddressUtils.isValidTxHex(
                    '0200000000010369463edb561c263f1c1cd6df5a230e62f3951893e4975b37fa710598969eb8030100000000fdffffff4af5cf12b34d9f7669a146e6ab6a981b98650931ddb90846420aa03a0b46b8230300000000fdffffff810fe5d0566b662c8a6694bbbad4429adef4b7b586bcf9808d3c6f50748c6fb70100000000fdffffff02f3ae010000000000160014766cdfc2feb62daef1e8ab92393d029e07e34611770ae10000000000160014b9686f793dfcc6ebe6e120552c7f08667a1711c80247304402200484ecf7d86e39028fa3d5ecf8275629f8d5294de8a554c79bbb953914c9edda022013b1f30577f18eb988ee6b7ec810201d34f555a5d7cb334479896d3692c467610121031f1ae8de454c0ce5a239cbef1559d5004740db4b664bd3ff0623fde49142ffd50247304402202d911869548104efcb3d9657fc82df41f99edd828fa34c62a6e3a5a6f53b0892022012946e4081250724616d424ea3c05684361d7973c86fc9417cda574d230ac2f801210288e0946ff5b1c8b4ae356203256ed7d92f07288f92b09b4a47fc22527d243ad102473044022022c894a0a2c1781a6db1043c52a90b519f6c2692aa983dc73c9bc07b514788170220375bfc525e20fd044c9da198abd88b6851fca39f74668e94047ce38c8fd30ee401210288e0946ff5b1c8b4ae356203256ed7d92f07288f92b09b4a47fc22527d243ad1f9520b00'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isValidTxHex(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeFalsy();
        });
    });
    describe('isKeystoreWalletExport', () => {
        it('validates keystore json export properly', () => {
            expect(
                AddressUtils.isKeystoreWalletExport(
                    '{"keystore": {"ckcc_xpub": "xpub6CikkQWpo5GK4aDK8KCkmZcHKdANfNorMPfVz2QoS4x6FMg38SeTahR8i666uEUk1ZoZhyM5uctHf1Rpddbbf4YpoaVcieYvZWRG6UU7gzN", "xpub": "zpub6rPHMjrf6SMGmAbYo2n1BjoHfZTGYcnrBchwYpCaC5hrMZJVdkyappjQkW1Gu3napr3BCvYCpwbPRaex52RdFXv2YFtTtUBu6xYYscVK2n9", "label": "Passport (AB88DE89)", "ckcc_xfp": 2313062571, "type": "hardware", "hw_type": "passport", "derivation": "m/84\'/0\'/0\'"}, "wallet_type": "standard", "use_encryption": false, "seed_version": 17}'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isKeystoreWalletExport(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeFalsy();
        });
    });
    describe('processesKeystoreWalletExport', () => {
        it('validates keystore json export properly', () => {
            expect(
                AddressUtils.processKeystoreWalletExport(
                    '{"keystore": {"ckcc_xpub": "xpub6CikkQWpo5GK4aDK8KCkmZcHKdANfNorMPfVz2QoS4x6FMg38SeTahR8i666uEUk1ZoZhyM5uctHf1Rpddbbf4YpoaVcieYvZWRG6UU7gzN", "xpub": "zpub6rPHMjrf6SMGmAbYo2n1BjoHfZTGYcnrBchwYpCaC5hrMZJVdkyappjQkW1Gu3napr3BCvYCpwbPRaex52RdFXv2YFtTtUBu6xYYscVK2n9", "label": "Passport (AB88DE89)", "ckcc_xfp": 2313062571, "type": "hardware", "hw_type": "passport", "derivation": "m/84\'/0\'/0\'"}, "wallet_type": "standard", "use_encryption": false, "seed_version": 17}'
                )
            ).toEqual({
                ExtPubKey:
                    'zpub6rPHMjrf6SMGmAbYo2n1BjoHfZTGYcnrBchwYpCaC5hrMZJVdkyappjQkW1Gu3napr3BCvYCpwbPRaex52RdFXv2YFtTtUBu6xYYscVK2n9',
                Label: 'Passport (AB88DE89)',
                MasterFingerprint: 'AB88DE89'
            });
        });
    });
    describe('isJsonWalletExport', () => {
        it('validates wallet json export properly', () => {
            expect(
                AddressUtils.isJsonWalletExport(
                    '{"MasterFingerprint": "4BDCB6A0", "ExtPubKey": "xpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh"}'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isJsonWalletExport(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeFalsy();
        });
    });
    describe('isStringWalletExport', () => {
        it('validates wallet string export properly', () => {
            expect(
                AddressUtils.isStringWalletExport(
                    "[1234abcd/84'/0'/0']xpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh"
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isStringWalletExport(
                    "[1234abcd/84'/0'/0']vpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh"
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isStringWalletExport(
                    "[1234abcd/84'/0'/0']tpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh"
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isStringWalletExport(
                    'sh(wpkh([0f056943/84h/1h/0h]tpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*))#sjuyyvve'
                )
            ).toBeFalsy();
            expect(
                AddressUtils.isStringWalletExport(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeFalsy();
        });

        it('validates wallet string export properly - alt - krux', () => {
            expect(
                AddressUtils.isStringWalletExport(
                    '[41bb50e2/84h/0h/0h]xpub6CcD1VzTNViCWJy9Vc3ATAehTs2rzSsywddA6jbUzVx6M7LQUNCJjPVbYiUh3VohH9rh2sfnUvbh7hoRe2RRwbTK1K4jzqtGZdEjDTPnypm'
                )
            ).toBeTruthy();
        });
    });
    describe('decodeStringWalletExport', () => {
        it('validates wallet string export properly', () => {
            expect(
                AddressUtils.processStringWalletExport(
                    "[1234abcd/84'/0'/0']xpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh"
                )
            ).toEqual({
                MasterFingerprint: '1234abcd',
                ExtPubKey:
                    'xpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh'
            });
            expect(
                AddressUtils.processStringWalletExport(
                    "[1234abcd/84'/0'/0']vpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh"
                )
            ).toEqual({
                MasterFingerprint: '1234abcd',
                ExtPubKey:
                    'vpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh'
            });
            expect(
                AddressUtils.processStringWalletExport(
                    "[1234abcd/84'/0'/0']tpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh"
                )
            ).toEqual({
                MasterFingerprint: '1234abcd',
                ExtPubKey:
                    'tpub6CMKK1icAQg3SxtRS8iW8agXBcoAAhYWBQAAAAAAFgiAYhm6fL4Sy8hoHncivhuWOrtE16HaS8AQNwAixnBk67q5dYh'
            });
            expect(
                AddressUtils.processStringWalletExport(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toEqual({
                MasterFingerprint: '',
                ExtPubKey: ''
            });
        });
    });
    describe('isWpkhDescriptor', () => {
        it('validates wpkh descriptor properly', () => {
            expect(
                AddressUtils.isWpkhDescriptor(
                    'wpkh([0f056943/84h/1h/0h]xpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*)#sjuyyvve'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isWpkhDescriptor(
                    'wpkh([0f056943/84h/1h/0h]vpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*)#sjuyyvve'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isWpkhDescriptor(
                    'wpkh([0f056943/84h/1h/0h]tpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*)#sjuyyvve'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isWpkhDescriptor(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeFalsy();
        });
    });
    describe('processWpkhDescriptor', () => {
        it('processes wpkh descriptor properly', () => {
            expect(
                AddressUtils.processWpkhDescriptor(
                    'wpkh([0f056943/84h/1h/0h]xpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*)#sjuyyvve'
                )
            ).toEqual({
                MasterFingerprint: '0f056943',
                ExtPubKey:
                    'xpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r',
                AddressType: walletrpc.AddressType.WITNESS_PUBKEY_HASH
            });
            expect(
                AddressUtils.processWpkhDescriptor(
                    'wpkh([0f056943/84h/1h/0h]vpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*)#sjuyyvve'
                )
            ).toEqual({
                MasterFingerprint: '0f056943',
                ExtPubKey:
                    'vpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r',
                AddressType: walletrpc.AddressType.WITNESS_PUBKEY_HASH
            });
            expect(
                AddressUtils.processWpkhDescriptor(
                    'wpkh([0f056943/84h/1h/0h]tpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*)#sjuyyvve'
                )
            ).toEqual({
                MasterFingerprint: '0f056943',
                ExtPubKey:
                    'tpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r',
                AddressType: walletrpc.AddressType.WITNESS_PUBKEY_HASH
            });
            expect(
                AddressUtils.processWpkhDescriptor(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toEqual({
                MasterFingerprint: '',
                ExtPubKey: ''
            });
        });
    });
    describe('isNestedWpkhDescriptor', () => {
        it('validates wpkh descriptor properly', () => {
            expect(
                AddressUtils.isNestedWpkhDescriptor(
                    'sh(wpkh([0f056943/84h/1h/0h]xpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*))#sjuyyvve'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isNestedWpkhDescriptor(
                    'sh(wpkh([0f056943/84h/1h/0h]vpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*))#sjuyy1ve'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isNestedWpkhDescriptor(
                    'sh(wpkh([0f056943/49h/0h/0h]tpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*))#4juyyvve'
                )
            ).toBeTruthy();
            expect(
                AddressUtils.isNestedWpkhDescriptor(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toBeFalsy();
        });
    });

    describe('processNestedWpkhDescriptor', () => {
        it('processes wpkh descriptor properly', () => {
            expect(
                AddressUtils.processNestedWpkhDescriptor(
                    'sh(wpkh([0f056943/84h/1h/0h]xpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*))#sjuyyvve'
                )
            ).toEqual({
                MasterFingerprint: '0f056943',
                ExtPubKey:
                    'xpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r',
                AddressType: walletrpc.AddressType.NESTED_WITNESS_PUBKEY_HASH
            });
            expect(
                AddressUtils.processNestedWpkhDescriptor(
                    'sh(wpkh([0f056943/84h/1h/0h]vpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*))#sjuyyvve'
                )
            ).toEqual({
                MasterFingerprint: '0f056943',
                ExtPubKey:
                    'vpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r',
                AddressType: walletrpc.AddressType.NESTED_WITNESS_PUBKEY_HASH
            });
            expect(
                AddressUtils.processNestedWpkhDescriptor(
                    'sh(wpkh([0f056943/84h/1h/0h]tpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r/<0;1>/*))#sjuyyvve'
                )
            ).toEqual({
                MasterFingerprint: '0f056943',
                ExtPubKey:
                    'tpubDC7jGaaSE66Pn4dgtbAAstde4bCyhSUs4r3P8WhMVvPByvcRrzrwqSvpF9Ghx83Z1LfVugGRrSBko5UEKELCz9HoMv5qKmGq3fqnnbS5E9r',
                AddressType: walletrpc.AddressType.NESTED_WITNESS_PUBKEY_HASH
            });
            expect(
                AddressUtils.processNestedWpkhDescriptor(
                    'HECAAAAAUUciaQyD+SNWEpxgGtzTu+oDD0Cz5ruBd8p/f8oJcLAAAAAAAAAAAAAAhYWBQAAAAAAFgAUyAKI5CC+f/qmH/pwnWbWGp7jMXWdKwoAAAAAABYAFNOI441ynZKMY1nHncivhuWOrtE9AAAAAAABAMEBAAAAAAEBYMD9yaTYz+jWmkvNnmWzTDnV+5ipWwAgds0YQZV4lPgBAAAAAP////8CQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIg3s3PAAAAAAAIlEgAKq3khGSJ+6leSdrl5p3YU46/KMwhdxB3wnMZNci6isBQJWsI+EnbOw8UufplAEngcL/rwF5ZFg774Fsyy0o1TaTk2oieRvsf+yjovUNimvaEp0a7dbqJPlbjv1q7aiE8ScAAAAAAQEfQEIPAAAAAAAWABQYA4X8Va08XOA7BMSgTXpRRjsIgwEDBAEAAAAiBgLg8Q2B0fNznWOcgQ9IUBh8HAWuwoxqh1VzybPsUOurDhgAAAAAVAAAgAAAAIAAAACAAAAAAAUAAAAAACICA1PNZFtRnJQVrZZUDR631uBtwEpY7rCwpciT2cPRSFHzGAAAAABUAACAAAAAgAAAAIABAAAAAQAAAAA='
                )
            ).toEqual({
                MasterFingerprint: '',
                ExtPubKey: ''
            });
        });
    });

    describe('snakeToHumanReadable', () => {
        it('processes address types properly', () => {
            expect(
                AddressUtils.snakeToHumanReadable('WITNESS_PUBKEY_HASH')
            ).toEqual('Witness pubkey hash');
            expect(
                AddressUtils.snakeToHumanReadable('NESTED_PUBKEY_HASH')
            ).toEqual('Nested pubkey hash');
            expect(
                AddressUtils.snakeToHumanReadable('UNUSED_WITNESS_PUBKEY_HASH')
            ).toEqual('Unused witness pubkey hash');
            expect(
                AddressUtils.snakeToHumanReadable('UNUSED_NESTED_PUBKEY_HASH')
            ).toEqual('Unused nested pubkey hash');
            expect(AddressUtils.snakeToHumanReadable('TAPROOT_PUBKEY')).toEqual(
                'Taproot pubkey'
            );
            expect(
                AddressUtils.snakeToHumanReadable('UNUSED_TAPROOT_PUBKEY')
            ).toEqual('Unused taproot pubkey');
        });
    });

    describe('scriptPubKeyToAddress', () => {
        test('should correctly decode a P2WSH scriptPubKey - mainnet', () => {
            let scriptPubKey, expectedAddress;
            scriptPubKey =
                '002008737603b10129fc2dcb2e5167eb556ba2c84aec6622ff4d46767d186f63150d';
            expectedAddress =
                'bc1qppehvqa3qy5lctwt9egk0664dw3vsjhvvc307n2xwe73smmrz5xs5ckg7p';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '0020a1157ce5620e1e93ad8a98a9765971c89b5920a343add041b47ec34b7302d951';
            expectedAddress =
                'bc1q5y2heetzpc0f8tv2nz5hvkt3ezd4jg9rgwkaqsd50mp5kuczm9gs8v8gxh';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '0020983cca35d586a96de538166552d2773ed291b96a3af65917560ee7eda5e9e106';
            expectedAddress =
                'bc1qnq7v5dw4s65kmefczej495nh8mffrwt28tm9j96kpmn7mf0fuyrq80tshr';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '0020c273ca3b47fcab3a53c9cc4daacfb37d921e62014c794f6d25606f43797fc0f0';
            expectedAddress =
                'bc1qcfeu5w68lj4n557fe3x64nan0kfpucspf3u57mf9vph5x7tlcrcqtgr8cj';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });

        test('should correctly decode a P2SH scriptPubKey - mainnet', () => {
            let scriptPubKey, expectedAddress;
            scriptPubKey = 'a91426101b3dae044fddcd71e6dfe831ebe383f23a5887';
            expectedAddress = '35AGtvgHoBLXncmR8Xtrv7gw34WVqkLLeU';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = 'a914b40fce0fca1eefcec03e61e833bf6326c11ccaf087';
            expectedAddress = '3J76VDefK1m8zpjXEmCK5UNR3mSAN7BcBD';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = 'a9142d2ecbffc89a98365e2b45e90f00d3f6edec68d687';
            expectedAddress = '35ovPgP18XYiRQLNwWyhNequKyyqavs3Sw';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });

        test('should correctly decode a P2WPKH scriptPubKey - mainnet', () => {
            let scriptPubKey, expectedAddress;

            scriptPubKey =
                '00201ff7ed9fecf23980cb3e6d9db8331054942aee8ca34b7190450e20a69ffeeda2';
            expectedAddress =
                'bc1qrlm7m8lv7gucpje7dkwmsvcs2j2z4m5v5d9hryz9pcs2d8l7ak3qasgq03';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = '0014def7b24f3e42b0858240cf3b993a3d44a7f5abe9';
            expectedAddress = 'bc1qmmmmyne7g2cgtqjqeuaejw3agjnlt2lfp7agua';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = '0014e8550bc74d38fd002481339349ed4780cb1d77b3';
            expectedAddress = 'bc1qap2sh36d8r7sqfypxwf5nm28sr936aandruujw';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey = '0014647f217856160110ce3abcc8cc2ec77ff39561ad';
            expectedAddress = 'bc1qv3ljz7zkzcq3pn36hnyvctk80lee2cddu4laeu';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });

        test('should correctly decode a P2TR scriptPubKey - mainnet', () => {
            let scriptPubKey, expectedAddress;

            scriptPubKey =
                '5120fb3c4af6e6471fe9319afcfd25eb3daf2b83e5be7411b1932bb36ed84701337f';
            expectedAddress =
                'bc1plv7y4ahxgu07jvv6ln7jt6ea4u4c8ed7wsgmryetkdhds3cpxdlsk0jcq5';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '512071d18973aa5daf214d500de76c1b860fcac1228260af21a62d5f6eed74cb0547';
            expectedAddress =
                'bc1pw8gcjua2tkhjzn2sphnkcxuxpl9vzg5zvzhjrf3dtahw6axtq4rsymnp0s';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '5120bd6b2524312d1ce75e7e00676b1da2f6b72a846ca767b3009f09b471623a5865';
            expectedAddress =
                'bc1ph44j2fp395wwwhn7qpnkk8dz76mj4prv5anmxqylpx68zc36tpjsfljvmu';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );

            scriptPubKey =
                '5120ad55091d54ca1938cebe01f5435790c352021df23d8153a301cd90d06171ceed';
            expectedAddress =
                'bc1p442sj825egvn3n47q865x4uscdfqy80j8kq48gcpekgdqct3emks35rjff';
            expect(AddressUtils.scriptPubKeyToAddress(scriptPubKey)).toBe(
                expectedAddress
            );
        });

        test('should throw an error for an invalid scriptPubKey (non-hex input)', () => {
            const invalidScriptPubKey = 'invalid_script';
            expect(() => {
                AddressUtils.scriptPubKeyToAddress(invalidScriptPubKey);
            }).toThrow('Unknown scriptPubKey format');
        });

        test('should throw an error for empty scriptPubKey', () => {
            const emptyScriptPubKey = '';
            expect(() => {
                AddressUtils.scriptPubKeyToAddress(emptyScriptPubKey);
            }).toThrow('Unknown scriptPubKey format');
        });
    });

    describe('isValidWithdrawalRequest', () => {
        it('should validate valid withdrawal request strings', () => {
            const validWithdrawalRequest =
                'lnr1qqg24k0v4ygx67zt94pe8dy4vdrj7zszgan4qgqxyfhyvyg6pdvu4tcjvpp7kkal9rp57wj7xv4pl3ajku70rzy3pafqyfcstqssxp3405h56f855566kxfr0rqltj9w3gxp279eqryud6v9tzhjjnpy7pqgykutu3scypzk86nh9deln87f9g9309duehepgs4d7g9gtne05lfwmpfty0sas72rqelsgqr4fmaw7jg7k7fq60xun0cx67nhl8tceq';
            expect(
                AddressUtils.isValidWithdrawalRequest(validWithdrawalRequest)
            ).toBeTruthy();
        });

        it('should validate withdrawal request strings with different lengths', () => {
            const shortWithdrawalRequest =
                'lnr1qqg24k0v4ygx67zt94pe8dy4vdrj7zszgan4qgqxyfhyvyg6pdvu4tcjvpp7kkal9rp57wj7xv4pl3ajku70rzy3pafqyfcstqssxp3405h56f855566kxfr0rqltj9w3gxp279eqryud6v9tzhjjnpy7pqgykutu3scypzk86nh9deln87f9g9309duehepgs4d7g9gtne05lfwmpfty0sas72rqelsgqr4fmaw7jg7k7fq60xun0cx67nhl8tce';
            expect(
                AddressUtils.isValidWithdrawalRequest(shortWithdrawalRequest)
            ).toBeTruthy();
        });

        it("should invalidate strings that don't start with lnr1qqg", () => {
            const invalidString =
                'lnr2qqg24k0v4ygx67zt94pe8dy4vdrj7zszgan4qgqxyfhyvyg6pdvu4tcjvpp7kkal9rp57wj7xv4pl3ajku70rzy3pafqyfcstqssxp3405h56f855566kxfr0rqltj9w3gxp279eqryud6v9tzhjjnpy7pqgykutu3scypzk86nh9deln87f9g9309duehepgs4d7g9gtne05lfwmpfty0sas72rqelsgqr4fmaw7jg7k7fq60xun0cx67nhl8tceq';
            expect(
                AddressUtils.isValidWithdrawalRequest(invalidString)
            ).toBeFalsy();
        });

        it('should invalidate strings with invalid characters', () => {
            const invalidString =
                'lnr1qqg24k0v4ygx67zt94pe8dy4vdrj7zszgan4qgqxyfhyvyg6pdvu4tcjvpp7kkal9rp57wj7xv4pl3ajku70rzy3pafqyfcstqssxp3405h56f855566kxfr0rqltj9w3gxp279eqryud6v9tzhjjnpy7pqgykutu3scypzk86nh9deln87f9g9309duehepgs4d7g9gtne05lfwmpfty0sas72rqelsgqr4fmaw7jg7k7fq60xun0cx67nhl8tce!';
            expect(
                AddressUtils.isValidWithdrawalRequest(invalidString)
            ).toBeFalsy();
        });
    });
});
