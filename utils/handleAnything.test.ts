jest.mock('../stores/ChannelBackupStore', () => ({}));
jest.mock('../stores/LSPStore', () => ({}));
jest.mock('react-native-notifications', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
}));

import { invoicesStore } from '../stores/Stores';
import handleAnything, {
    strictUriEncode,
    convertMerchantQRToLightningAddress,
    isMerchantQR
} from './handleAnything';

let mockProcessBIP21Uri = jest.fn();
let mockIsValidBitcoinAddress = false;
let mockIsValidLightningPubKey = false;
let mockIsValidLightningPaymentRequest = false;
let mockIsValidLightningAddress = false;
let mockIsValidLightningOffer = false;
let mockIsValidLNDHubAddress = false;
let mockProcessLNDHubAddress = jest.fn();
let mockSupportsOnchainSends = true;
let mockGetLnurlParams = {};
let mockBlobUtilFetch = jest.fn();

const ZEUS_ECASH_GIFT_URL = 'https://zeusln.com/e/';
jest.mock('./AddressUtils', () => ({
    processBIP21Uri: (...args: string[]) => mockProcessBIP21Uri(...args),
    isValidBitcoinAddress: () => mockIsValidBitcoinAddress,
    isValidLightningPubKey: () => mockIsValidLightningPubKey,
    isValidLightningPaymentRequest: () => mockIsValidLightningPaymentRequest,
    isValidLightningAddress: () => mockIsValidLightningAddress,
    isValidLightningOffer: () => mockIsValidLightningOffer,
    isValidLNDHubAddress: () => mockIsValidLNDHubAddress,
    processLNDHubAddress: (...args: any[]) => mockProcessLNDHubAddress(...args),
    isValidNpub: () => false,
    isPsbt: () => false,
    isValidTxHex: () => false,
    ZEUS_ECASH_GIFT_URL
}));
jest.mock('./TorUtils', () => ({}));
jest.mock('./BackendUtils', () => ({
    supportsOnchainSends: () => mockSupportsOnchainSends,
    supportsAccounts: () => false,
    supportsCashuWallet: () => false,
    supportsWithdrawalRequests: () => false,
    supportsLnurlAuth: () => false
}));

let mockIsValidCashuToken = false;
let mockDecodedCashuToken = {};
jest.mock('./CashuUtils', () => ({
    isValidCashuToken: () => mockIsValidCashuToken,
    isValidCashuTokenAsync: () => Promise.resolve(mockIsValidCashuToken),
    decodeCashuTokenAsync: () => Promise.resolve(mockDecodedCashuToken)
}));

const mockProcessLndConnectUrl = jest.fn();
const mockProcessCLNRestConnectUrl = jest.fn();
const mockProcessLncUrl = jest.fn();
let mockIsValidNodeUri = false;
const mockProcessNodeUri = jest.fn();
jest.mock('./NodeUriUtils', () => ({
    isValidNodeUri: () => mockIsValidNodeUri,
    processNodeUri: (...args: any[]) => mockProcessNodeUri(...args)
}));
jest.mock('./ConnectionFormatUtils', () => ({
    processLndConnectUrl: (...args: any[]) => mockProcessLndConnectUrl(...args),
    processCLNRestConnectUrl: (...args: any[]) =>
        mockProcessCLNRestConnectUrl(...args),
    processLncUrl: (...args: any[]) => mockProcessLncUrl(...args)
}));
jest.mock('../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} },
    invoicesStore: { getPayReq: jest.fn() },
    settingsStore: { settings: { locale: 'en' } }
}));
jest.mock('react-native-blob-util', () => ({
    fetch: (...args: any[]) => mockBlobUtilFetch(...args)
}));
jest.mock('react-native-encrypted-storage', () => ({}));
jest.mock('react-native-fs', () => ({}));
const mockGetLnurlParamsFn = jest.fn();
const mockFindLnurl = jest.fn();
jest.mock('js-lnurl', () => ({
    getParams: (...args: any[]) => mockGetLnurlParamsFn(...args),
    findlnurl: (...args: any[]) => mockFindLnurl(...args),
    decodelnurl: () => null
}));

