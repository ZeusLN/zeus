jest.mock('../stores/ChannelBackupStore', () => ({}));
jest.mock('../stores/LSPStore', () => ({}));
jest.mock('react-native-notifications', () => ({}));

import { invoicesStore } from '../stores/Stores';
import handleAnything, {
    strictUriEncode,
    convertMerchantQRToLightningAddress
} from './handleAnything';

let mockProcessBIP21Uri = jest.fn();
let mockIsValidBitcoinAddress = false;
let mockIsValidLightningPubKey = false;
let mockIsValidLightningPaymentRequest = false;
let mockSupportsOnchainSends = true;
let mockGetLnurlParams = {};

jest.mock('./AddressUtils', () => ({
    processBIP21Uri: (...args: string[]) => mockProcessBIP21Uri(...args),
    isValidBitcoinAddress: () => mockIsValidBitcoinAddress,
    isValidLightningPubKey: () => mockIsValidLightningPubKey,
    isValidLightningPaymentRequest: () => mockIsValidLightningPaymentRequest,
    isValidLightningOffer: () => false,
    isValidLNDHubAddress: () => false,
    processLNDHubAddress: () => ({}),
    isValidNpub: () => false,
    isPsbt: () => false,
    isValidTxHex: () => false
}));
jest.mock('./TorUtils', () => ({}));
jest.mock('./BackendUtils', () => ({
    supportsOnchainSends: () => mockSupportsOnchainSends,
    supportsAccounts: () => false,
    supportsCashuWallet: () => false,
    supportsWithdrawalRequests: () => false
}));
jest.mock('../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} },
    invoicesStore: { getPayReq: jest.fn() },
    settingsStore: { settings: { locale: 'en' } }
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-encrypted-storage', () => ({}));
jest.mock('react-native-fs', () => ({}));
const mockGetLnurlParamsFn = jest.fn();
jest.mock('js-lnurl', () => ({
    getParams: (...args: any[]) => mockGetLnurlParamsFn(...args),
    findlnurl: () => null,
    decodelnurl: () => null
}));

describe('handleAnything', () => {
    beforeEach(() => {
        mockProcessBIP21Uri.mockReset();
        mockIsValidBitcoinAddress = false;
        mockIsValidLightningPubKey = false;
        mockIsValidLightningPaymentRequest = false;
    });

    describe('input sanitization', () => {
        it('should trim whitespace before processing', async () => {
            mockIsValidBitcoinAddress = true;
            mockProcessBIP21Uri.mockReturnValue({ value: 'some address' });

            await handleAnything('  some address  ');
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith('some address');
        });
    });

    describe('bitcoin address', () => {
        it('should return Send screen if not from clipboard', async () => {
            const data = 'test data';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'some address',
                satAmount: 123
            });
            mockIsValidBitcoinAddress = true;

            const result = await handleAnything(data);

            expect(result).toEqual([
                'Send',
                {
                    destination: 'some address',
                    satAmount: 123,
                    transactionType: 'On-chain',
                    isValid: true
                }
            ]);
        });

        it('should return true if from clipboard', async () => {
            const data = 'test data';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'some address',
                satAmount: 123
            });
            mockIsValidBitcoinAddress = true;

            const result = await handleAnything(data, undefined, true);

            expect(result).toEqual(true);
        });
    });

    describe('lightning public key', () => {
        it('should return Send screen if not from clipboard', async () => {
            const data = 'test data';
            mockProcessBIP21Uri.mockReturnValue({ value: 'some public key' });
            mockIsValidLightningPubKey = true;

            const result = await handleAnything(data);

            expect(result).toEqual([
                'Send',
                {
                    destination: 'some public key',
                    transactionType: 'Keysend',
                    isValid: true
                }
            ]);
        });

        it('should return true if from clipboard', async () => {
            const data = 'test data';
            mockProcessBIP21Uri.mockReturnValue({ value: 'some public key' });
            mockIsValidLightningPubKey = true;

            const result = await handleAnything(data, undefined, true);

            expect(result).toEqual(true);
        });
    });

    describe('lightning payment request', () => {
        it('should return PaymentRequest screen and call getPayReq if not from clipboard', async () => {
            const data = 'test data';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'some payment request'
            });
            mockIsValidLightningPaymentRequest = true;

            const result = await handleAnything(data);

            expect(result).toEqual(['PaymentRequest', {}]);
            expect(invoicesStore.getPayReq).toHaveBeenCalledWith(
                'some payment request'
            );
        });

        it('should return true if from clipboard', async () => {
            const data = 'test data';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'some payment request'
            });
            mockIsValidLightningPaymentRequest = true;

            const result = await handleAnything(data, undefined, true);

            expect(result).toEqual(true);
        });
    });

    describe('bitcoin URI with lnurl and backend not supporting on-chain sends', () => {
        it('should return LnurlPay screen if not from clipboard', async () => {
            const data =
                'bitcoin:BC1QUXCS7V556UTNUKU93HSZ7LHHFFLWN9NF2UTQ6N?pj=https://ts.dergigi.com/BTC/pj&lightning=LNURL1DP68GURN8GHJ7ARN9EJX2UN8D9NKJTNRDAKJ7SJ5GVH42J2VFE24YNP0WPSHJTMF9ATKWD622CE953JGWV6XXUMRDPXNVCJ8X4G9GF2CHDF';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'BC1QUXCS7V556UTNUKU93HSZ7LHHFFLWN9NF2UTQ6N',
                lightning:
                    'LNURL1DP68GURN8GHJ7ARN9EJX2UN8D9NKJTNRDAKJ7SJ5GVH42J2VFE24YNP0WPSHJTMF9ATKWD622CE953JGWV6XXUMRDPXNVCJ8X4G9GF2CHDF'
            });
            mockIsValidBitcoinAddress = true;
            mockSupportsOnchainSends = false;
            const lnurlParams = {
                tag: 'payRequest',
                domain: 'ts.dergigi.com'
            };
            mockGetLnurlParamsFn.mockResolvedValue(lnurlParams);

            const result = await handleAnything(data);

            expect(result).toEqual([
                'ChoosePaymentMethod',
                {
                    satAmount: undefined,
                    lightning:
                        'LNURL1DP68GURN8GHJ7ARN9EJX2UN8D9NKJTNRDAKJ7SJ5GVH42J2VFE24YNP0WPSHJTMF9ATKWD622CE953JGWV6XXUMRDPXNVCJ8X4G9GF2CHDF',
                    offer: undefined,
                    value: 'BC1QUXCS7V556UTNUKU93HSZ7LHHFFLWN9NF2UTQ6N'
                }
            ]);
        });

        it('should return true if from clipboard', async () => {
            const data =
                'bitcoin:BC1QUXCS7V556UTNUKU93HSZ7LHHFFLWN9NF2UTQ6N?pj=https://ts.dergigi.com/BTC/pj&lightning=LNURL1DP68GURN8GHJ7ARN9EJX2UN8D9NKJTNRDAKJ7SJ5GVH42J2VFE24YNP0WPSHJTMF9ATKWD622CE953JGWV6XXUMRDPXNVCJ8X4G9GF2CHDF';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'BC1QUXCS7V556UTNUKU93HSZ7LHHFFLWN9NF2UTQ6N',
                lightning:
                    'LNURL1DP68GURN8GHJ7ARN9EJX2UN8D9NKJTNRDAKJ7SJ5GVH42J2VFE24YNP0WPSHJTMF9ATKWD622CE953JGWV6XXUMRDPXNVCJ8X4G9GF2CHDF'
            });
            mockIsValidBitcoinAddress = true;
            mockSupportsOnchainSends = false;

            const result = await handleAnything(data, undefined, true);

            expect(result).toEqual(true);
        });
    });

    describe('bitcoin URI with bolt11 and backend not supporting on-chain sends', () => {
        it('should return PaymentRequest screen and call getPayReq if not from clipboard', async () => {
            const data =
                'bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightning=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U',
                lightning:
                    'LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6'
            });
            mockIsValidBitcoinAddress = true;
            mockSupportsOnchainSends = false;

            const result = await handleAnything(data);

            expect(result).toEqual([
                'ChoosePaymentMethod',
                {
                    satAmount: undefined,
                    lightning:
                        'LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6',
                    offer: undefined,
                    value: 'BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U'
                }
            ]);
        });

        it('should return true if from clipboard', async () => {
            const data =
                'bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightning=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U',
                lightning:
                    'LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6'
            });
            mockIsValidBitcoinAddress = true;
            mockSupportsOnchainSends = false;

            const result = await handleAnything(data, undefined, true);

            expect(result).toEqual(true);
        });
    });

    describe('nested URI schemes - LIGHTNING:lnurlp://', () => {
        beforeEach(() => {
            mockGetLnurlParamsFn.mockReset();
            mockGetLnurlParams = {
                tag: 'payRequest',
                domain: 'demo.lnbits.com',
                callback:
                    'https://demo.lnbits.com/bitcoinswitch/api/v1/lnurl/bD34dEpKaanBiabk7mEo2D',
                minSendable: 1000,
                maxSendable: 100000000
            };
            mockGetLnurlParamsFn.mockResolvedValue(mockGetLnurlParams);
        });

        it.each([
            {
                name: 'uppercase LIGHTNING',
                data: 'LIGHTNING:lnurlp://demo.lnbits.com/bitcoinswitch/api/v1/lnurl/bD34dEpKaanBiabk7mEo2D?pin=13'
            },
            {
                name: 'lowercase lightning',
                data: 'lightning:lnurlp://demo.lnbits.com/bitcoinswitch/api/v1/lnurl/bD34dEpKaanBiabk7mEo2D?pin=13'
            }
        ])(
            'should handle $name scheme and convert to https://',
            async ({ data }) => {
                mockProcessBIP21Uri.mockReturnValue({
                    value: 'lnurlp://demo.lnbits.com/bitcoinswitch/api/v1/lnurl/bD34dEpKaanBiabk7mEo2D?pin=13'
                });

                const result = await handleAnything(data);

                expect(mockGetLnurlParamsFn).toHaveBeenCalledWith(
                    'https://demo.lnbits.com/bitcoinswitch/api/v1/lnurl/bD34dEpKaanBiabk7mEo2D?pin=13'
                );
                expect(result).toEqual([
                    'LnurlPay',
                    {
                        lnurlParams: mockGetLnurlParams,
                        amount: undefined,
                        ecash: false
                    }
                ]);
            }
        );

        it('should handle LIGHTNING:lnurlp:// with .onion address and convert to http://', async () => {
            const data =
                'LIGHTNING:lnurlp://example.onion/api/v1/lnurl/test123';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'lnurlp://example.onion/api/v1/lnurl/test123'
            });

            const onionParams = {
                tag: 'payRequest',
                domain: 'example.onion',
                callback: 'http://example.onion/api/v1/lnurl/test123',
                minSendable: 1000,
                maxSendable: 100000000
            };
            mockGetLnurlParamsFn.mockResolvedValue(onionParams);

            const result = await handleAnything(data);

            expect(mockGetLnurlParamsFn).toHaveBeenCalledWith(
                'http://example.onion/api/v1/lnurl/test123'
            );
            expect(result).toEqual([
                'LnurlPay',
                {
                    lnurlParams: onionParams,
                    amount: undefined,
                    ecash: false
                }
            ]);
        });

        it('should handle LIGHTNING:lnurlw:// (withdraw)', async () => {
            const data = 'LIGHTNING:lnurlw://example.com/api/v1/lnurl/withdraw';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'lnurlw://example.com/api/v1/lnurl/withdraw'
            });

            const withdrawParams = {
                tag: 'withdrawRequest',
                domain: 'example.com',
                k1: 'test-k1-value',
                minWithdrawable: 1000,
                maxWithdrawable: 100000000
            };
            mockGetLnurlParamsFn.mockResolvedValue(withdrawParams);

            const result = await handleAnything(data);

            expect(mockGetLnurlParamsFn).toHaveBeenCalledWith(
                'https://example.com/api/v1/lnurl/withdraw'
            );
            expect(result).toEqual([
                'Receive',
                {
                    lnurlParams: withdrawParams
                }
            ]);
        });

        it('should handle LIGHTNING:lnurlc:// (channel)', async () => {
            const data = 'LIGHTNING:lnurlc://example.com/api/v1/lnurl/channel';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'lnurlc://example.com/api/v1/lnurl/channel'
            });

            const channelParams = {
                tag: 'channelRequest',
                domain: 'example.com',
                k1: 'test-k1-value',
                uri: 'node@example.com:9735'
            };
            mockGetLnurlParamsFn.mockResolvedValue(channelParams);

            const result = await handleAnything(data);

            expect(mockGetLnurlParamsFn).toHaveBeenCalledWith(
                'https://example.com/api/v1/lnurl/channel'
            );
            expect(result).toEqual([
                'LnurlChannel',
                {
                    lnurlParams: channelParams
                }
            ]);
        });

        it('should return true if from clipboard', async () => {
            const data =
                'LIGHTNING:lnurlp://demo.lnbits.com/bitcoinswitch/api/v1/lnurl/bD34dEpKaanBiabk7mEo2D?pin=13';
            mockProcessBIP21Uri.mockReturnValue({
                value: 'lnurlp://demo.lnbits.com/bitcoinswitch/api/v1/lnurl/bD34dEpKaanBiabk7mEo2D?pin=13'
            });

            const result = await handleAnything(data, undefined, true);

            expect(result).toEqual(true);
        });
    });

    describe('convertMerchantQRToLightningAddress', () => {
        it('converts picknpay QR code to lightning address on mainnet', () => {
            const qrContent =
                'http://example.com/za.co.electrum.picknpay/confirm123';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'http%3A%2F%2Fexample.com%2Fza.co.electrum.picknpay%2Fconfirm123@cryptoqr.net'
            );
        });

        it('converts picknpay QR code to lightning address on signet', () => {
            const qrContent =
                'http://example.com/za.co.electrum.picknpay/confirm123';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'signet'
            );
            expect(result).toBe(
                'http%3A%2F%2Fexample.com%2Fza.co.electrum.picknpay%2Fconfirm123@staging.cryptoqr.net'
            );
        });

        it('converts ecentric QR code to lightning address on mainnet', () => {
            const qrContent =
                'http://example.com/za.co.ecentric.payment/confirm456';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'http%3A%2F%2Fexample.com%2Fza.co.ecentric.payment%2Fconfirm456@cryptoqr.net'
            );
        });

        it('converts ecentric QR code to lightning address on regtest', () => {
            const qrContent =
                'http://example.com/za.co.ecentric.payment/confirm456';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'regtest'
            );
            expect(result).toBe(
                'http%3A%2F%2Fexample.com%2Fza.co.ecentric.payment%2Fconfirm456@staging.cryptoqr.net'
            );
        });

        it('encodes special characters in picknpay QR code correctly', () => {
            const qrContent = `http://example.com/za.co.electrum.picknpay?t=4&i=rAT%)=o\\O'Bd2Cl!WXAE('"=7F>)`;
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'http%3A%2F%2Fexample.com%2Fza.co.electrum.picknpay%3Ft%3D4%26i%3DrAT%25%29%3Do%5CO%27Bd2Cl%21WXAE%28%27%22%3D7F%3E%29@cryptoqr.net'
            );
        });

        it('encodes special characters in ecentric QR code correctly', () => {
            const qrContent = `http://example.com/za.co.ecentric.payment?data=test!value*with(special)chars`;
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'http%3A%2F%2Fexample.com%2Fza.co.ecentric.payment%3Fdata%3Dtest%21value%2Awith%28special%29chars@cryptoqr.net'
            );
        });

        it('returns null for QR code that does not match any merchant', () => {
            const qrContent = 'http://example.com/unrelated/merchant';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBeNull();
        });

        it('returns null for empty string', () => {
            const result = convertMerchantQRToLightningAddress('', 'mainnet');
            expect(result).toBeNull();
        });

        it('returns null for null input', () => {
            const result = convertMerchantQRToLightningAddress(
                null as any,
                'mainnet'
            );
            expect(result).toBeNull();
        });

        it('handles picknpay QR code with complex URL parameters', () => {
            const qrContent =
                'http://2.zap.pe?t=6&i=40895:49955:7[34|0.00|3:10[39|ZAR,38|za.co.electrum.picknpay@cryptoqr.net';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'http%3A%2F%2F2.zap.pe%3Ft%3D6%26i%3D40895%3A49955%3A7%5B34%7C0.00%7C3%3A10%5B39%7CZAR%2C38%7Cza.co.electrum.picknpay%40cryptoqr.net@cryptoqr.net'
            );
        });

        it('handles case-insensitive matching for picknpay', () => {
            const qrContent =
                'HTTP://EXAMPLE.COM/ZA.CO.ELECTRUM.PICKNPAY/CONFIRM';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'HTTP%3A%2F%2FEXAMPLE.COM%2FZA.CO.ELECTRUM.PICKNPAY%2FCONFIRM@cryptoqr.net'
            );
        });

        it('handles case-insensitive matching for ecentric', () => {
            const qrContent = 'HTTPS://TEST.COM/ZA.CO.ECENTRIC.PAYMENT/ID123';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'HTTPS%3A%2F%2FTEST.COM%2FZA.CO.ECENTRIC.PAYMENT%2FID123@cryptoqr.net'
            );
        });

        it('converts Zapper QR code with zapper.com domain', () => {
            const qrContent = 'https://zapper.com/payment/12345';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Fzapper.com%2Fpayment%2F12345@cryptoqr.net'
            );
        });

        it('converts Zapper QR code with zap.pe domain', () => {
            const qrContent =
                "http://5.zap.pe?t=4&i=rAT%)=oO'Bd2Cl!WXAE('\"=7F>)";
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'http%3A%2F%2F5.zap.pe%3Ft%3D4%26i%3DrAT%25%29%3DoO%27Bd2Cl%21WXAE%28%27%22%3D7F%3E%29@cryptoqr.net'
            );
        });

        it('converts Zapper QR code with SK- format', () => {
            const qrContent = 'SK-123-45678901234567890123456';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe('SK-123-45678901234567890123456@cryptoqr.net');
        });

        it('converts Zapper QR code with 20 digit format', () => {
            const qrContent = '12345678901234567890';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe('12345678901234567890@cryptoqr.net');
        });

        it('converts Zapper QR code with payat.io domain', () => {
            const qrContent = 'https://payat.io/payment/abc123';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Fpayat.io%2Fpayment%2Fabc123@cryptoqr.net'
            );
        });

        it('converts Zapper QR code with transactionjunction.co.za domain', () => {
            const qrContent = 'https://transactionjunction.co.za/pay/xyz';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Ftransactionjunction.co.za%2Fpay%2Fxyz@cryptoqr.net'
            );
        });

        it('converts Zapper QR code with CRSTPC format', () => {
            const qrContent = 'CRSTPC-1-2-3-4-5';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe('CRSTPC-1-2-3-4-5@cryptoqr.net');
        });

        it('converts Yoyo QR code with wigroup.co domain', () => {
            const qrContent = 'https://rad2.wigroup.co/bill/125468';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Frad2.wigroup.co%2Fbill%2F125468@cryptoqr.net'
            );
        });

        it('converts Yoyo QR code with yoyogroup.co domain', () => {
            const qrContent = 'https://rad2.yoyogroup.co/bill/125468';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Frad2.yoyogroup.co%2Fbill%2F125468@cryptoqr.net'
            );
        });

        it('converts SnapScan QR code', () => {
            const qrContent = 'https://pos-staging.snapscan.io/qr/N0utvgph';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Fpos-staging.snapscan.io%2Fqr%2FN0utvgph@cryptoqr.net'
            );
        });

        it('converts Moneybadger QR code with cryptoqr.net domain', () => {
            const qrContent = 'https://pay.cryptoqr.net/3458967';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Fpay.cryptoqr.net%2F3458967@cryptoqr.net'
            );
        });

        it('converts Checkers/Shoprite QR code with za.co.electrum (excluding picknpay)', () => {
            const qrContent =
                '00020126260008za.co.mp0110847268562627440014za.co.electrum0122+r3YIUYPRcuRzFeKDYRAvA';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                '00020126260008za.co.mp0110847268562627440014za.co.electrum0122%2Br3YIUYPRcuRzFeKDYRAvA@cryptoqr.net'
            );
        });

        it('does not match za.co.electrum.picknpay for Checkers/Shoprite pattern', () => {
            const qrContent =
                '00020126260008za.co.mp0110248723666427530023za.co.electrum.picknpay0122ydgKJviKSomaVw0297RaZw5303710540571.406304CE9C';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                '00020126260008za.co.mp0110248723666427530023za.co.electrum.picknpay0122ydgKJviKSomaVw0297RaZw5303710540571.406304CE9C@cryptoqr.net'
            );
        });

        it('converts Zapper QR code on signet network', () => {
            const qrContent = 'http://2.zap.pe?t=6&i=40895:49955:7';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'signet'
            );
            expect(result).toBe(
                'http%3A%2F%2F2.zap.pe%3Ft%3D6%26i%3D40895%3A49955%3A7@staging.cryptoqr.net'
            );
        });

        it('converts ScanToPay scantopay.io QR code to lightning address on mainnet', () => {
            const qrContent = 'https://app.scantopay.io/qr?qrcode=8784599487';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Fapp.scantopay.io%2Fqr%3Fqrcode%3D8784599487@cryptoqr.net'
            );
        });

        it('converts ScanToPay 10-digit QR code to lightning address on mainnet', () => {
            const qrContent = '0337704903';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe('0337704903@cryptoqr.net');
        });

        it('converts ScanToPay payat.io QR code to lightning address on mainnet', () => {
            const qrContent = 'https://payat.io/payment/12345';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Fpayat.io%2Fpayment%2F12345@cryptoqr.net'
            );
        });

        it('converts ScanToPay UMPQR code to lightning address on mainnet', () => {
            const qrContent = 'UMPQR123456';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe('UMPQR123456@cryptoqr.net');
        });

        it('converts ScanToPay oltio.co.za QR code to lightning address on mainnet', () => {
            const qrContent = 'https://example.oltio.co.za/pay';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'mainnet'
            );
            expect(result).toBe(
                'https%3A%2F%2Fexample.oltio.co.za%2Fpay@cryptoqr.net'
            );
        });

        it('converts ScanToPay easypay QR code to lightning address on signet', () => {
            const qrContent = 'easypay789';
            const result = convertMerchantQRToLightningAddress(
                qrContent,
                'signet'
            );
            expect(result).toBe('easypay789@staging.cryptoqr.net');
        });
    });

    describe('strictUriEncode', () => {
        it('encodes exclamation mark', () => {
            expect(strictUriEncode('unicorn!foobar')).toBe('unicorn%21foobar');
        });

        it('encodes single quote', () => {
            expect(strictUriEncode("unicorn'foobar")).toBe('unicorn%27foobar');
        });

        it('encodes asterisk', () => {
            expect(strictUriEncode('unicorn*foobar')).toBe('unicorn%2Afoobar');
        });

        it('encodes opening parenthesis', () => {
            expect(strictUriEncode('unicorn(foobar')).toBe('unicorn%28foobar');
        });

        it('encodes closing parenthesis', () => {
            expect(strictUriEncode('unicorn)foobar')).toBe('unicorn%29foobar');
        });

        it('encodes multiple special characters', () => {
            expect(strictUriEncode("unicorn!'()*foobar")).toBe(
                'unicorn%21%27%28%29%2Afoobar'
            );
        });

        it('produces different result from encodeURIComponent for asterisk', () => {
            const input = 'unicorn*foobar';
            expect(strictUriEncode(input)).not.toBe(encodeURIComponent(input));
            expect(strictUriEncode(input)).toBe('unicorn%2Afoobar');
            expect(encodeURIComponent(input)).toBe('unicorn*foobar');
        });

        it('handles strings without special characters', () => {
            expect(strictUriEncode('unicornfoobar')).toBe('unicornfoobar');
        });

        it('handles empty string', () => {
            expect(strictUriEncode('')).toBe('');
        });

        it('handles numbers', () => {
            expect(strictUriEncode(123)).toBe('123');
        });

        it('handles boolean values', () => {
            expect(strictUriEncode(true)).toBe('true');
            expect(strictUriEncode(false)).toBe('false');
        });

        it('encodes URL-unsafe characters along with RFC 3986 reserved characters', () => {
            expect(strictUriEncode('hello world!')).toBe('hello%20world%21');
            expect(strictUriEncode('test/path')).toBe('test%2Fpath');
            expect(strictUriEncode('a=b&c=d')).toBe('a%3Db%26c%3Dd');
            expect(strictUriEncode('test?query')).toBe('test%3Fquery');
        });

        it('handles Unicode characters', () => {
            expect(strictUriEncode('测试')).toBe('%E6%B5%8B%E8%AF%95');
            expect(strictUriEncode('hello!测试')).toBe(
                'hello%21%E6%B5%8B%E8%AF%95'
            );
        });

        it('encodes Zapper QR code with special characters correctly', () => {
            const qrContent = `http://5.zap.pe?t=4&i=rAT%)=o\\O'Bd2Cl!WXAE('"=7F>)aN!<>?YJ-3ad!l+gR:Ms_d6t(?\`:Msuo(3!l"AoVg2Gq^paT]Z?Y"98E32\`WZS1,L\`f!!!'g('4I;"u.qo!!3-#/*^XK!!-%alYMQ:O@#?E!<<*"!!-5+`;
            const expected =
                'http%3A%2F%2F5.zap.pe%3Ft%3D4%26i%3DrAT%25%29%3Do%5CO%27Bd2Cl%21WXAE%28%27%22%3D7F%3E%29aN%21%3C%3E%3FYJ-3ad%21l%2BgR%3AMs_d6t%28%3F%60%3AMsuo%283%21l%22AoVg2Gq%5EpaT%5DZ%3FY%2298E32%60WZS1%2CL%60f%21%21%21%27g%28%274I%3B%22u.qo%21%213-%23%2F%2A%5EXK%21%21-%25alYMQ%3AO%40%23%3FE%21%3C%3C%2A%22%21%21-5%2B';
            expect(strictUriEncode(qrContent)).toBe(expected);
        });
    });
});
