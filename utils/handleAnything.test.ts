jest.mock('../stores/ChannelBackupStore', () => ({}));
jest.mock('../stores/LSPStore', () => ({}));
jest.mock('react-native-notifications', () => ({}));

import { invoicesStore } from '../stores/Stores';
import handleAnything from './handleAnything';

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

    describe('merchant legacy invoice conversion', () => {
        beforeEach(() => {
            mockProcessBIP21Uri.mockReset();
            mockIsValidBitcoinAddress = false;
            mockIsValidLightningPubKey = false;
            mockIsValidLightningPaymentRequest = false;
            mockSupportsOnchainSends = true;
            mockGetLnurlParams = {};
        });

        it('should handle picknpay legacy invoice like an invalid lightning input', async () => {
            const legacyInvoice =
                '00020129530019za.co.electrum.picknpay0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2';

            mockProcessBIP21Uri.mockReturnValue({ value: legacyInvoice });

            await expect(handleAnything(legacyInvoice)).rejects.toThrow();
        });

        it('should handle ecentric legacy invoice like an invalid lightning input', async () => {
            const legacyInvoice =
                '00020129530019za.co.ecentric.payment0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2';

            mockProcessBIP21Uri.mockReturnValue({ value: legacyInvoice });

            await expect(handleAnything(legacyInvoice)).rejects.toThrow();
        });

        it('should respect signet network when handling legacy invoices', async () => {
            require('../stores/Stores').nodeInfoStore.nodeInfo = {
                isSigNet: true
            };

            const legacyInvoice =
                '00020129530019za.co.electrum.picknpay0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2';

            mockProcessBIP21Uri.mockReturnValue({ value: legacyInvoice });

            await expect(handleAnything(legacyInvoice)).rejects.toThrow();
        });

        it('should return false for legacy invoice when pasted from clipboard', async () => {
            const legacyInvoice =
                '00020129530019za.co.ecentric.payment0122RD2HAK3KTI53EC/confirm6304ABCD';

            mockProcessBIP21Uri.mockReturnValue({ value: legacyInvoice });

            const result = await handleAnything(legacyInvoice, undefined, true);
            expect(result).toEqual(false);
        });

        it('should treat non-matching legacy invoice as invalid input', async () => {
            const legacyInvoice =
                '00020129530019za.co.unrelated.merchant0122RD2HAK3KTI53EC/confirm6304ABCD';

            mockProcessBIP21Uri.mockReturnValue({ value: legacyInvoice });

            await expect(handleAnything(legacyInvoice)).rejects.toThrow();
        });
    });
});
