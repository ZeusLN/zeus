jest.mock('../stores/ChannelBackupStore', () => ({}));
jest.mock('../stores/LSPStore', () => ({}));
jest.mock('react-native-notifications', () => ({}));

import {
    invoicesStore,
    settingsStore,
    transactionsStore
} from '../stores/Stores';
import handleAnything from './handleAnything';
import AutoPayUtils from './AutoPayUtils';
import BackendUtils from './BackendUtils';

let mockProcessBIP21Uri = jest.fn();
let mockIsValidBitcoinAddress = false;
let mockIsValidLightningPubKey = false;
let mockIsValidLightningPaymentRequest = false;
let mockSupportsOnchainSends = true;
let mockGetLnurlParams = {};
let mockSupportsCashuWallet = false;

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
    supportsCashuWallet: () => mockSupportsCashuWallet,
    decodePaymentRequest: jest.fn()
}));
jest.mock('./AutoPayUtils', () => ({
    shouldTryAutoPay: jest.fn(),
    checkAutoPayAndProcess: jest.fn(),
    checkShouldAutoPay: jest.fn(),
    buildPaymentParams: jest.fn().mockResolvedValue({
        payment_request: 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee',
        max_parts: '16',
        max_shard_amt: '',
        fee_limit_sat: '100',
        max_fee_percent: '5.0',
        outgoing_chan_id: '',
        last_hop_pubkey: '',
        amp: false,
        timeout_seconds: '60'
    })
}));
jest.mock('../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} },
    invoicesStore: { getPayReq: jest.fn() },
    settingsStore: {
        settings: {
            locale: 'en',
            ecash: { enableCashu: false },
            payments: {
                autoPayEnabled: false,
                autoPayThreshold: 0,
                enableDonations: false
            }
        }
    },
    transactionsStore: { sendPayment: jest.fn() }
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

    describe('Auto-pay integration', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mockSupportsCashuWallet = false;
            mockIsValidLightningPaymentRequest = true;
            mockProcessBIP21Uri.mockImplementation((data) => ({ value: data }));
            (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
                num_satoshis: '1500',
                value: '1500'
            });
        });

        it('should process auto-pay for valid Lightning invoice when enabled', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';

            (AutoPayUtils.shouldTryAutoPay as jest.Mock).mockReturnValue(true);
            (AutoPayUtils.checkShouldAutoPay as jest.Mock).mockResolvedValue({
                shouldAutoPay: true,
                amount: 1500,
                enableDonations: false
            });

            const result = await handleAnything(invoice);

            expect(result).toEqual([
                'SendingLightning',
                {
                    enableDonations: false
                }
            ]);
            expect(AutoPayUtils.shouldTryAutoPay).toHaveBeenCalledWith(invoice);
            expect(AutoPayUtils.checkShouldAutoPay).toHaveBeenCalledWith(
                invoice,
                settingsStore
            );
            expect(transactionsStore.sendPayment).toHaveBeenCalledWith({
                payment_request: invoice,
                max_parts: '16',
                max_shard_amt: '',
                fee_limit_sat: '100',
                max_fee_percent: '5.0',
                outgoing_chan_id: '',
                last_hop_pubkey: '',
                amp: false,
                timeout_seconds: '60'
            });
        });

        it('should fallback to PaymentRequest when auto-pay threshold is exceeded', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';

            (AutoPayUtils.shouldTryAutoPay as jest.Mock).mockReturnValue(true);
            (AutoPayUtils.checkShouldAutoPay as jest.Mock).mockResolvedValue({
                shouldAutoPay: false,
                amount: 1500,
                enableDonations: false
            });

            const result = await handleAnything(invoice);

            expect(result).toEqual(['PaymentRequest', {}]);
            expect(AutoPayUtils.shouldTryAutoPay).toHaveBeenCalledWith(invoice);
            expect(AutoPayUtils.checkShouldAutoPay).toHaveBeenCalledWith(
                invoice,
                settingsStore
            );
            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        });

        it('should skip auto-pay when AutoPayUtils.shouldTryAutoPay returns false', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';

            (AutoPayUtils.shouldTryAutoPay as jest.Mock).mockReturnValue(false);

            const result = await handleAnything(invoice);

            expect(result).toEqual(['PaymentRequest', {}]);
            expect(AutoPayUtils.shouldTryAutoPay).toHaveBeenCalledWith(invoice);
            expect(AutoPayUtils.checkShouldAutoPay).not.toHaveBeenCalled();
            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        });

        it('should handle auto-pay errors gracefully', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';
            const error = new Error('Decode failed');
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();

            (AutoPayUtils.shouldTryAutoPay as jest.Mock).mockReturnValue(true);
            (AutoPayUtils.checkShouldAutoPay as jest.Mock).mockRejectedValue(
                error
            );

            const result = await handleAnything(invoice);

            expect(result).toEqual(['PaymentRequest', {}]);
            expect(AutoPayUtils.shouldTryAutoPay).toHaveBeenCalledWith(invoice);
            expect(AutoPayUtils.checkShouldAutoPay).toHaveBeenCalledWith(
                invoice,
                settingsStore
            );
            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Auto-pay check failed:',
                error
            );
            consoleSpy.mockRestore();
        });

        it('should return ChoosePaymentMethod in ecash mode without auto-pay check', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';

            mockSupportsCashuWallet = true;
            (settingsStore.settings.ecash as any) = { enableCashu: true };

            const result = await handleAnything(invoice);

            expect(result).toEqual([
                'ChoosePaymentMethod',
                {
                    lightning: invoice,
                    locked: true
                }
            ]);
            expect(AutoPayUtils.shouldTryAutoPay).not.toHaveBeenCalled();
            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        });

        it('should return ChoosePaymentMethod in ecash mode for Lightning invoices', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';

            mockSupportsCashuWallet = true;
            (settingsStore.settings.ecash as any) = { enableCashu: true };

            const result = await handleAnything(invoice);

            expect(result).toEqual([
                'ChoosePaymentMethod',
                {
                    lightning: invoice,
                    locked: true
                }
            ]);
            expect(AutoPayUtils.shouldTryAutoPay).not.toHaveBeenCalled();
            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        });

        it('should not interfere with non-lightning addresses', async () => {
            const bitcoinAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
            mockIsValidBitcoinAddress = true;
            mockIsValidLightningPaymentRequest = false;
            mockProcessBIP21Uri.mockReturnValue({ value: bitcoinAddress });

            const result = await handleAnything(bitcoinAddress);

            expect(result).toEqual([
                'Send',
                {
                    destination: bitcoinAddress,
                    transactionType: 'On-chain',
                    isValid: true
                }
            ]);
            expect(AutoPayUtils.shouldTryAutoPay).not.toHaveBeenCalled();
            expect(AutoPayUtils.checkAutoPayAndProcess).not.toHaveBeenCalled();
        });

        it('should return true from clipboard for Lightning invoices', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';

            const result = await handleAnything(invoice, undefined, true);

            expect(result).toEqual(true);
            expect(AutoPayUtils.shouldTryAutoPay).not.toHaveBeenCalled();
            expect(BackendUtils.decodePaymentRequest).not.toHaveBeenCalled();
            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        });

        it('should handle auto-pay when not disabled by settings', async () => {
            const invoice = 'lnbc1500n1pnw42nnpp5w9e5k7s9ep83vee83vee83vee';

            (AutoPayUtils.shouldTryAutoPay as jest.Mock).mockReturnValue(true);
            (AutoPayUtils.checkShouldAutoPay as jest.Mock).mockResolvedValue({
                shouldAutoPay: false,
                amount: 1500,
                enableDonations: false
            });

            const result = await handleAnything(invoice);

            expect(result).toEqual(['PaymentRequest', {}]);
            expect(AutoPayUtils.shouldTryAutoPay).toHaveBeenCalledWith(invoice);
            expect(AutoPayUtils.checkShouldAutoPay).toHaveBeenCalledWith(
                invoice,
                settingsStore
            );
            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        });
    });
});