describe('handleAnything', () => {
    beforeEach(() => {
        mockProcessBIP21Uri.mockReset();
        mockBlobUtilFetch.mockReset();
        mockProcessLNDHubAddress.mockReset();
        mockProcessLndConnectUrl.mockReset();
        mockProcessCLNRestConnectUrl.mockReset();
        mockProcessLncUrl.mockReset();
        mockProcessNodeUri.mockReset();
        mockGetLnurlParamsFn.mockReset();
        mockFindLnurl.mockReset();
        mockIsValidBitcoinAddress = false;
        mockIsValidLightningPubKey = false;
        mockIsValidLightningPaymentRequest = false;
        mockIsValidLightningAddress = false;
        mockIsValidLightningOffer = false;
        mockIsValidLNDHubAddress = false;
        mockIsValidNodeUri = false;
        mockIsValidCashuToken = false;
        mockDecodedCashuToken = {};
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

    describe('Lightning Address username casing', () => {
        it('preserves uppercase URL-encoded hex digits for cryptoqr.net addresses', async () => {
            const address =
                'https%3A%2F%2Fpay.cryptoqr.net%2F3458967@cryptoqr.net';
            mockProcessBIP21Uri.mockReturnValue({ value: address });
            mockIsValidLightningAddress = true;
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({ callback: 'https://cryptoqr.net/callback' })
            });

            await handleAnything(address);

            expect(mockBlobUtilFetch).toHaveBeenCalledWith(
                'get',
                'https://cryptoqr.net/.well-known/lnurlp/https%3A%2F%2Fpay.cryptoqr.net%2F3458967'
            );
        });

        it('preserves uppercase URL-encoded hex digits for staging.cryptoqr.net addresses', async () => {
            const address =
                'https%3A%2F%2Fpay.cryptoqr.net%2F3458967@staging.cryptoqr.net';
            mockProcessBIP21Uri.mockReturnValue({ value: address });
            mockIsValidLightningAddress = true;
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({
                    callback: 'https://staging.cryptoqr.net/callback'
                })
            });

            await handleAnything(address);

            expect(mockBlobUtilFetch).toHaveBeenCalledWith(
                'get',
                'https://staging.cryptoqr.net/.well-known/lnurlp/https%3A%2F%2Fpay.cryptoqr.net%2F3458967'
            );
        });

        it('handles uppercase cryptoqr.net domain (case-insensitive detection)', async () => {
            const address =
                'https%3A%2F%2Fpay.cryptoqr.net%2F3458967@CRYPTOQR.NET';
            mockProcessBIP21Uri.mockReturnValue({ value: address });
            mockIsValidLightningAddress = true;
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({ callback: 'https://cryptoqr.net/callback' })
            });

            await handleAnything(address);

            // Domain should be lowercased per LUD-16, username preserved for cryptoqr.net
            expect(mockBlobUtilFetch).toHaveBeenCalledWith(
                'get',
                'https://cryptoqr.net/.well-known/lnurlp/https%3A%2F%2Fpay.cryptoqr.net%2F3458967'
            );
        });

        it('lowercases username for standard Lightning Address domains', async () => {
            const address = 'SatoshiNakamoto@example.com';
            mockProcessBIP21Uri.mockReturnValue({ value: address });
            mockIsValidLightningAddress = true;
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({ callback: 'https://example.com/callback' })
            });

            await handleAnything(address);

            expect(mockBlobUtilFetch).toHaveBeenCalledWith(
                'get',
                'https://example.com/.well-known/lnurlp/satoshinakamoto'
            );
        });

        it('lowercases domain per LUD-16 spec', async () => {
            const address = 'satoshi@EXAMPLE.COM';
            mockProcessBIP21Uri.mockReturnValue({ value: address });
            mockIsValidLightningAddress = true;
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({ callback: 'https://example.com/callback' })
            });

            await handleAnything(address);

            // Both domain and username should be lowercased for standard addresses
            expect(mockBlobUtilFetch).toHaveBeenCalledWith(
                'get',
                'https://example.com/.well-known/lnurlp/satoshi'
            );
        });
    });

    describe('node configuration handling', () => {
        it('should handle lndhub:// URLs', async () => {
            const lndhubUrl =
                'lndhub://admin:password@https://lndhub.example.com';
            mockProcessBIP21Uri.mockReturnValue({ value: lndhubUrl });
            mockIsValidLNDHubAddress = true;
            mockProcessLNDHubAddress.mockReturnValue({
                username: 'admin',
                password: 'password',
                host: 'https://lndhub.example.com'
            });

            const result = await handleAnything(lndhubUrl);

            expect(result).toEqual([
                'WalletConfiguration',
                {
                    node: {
                        implementation: 'lndhub',
                        username: 'admin',
                        password: 'password',
                        lndhubUrl: 'https://lndhub.example.com',
                        certVerification: true,
                        enableTor: false,
                        existingAccount: true
                    },
                    newEntry: true,
                    isValid: true
                }
            ]);
        });

        it('should handle lndconnect URLs', async () => {
            const lndconnectUrl =
                'lndconnect://mynode.local:10009?cert=abc&macaroon=xyz';
            mockProcessBIP21Uri.mockReturnValue({ value: lndconnectUrl });
            mockProcessLndConnectUrl.mockReturnValue({
                host: 'https://mynode.local',
                port: '10009',
                macaroonHex: 'abc123',
                enableTor: false
            });

            const result = await handleAnything(lndconnectUrl);

            expect(result).toEqual([
                'WalletConfiguration',
                {
                    node: {
                        host: 'https://mynode.local',
                        port: '10009',
                        macaroonHex: 'abc123',
                        enableTor: false
                    },
                    enableTor: false,
                    newEntry: true,
                    isValid: true
                }
            ]);
        });

        it('should handle clnrest:// URLs', async () => {
            const clnrestUrl = 'clnrest://mynode.local:3010?rune=abc123';
            mockProcessBIP21Uri.mockReturnValue({ value: clnrestUrl });
            mockProcessCLNRestConnectUrl.mockReturnValue({
                host: 'https://mynode.local',
                port: '3010',
                rune: 'abc123',
                implementation: 'cln-rest',
                enableTor: false
            });

            const result = await handleAnything(clnrestUrl);

            expect(result).toEqual([
                'WalletConfiguration',
                {
                    node: {
                        host: 'https://mynode.local',
                        port: '3010',
                        rune: 'abc123',
                        implementation: 'cln-rest',
                        enableTor: false
                    },
                    newEntry: true,
                    isValid: true
                }
            ]);
        });

        it('should handle clnrest+ URLs', async () => {
            const clnrestUrl = 'clnrest+https://mynode.local:3010?rune=abc123';
            mockProcessBIP21Uri.mockReturnValue({ value: clnrestUrl });
            mockProcessCLNRestConnectUrl.mockReturnValue({
                host: 'https://mynode.local',
                port: '3010',
                rune: 'abc123',
                implementation: 'cln-rest',
                enableTor: false
            });

            const result = await handleAnything(clnrestUrl);

            expect(result).toEqual([
                'WalletConfiguration',
                {
                    node: {
                        host: 'https://mynode.local',
                        port: '3010',
                        rune: 'abc123',
                        implementation: 'cln-rest',
                        enableTor: false
                    },
                    newEntry: true,
                    isValid: true
                }
            ]);
        });

        it('should handle nostr+walletconnect:// URLs', async () => {
            const nwcUrl =
                'nostr+walletconnect://abc123?relay=wss://relay.example.com&secret=xyz';
            mockProcessBIP21Uri.mockReturnValue({ value: nwcUrl });

            const result = await handleAnything(nwcUrl);

            expect(result).toEqual([
                'WalletConfiguration',
                {
                    node: {
                        nostrWalletConnectUrl: nwcUrl,
                        implementation: 'nostr-wallet-connect'
                    },
                    newEntry: true,
                    isValid: true
                }
            ]);
        });

        it('should handle Lightning Terminal connect URLs', async () => {
            const lncUrl =
                'https://terminal.lightning.engineering#/connect/pair/abc123';
            mockProcessBIP21Uri.mockReturnValue({ value: lncUrl });
            mockProcessLncUrl.mockReturnValue({
                pairingPhrase: 'word1 word2 word3',
                mailboxServer: 'lnc.zeusln.app:443',
                customMailboxServer: undefined
            });

            const result = await handleAnything(lncUrl);

            expect(result).toEqual([
                'WalletConfiguration',
                {
                    node: {
                        pairingPhrase: 'word1 word2 word3',
                        mailboxServer: 'lnc.zeusln.app:443',
                        customMailboxServer: undefined,
                        implementation: 'lightning-node-connect'
                    },
                    newEntry: true,
                    isValid: true
                }
            ]);
        });

        it('should return true for lndhub:// from clipboard', async () => {
            const lndhubUrl =
                'lndhub://admin:password@https://lndhub.example.com';
            mockProcessBIP21Uri.mockReturnValue({ value: lndhubUrl });
            mockIsValidLNDHubAddress = true;
            mockProcessLNDHubAddress.mockReturnValue({
                username: 'admin',
                password: 'password',
                host: 'https://lndhub.example.com'
            });

            const result = await handleAnything(lndhubUrl, undefined, true);

            expect(result).toBe(true);
        });

        it('should return true for lndconnect from clipboard', async () => {
            const lndconnectUrl =
                'lndconnect://mynode.local:10009?cert=abc&macaroon=xyz';
            mockProcessBIP21Uri.mockReturnValue({ value: lndconnectUrl });
            mockProcessLndConnectUrl.mockReturnValue({
                host: 'https://mynode.local',
                port: '10009',
                macaroonHex: 'abc123',
                enableTor: false
            });

            const result = await handleAnything(lndconnectUrl, undefined, true);

            expect(result).toBe(true);
        });

        it('should correctly handle merchant QR codes via recursive call', async () => {
            // Test that merchant QR codes are converted and handled as lightning addresses
            const merchantQR = 'https://zapper.com/payment/12345';
            // First call: original merchant QR - not a valid lightning address
            // Second call (recursive): converted lightning address - IS valid
            mockProcessBIP21Uri
                .mockReturnValueOnce({ value: merchantQR })
                .mockReturnValueOnce({
                    value: 'https%3A%2F%2Fzapper.com%2Fpayment%2F12345@cryptoqr.net'
                });
            mockIsValidLightningAddress = true;
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({ callback: 'https://cryptoqr.net/callback' })
            });

            const result = await handleAnything(merchantQR);

            // The converted address should be used for lnurlp lookup
            expect(mockBlobUtilFetch).toHaveBeenCalledWith(
                'get',
                'https://cryptoqr.net/.well-known/lnurlp/https%3A%2F%2Fzapper.com%2Fpayment%2F12345'
            );
            expect(result).toEqual([
                'LnurlPay',
                {
                    lnurlParams: { callback: 'https://cryptoqr.net/callback' },
                    satAmount: undefined,
                    ecash: false,
                    lightningAddress:
                        'https%3A%2F%2Fzapper.com%2Fpayment%2F12345@cryptoqr.net'
                }
            ]);
        });
    });

    // Regression tests: These tests would have FAILED on master where merchant QR
    // conversion happened at the start of handleAnything, before node config checks.
    // Node configs containing digit sequences that match merchant patterns like
    // \d{10} or \d{20} would have been incorrectly converted to lightning addresses.
    describe('regression: node configs with digit patterns should not be converted to merchant QR', () => {
        // These tests verify the bug fixed in ZEUS-3571:
        // On master, convertMerchantQRToLightningAddress was called FIRST, converting
        // node config URLs (that contain 10+ digit sequences) into cryptoqr.net addresses.
        // The fix moves merchant QR handling to the END, after node config handlers.
        //
        // To properly catch the regression, we make processBIP21Uri return { value: input }
        // so if the URL was converted to a merchant address first, the test will fail.

        it('should handle lndhub URL with 10+ digit password (matches \\d{10} pattern)', async () => {
            // This URL contains 10+ consecutive digits which matches merchant pattern \d{10}
            // On master, this would have been converted to a cryptoqr.net lightning address
            const lndhubUrl =
                'lndhub://admin:12345678901234@https://lndhub.example.com';
            // Make mock return whatever input it receives - catches conversion bug
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockIsValidLNDHubAddress = true;
            mockProcessLNDHubAddress.mockReturnValue({
                username: 'admin',
                password: '12345678901234',
                host: 'https://lndhub.example.com'
            });

            const result = await handleAnything(lndhubUrl);

            // Verify processBIP21Uri was called with the ORIGINAL URL, not a converted one
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(lndhubUrl);
            // Should be handled as lndhub, NOT converted to merchant QR
            expect(result[0]).toBe('WalletConfiguration');
            expect(result[1].node.implementation).toBe('lndhub');
        });

        it('should handle lndconnect URL with 10+ digit cert param (matches \\d{10} pattern)', async () => {
            // URL contains 10+ consecutive digits in cert parameter
            const lndconnectUrl =
                'lndconnect://192.168.1.100:10009?cert=12345678901234&macaroon=xyz';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockProcessLndConnectUrl.mockReturnValue({
                host: 'https://192.168.1.100',
                port: '10009',
                macaroonHex: 'abc123',
                enableTor: false
            });

            const result = await handleAnything(lndconnectUrl);

            // Verify processBIP21Uri was called with the ORIGINAL URL
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(lndconnectUrl);
            // Should be handled as lndconnect, NOT converted to merchant QR
            expect(result[0]).toBe('WalletConfiguration');
            expect(result[1].node.host).toBe('https://192.168.1.100');
        });

        it('should handle BTCPay config URL with digit sequences (matches \\d{10} pattern)', async () => {
            // BTCPay config URL containing 10+ digit sequence in port
            const btcPayUrl =
                'config=https://btcpay.example.com:12345678901/lnd.config';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));

            const { settingsStore } = require('../stores/Stores');
            settingsStore.fetchBTCPayConfig = jest.fn().mockResolvedValue({
                host: 'https://btcpay.example.com',
                port: '8080',
                macaroonHex: 'abc123'
            });
            settingsStore.btcPayError = null;

            const result = await handleAnything(btcPayUrl);

            // Verify processBIP21Uri was called with the ORIGINAL URL
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(btcPayUrl);
            // Should be handled as BTCPay config, NOT converted to merchant QR
            expect(result[0]).toBe('WalletConfiguration');
            expect(settingsStore.fetchBTCPayConfig).toHaveBeenCalledWith(
                btcPayUrl
            );
        });

        it('should handle clnrest URL with 20+ digit rune (matches \\d{20} pattern)', async () => {
            // CLNRest URL with rune containing 20+ consecutive digits
            const clnrestUrl =
                'clnrest://mynode.local:3010?rune=12345678901234567890abcdef';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockProcessCLNRestConnectUrl.mockReturnValue({
                host: 'https://mynode.local',
                port: '3010',
                rune: '12345678901234567890abcdef',
                implementation: 'cln-rest',
                enableTor: false
            });

            const result = await handleAnything(clnrestUrl);

            // Verify processBIP21Uri was called with the ORIGINAL URL
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(clnrestUrl);
            // Should be handled as clnrest, NOT converted to merchant QR
            expect(result[0]).toBe('WalletConfiguration');
            expect(result[1].node.implementation).toBe('cln-rest');
        });

        it('should handle nostr+walletconnect URL with digit sequences', async () => {
            // NWC URL that contains digit sequences
            const nwcUrl =
                'nostr+walletconnect://12345678901234567890?relay=wss://relay.example.com&secret=xyz';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));

            const result = await handleAnything(nwcUrl);

            // Verify processBIP21Uri was called with the ORIGINAL URL
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(nwcUrl);
            // Should be handled as NWC, NOT converted to merchant QR
            expect(result[0]).toBe('WalletConfiguration');
            expect(result[1].node.implementation).toBe('nostr-wallet-connect');
        });

        it('should handle Lightning Terminal URL with digit sequences', async () => {
            // LNC URL with digits in the pairing phrase
            const lncUrl =
                'https://terminal.lightning.engineering#/connect/pair/12345678901234567890';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockProcessLncUrl.mockReturnValue({
                pairingPhrase: '12345678901234567890',
                mailboxServer: 'lnc.zeusln.app:443',
                customMailboxServer: undefined
            });

            const result = await handleAnything(lncUrl);

            // Verify processBIP21Uri was called with the ORIGINAL URL
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(lncUrl);
            // Should be handled as LNC, NOT converted to merchant QR
            expect(result[0]).toBe('WalletConfiguration');
            expect(result[1].node.implementation).toBe(
                'lightning-node-connect'
            );
        });

        it('should handle Node URI with pubkey containing 10+ consecutive digits', async () => {
            // Pubkeys are hex strings that could contain sequences like 1234567890
            // This should be handled as a node URI for opening channels, not merchant QR
            const nodeUri =
                '031234567890123456789012345678901234567890123456789012345678901234@mynode.local:9735';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockIsValidNodeUri = true;
            mockProcessNodeUri.mockReturnValue({
                pubkey: '031234567890123456789012345678901234567890123456789012345678901234',
                host: 'mynode.local:9735'
            });

            const result = await handleAnything(nodeUri);

            // Verify processBIP21Uri was called with the ORIGINAL URI
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(nodeUri);
            // Should be handled as Node URI for OpenChannel, NOT converted to merchant QR
            expect(result[0]).toBe('OpenChannel');
            expect(result[1].node_pubkey_string).toBe(
                '031234567890123456789012345678901234567890123456789012345678901234'
            );
            expect(result[1].host).toBe('mynode.local:9735');
        });

        it('should handle BOLT 12 offer with digit sequences (bech32 can contain digits)', async () => {
            // BOLT 12 offers are bech32 encoded and could theoretically contain 10+ digits
            // This should be handled as a BOLT 12 offer, not merchant QR
            const bolt12Offer =
                'lno1qcp4256ypqpq8e2m50ypqkx6td9ec8qamp5l234567890123qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockIsValidLightningOffer = true;

            const result = await handleAnything(bolt12Offer);

            // Verify processBIP21Uri was called with the ORIGINAL offer
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(bolt12Offer);
            // Should be handled as BOLT 12 offer, NOT converted to merchant QR
            expect(result[0]).toBe('Send');
            expect(result[1].transactionType).toBe('BOLT 12');
            expect(result[1].bolt12).toBe(bolt12Offer);
        });

        it('should handle LNURL with digit sequences', async () => {
            // LNURL strings are bech32 encoded and could contain digit sequences
            // This should be handled as LNURL, not merchant QR
            const lnurl =
                'lnurl1dp68gurn8ghj7em9w3skccne9e3k7mf0d3h82unv1234567890123456789wejhxumfdahxgatrdanx';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockFindLnurl.mockReturnValue(lnurl);
            mockGetLnurlParamsFn.mockResolvedValue({
                tag: 'payRequest',
                callback: 'https://example.com/callback',
                minSendable: 1000,
                maxSendable: 100000000
            });

            const result = await handleAnything(lnurl);

            // Verify processBIP21Uri was called with the ORIGINAL lnurl
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(lnurl);
            // Should be handled as LNURL pay, NOT converted to merchant QR
            expect(result[0]).toBe('LnurlPay');
            expect(result[1].lnurlParams.tag).toBe('payRequest');
        });

        it('should handle LNURL-withdraw with digit sequences', async () => {
            // LNURL-withdraw should also not be converted to merchant QR
            const lnurlWithdraw =
                'lnurl1dp68gurn8ghj7em9w3skccne9e3k7mf0wpshjmt9de6zqvf01234567890withdraw';
            mockProcessBIP21Uri.mockImplementation((input: string) => ({
                value: input
            }));
            mockFindLnurl.mockReturnValue(lnurlWithdraw);
            mockGetLnurlParamsFn.mockResolvedValue({
                tag: 'withdrawRequest',
                callback: 'https://example.com/withdraw',
                k1: 'abc123',
                minWithdrawable: 1000,
                maxWithdrawable: 100000000
            });

            const result = await handleAnything(lnurlWithdraw);

            // Verify processBIP21Uri was called with the ORIGINAL lnurl
            expect(mockProcessBIP21Uri).toHaveBeenCalledWith(lnurlWithdraw);
            // Should be handled as LNURL withdraw, NOT converted to merchant QR
            expect(result[0]).toBe('Receive');
            expect(result[1].lnurlParams.tag).toBe('withdrawRequest');
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

    describe('isMerchantQR', () => {
        it('returns true for Pick n Pay QR codes', () => {
            expect(
                isMerchantQR(
                    'http://example.com/za.co.electrum.picknpay/confirm123'
                )
            ).toBe(true);
        });

        it('returns true for Ecentric QR codes', () => {
            expect(
                isMerchantQR(
                    'http://example.com/za.co.ecentric.payment/confirm456'
                )
            ).toBe(true);
        });

        it('returns true for Zapper QR codes', () => {
            expect(isMerchantQR('https://zapper.com/payment/12345')).toBe(true);
            expect(isMerchantQR('http://5.zap.pe?t=4&i=test')).toBe(true);
            expect(isMerchantQR('SK-123-45678901234567890123456')).toBe(true);
            expect(isMerchantQR('12345678901234567890')).toBe(true);
            expect(isMerchantQR('CRSTPC-1-2-3-4-5')).toBe(true);
        });

        it('returns true for SnapScan QR codes', () => {
            expect(
                isMerchantQR('https://pos-staging.snapscan.io/qr/N0utvgph')
            ).toBe(true);
        });

        it('returns true for CryptoQR QR codes', () => {
            expect(isMerchantQR('https://pay.cryptoqr.net/3458967')).toBe(true);
        });

        it('returns true for ScanToPay QR codes', () => {
            expect(
                isMerchantQR('https://app.scantopay.io/qr?qrcode=8784599487')
            ).toBe(true);
            expect(isMerchantQR('0337704903')).toBe(true);
            expect(isMerchantQR('UMPQR123456')).toBe(true);
            expect(isMerchantQR('easypay789')).toBe(true);
        });

        it('returns false for null/empty input', () => {
            expect(isMerchantQR('')).toBe(false);
            expect(isMerchantQR(null as any)).toBe(false);
            expect(isMerchantQR(undefined as any)).toBe(false);
        });

        it('returns false for node configuration URLs', () => {
            expect(
                isMerchantQR('lndhub://admin:password@https://lndhub.io')
            ).toBe(false);
            expect(
                isMerchantQR(
                    'lndconnect://mynode.local:10009?cert=abc&macaroon=xyz'
                )
            ).toBe(false);
            expect(
                isMerchantQR('clnrest://mynode.local:3010?rune=abc123')
            ).toBe(false);
            expect(
                isMerchantQR(
                    'nostr+walletconnect://abc123?relay=wss://relay.example.com'
                )
            ).toBe(false);
            expect(
                isMerchantQR(
                    'https://terminal.lightning.engineering#/connect/pair/abc123'
                )
            ).toBe(false);
        });

        it('returns false for lightning addresses', () => {
            expect(isMerchantQR('satoshi@example.com')).toBe(false);
            expect(isMerchantQR('user@getalby.com')).toBe(false);
        });

        it('returns false for bitcoin addresses', () => {
            expect(
                isMerchantQR('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')
            ).toBe(false);
            expect(isMerchantQR('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(
                false
            );
        });

        it('returns false for lightning invoices', () => {
            expect(
                isMerchantQR(
                    'lnbc10u1p3pj257pp5yztkwjcz5ftl5laxkav23zmzekaw37zk6kmv80pk4xaev5qhtz7q'
                )
            ).toBe(false);
        });

        it('returns false for LNURL strings', () => {
            expect(
                isMerchantQR(
                    'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns'
                )
            ).toBe(false);
        });
    });

    // IMPORTANT: zeusln.com/e/ URLs must be checked BEFORE the lnurl block in handleAnything,
    // because findlnurl() from js-lnurl can match patterns in Cashu tokens that look like bech32 lnurls.
    // These tests verify the correct route is returned when findlnurl might otherwise match.
    describe('zeusln.com ecash gift URLs', () => {
        const validCashuToken =
            'cashuBo2FteCJodHRwczovL21pbnQubWluaWJpdHMuY2FzaC9CaXRjb2luYXVjc2F0YXSComFpSAAQeTfbDMhlYXCCpGFhCGFzeEAxOWQ3YmRiNTIwMzRmOWQ5OGQwZTU5OTEwM2FkMTlmZTAyODc1ODQ2MThlYmViYTFkNzExM2FiMjI4MDM0YjNlYWNYIQI5u9Nss3cyYXJoLTwRMY4qgCNL7-J7EtBFnGOIeq6tcWFko2FlWCBYlzHfzFSuLuI31zvZGHme0QGeeEjNoGhIs6l2fbbHH2FzWCA2ecAUKZWjtQagWP7wOUVRgsHYlyOG7CUhUFdQjUed2GFyWCC67afI6qoB6bISgCWK24JOdD_-gxUyaSrgfrZJmHsBh6RhYQRhc3hANWYzMGRlMDA1NjVkYTRhZDg2Yzk1MzljYzYzMGE3NTBlYWU2OTJiY2Q5ODgwMWI0OTI0NDA1ZDAxN2UzNGE5MWFjWCECN8hTvJgIFBwN0QY3prfyf4z7BxPVLBPptzKcnb_OupNhZKNhZVggcx4XGwTyM4riizWgckD44KUJQtKHUGGjHIJHFKdPE31hc1ggqASxqD7ZTbA59c7SAHgQvLdLq_xYLL2rAVr2ziIGfkRhclgg-bTi6nbDj8Mdq9rnKhAGgrQ4w6ihk9pvu9xUommg6V-iYWlIAFAFUPBJQUZhcIGkYWEEYXN4QDBlMzhhZWIxYzIxMTk1N2U5Njg4YTdlY2YzNzQ4Y2E2MTA0MDMzNmZjZWJmMzE4M2EwMDAwOWFiYzJiMjcxNWFhY1ghAu0yuRBFejZTitq8LJufeiB2CUAEk-pHTIWqYtFcqtCSYWSjYWVYIDhNUWOMw2xaCZT4Ob8bdV5CxkErkHh-m2XUUqCKZS3WYXNYIBUltNlKIUTrHi4M1Z8SL3l3_EPp-5eOPltdS648bpVGYXJYIFZdUQc6c-waYIhOMSS_-cS19HiHZn4xZe4s65dGN8u5';

        it('should route to CashuToken view for valid zeusln.com/e/ URL', async () => {
            const url = `${ZEUS_ECASH_GIFT_URL}${validCashuToken}`;
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = true;
            mockDecodedCashuToken = {
                token: [
                    {
                        mint: 'https://mint.minibits.cash/Bitcoin',
                        proofs: [{ amount: 8 }, { amount: 4 }, { amount: 4 }]
                    }
                ],
                unit: 'sat'
            };

            const result = await handleAnything(url);

            expect(result).toEqual([
                'CashuToken',
                {
                    token: validCashuToken,
                    decoded: expect.any(Object)
                }
            ]);
        });

        it('should route to CashuToken even when findlnurl would match token content', async () => {
            // This test simulates the bug where findlnurl matched patterns in Cashu tokens
            const url = `${ZEUS_ECASH_GIFT_URL}${validCashuToken}`;
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = true;
            mockDecodedCashuToken = {
                token: [
                    {
                        mint: 'https://mint.minibits.cash/Bitcoin',
                        proofs: [{ amount: 16 }]
                    }
                ],
                unit: 'sat'
            };
            // Simulate findlnurl returning a match (which would happen with some Cashu tokens)
            mockFindLnurl.mockReturnValue('lnurl1somefalsepositive');

            const result = await handleAnything(url);

            // Should still route to CashuToken, NOT to lnurl handling
            expect(result).toEqual([
                'CashuToken',
                {
                    token: validCashuToken,
                    decoded: expect.any(Object)
                }
            ]);
        });

        it('should return true for valid zeusln.com/e/ URL from clipboard', async () => {
            const url = `${ZEUS_ECASH_GIFT_URL}${validCashuToken}`;
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = true;
            mockDecodedCashuToken = {
                token: [
                    {
                        mint: 'https://mint.minibits.cash/Bitcoin',
                        proofs: [{ amount: 16 }]
                    }
                ],
                unit: 'sat'
            };

            const result = await handleAnything(url, undefined, true);

            expect(result).toBe(true);
        });

        it('should route to CashuToken for V3 token (cashuA prefix)', async () => {
            const simpleToken =
                'cashuAeyJ0b2tlbiI6IFt7InByb29mcyI6IFtdLCAibWludCI6ICJodHRwczovL21pbnQuZXhhbXBsZS5jb20ifV19';
            const url = `${ZEUS_ECASH_GIFT_URL}${simpleToken}`;
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = true;
            mockDecodedCashuToken = {
                token: [
                    {
                        mint: 'https://mint.example.com',
                        proofs: []
                    }
                ]
            };

            const result = await handleAnything(url);

            expect(result).toEqual([
                'CashuToken',
                {
                    token: simpleToken,
                    decoded: expect.any(Object)
                }
            ]);
        });

        it('should throw error for zeusln.com/e/ URL with invalid token', async () => {
            const invalidToken = 'notavalidcashutoken';
            const url = `${ZEUS_ECASH_GIFT_URL}${invalidToken}`;
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = false;

            await expect(handleAnything(url)).rejects.toThrow();
        });

        it('should return false for zeusln.com/e/ URL with invalid token from clipboard', async () => {
            const invalidToken = 'notavalidcashutoken';
            const url = `${ZEUS_ECASH_GIFT_URL}${invalidToken}`;
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = false;

            const result = await handleAnything(url, undefined, true);

            expect(result).toBe(false);
        });

        it('should handle zeusln.com/e/ URL with whitespace trimmed', async () => {
            const url = `  ${ZEUS_ECASH_GIFT_URL}${validCashuToken}  `;
            mockProcessBIP21Uri.mockReturnValue({
                value: `${ZEUS_ECASH_GIFT_URL}${validCashuToken}`
            });
            mockIsValidCashuToken = true;
            mockDecodedCashuToken = {
                token: [
                    {
                        mint: 'https://mint.minibits.cash/Bitcoin',
                        proofs: [{ amount: 16 }]
                    }
                ],
                unit: 'sat'
            };

            const result = await handleAnything(url);

            expect(result[0]).toBe('CashuToken');
        });

        it('should not match similar but different URLs', async () => {
            // URL that starts with zeusln.com but not /e/ path
            const url = 'https://zeusln.com/download';
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = false;

            // Should fall through to error since it's not a valid payment method
            await expect(handleAnything(url)).rejects.toThrow();
        });

        it('should not match http:// URLs (only https://)', async () => {
            const url = `http://zeusln.com/e/${validCashuToken}`;
            mockProcessBIP21Uri.mockReturnValue({ value: url });
            mockIsValidCashuToken = false;

            // http:// should not match the https:// pattern
            await expect(handleAnything(url)).rejects.toThrow();
        });
    });
});
