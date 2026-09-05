jest.mock('../stores/ChannelBackupStore', () => ({}));
jest.mock('../stores/LSPStore', () => ({}));
jest.mock('react-native-notifications', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
}));

let mockSupportsOnchainSends = true;
let mockSupportsCashuWallet = false;
jest.mock('./TorUtils', () => ({}));
jest.mock('./BackendUtils', () => ({
    supportsOnchainSends: () => mockSupportsOnchainSends,
    supportsAccounts: () => false,
    supportsCashuWallet: () => mockSupportsCashuWallet,
    supportsWithdrawalRequests: () => false,
    supportsLnurlAuth: () => false
}));

jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isValidToken: jest.fn(),
        decodeToken: jest.fn()
    }
}));
jest.mock('./CashuUtils', () => {
    const actual = jest.requireActual('./CashuUtils').default;
    return {
        __esModule: true,
        default: {
            ...actual,
            isValidCashuToken: () => false,
            isValidCashuTokenAsync: () => Promise.resolve(false)
        }
    };
});

jest.mock('./NodeUriUtils', () => ({
    isValidNodeUri: () => false,
    processNodeUri: jest.fn()
}));
jest.mock('./ConnectionFormatUtils', () => ({
    processLndConnectUrl: jest.fn(),
    processCLNRestConnectUrl: jest.fn(),
    processLncUrl: jest.fn()
}));

const mockVerifyPayment = jest.fn().mockResolvedValue(null);
jest.mock('../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} },
    invoicesStore: { getPayReq: jest.fn() },
    settingsStore: {
        settings: { locale: 'en', branta: { enabled: true } }
    },
    brantaStore: {
        verifyPayment: (...args: any[]) => mockVerifyPayment(...args)
    }
}));

const mockBlobUtilFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    fetch: (...args: any[]) => mockBlobUtilFetch(...args)
}));
jest.mock('react-native-encrypted-storage', () => ({}));
jest.mock('react-native-fs', () => ({}));
jest.mock('js-lnurl', () => ({
    getParams: jest.fn(),
    findlnurl: () => null,
    decodelnurl: () => null
}));
jest.mock('nostr-tools', () => ({
    relayInit: jest.fn(),
    nip05: { queryProfile: jest.fn() },
    nip19: { decode: jest.fn() }
}));
jest.mock('../stores/SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.example.com']
}));

import { invoicesStore, settingsStore } from '../stores/Stores';
import handleAnything from './handleAnything';

const ADDRESS = 'bc1q7065ezyhcd3qtqlcvwcmp9t2weaxc4sguuvlwu';
const BRANTA_ID =
    'z15b5EsbP5LHJrFco38+Fp+HVaiopAY676NCKek8e1Q+4a370TyYhvloS8uLCUHfJ4CzeI/bOFmFDGpAQszB0gu1pJ1HOQ==';
const BRANTA_SECRET = 'c6e9eb30-6258-4432-9847-bdcc4fd4b0db';
const ENCODED_BRANTA_ID = encodeURIComponent(BRANTA_ID);

const ONCHAIN_BRANTA = `bitcoin:${ADDRESS}?branta_id=${ENCODED_BRANTA_ID}&branta_secret=${BRANTA_SECRET}`;
const ONCHAIN_BRANTA_UPPER = `BITCOIN:${ADDRESS.toUpperCase()}?BRANTA_ID=${ENCODED_BRANTA_ID}&BRANTA_SECRET=${BRANTA_SECRET}`;
const ONCHAIN_BRANTA_WITH_AMOUNT = `bitcoin:${ADDRESS}?amount=0.00170003&branta_id=${ENCODED_BRANTA_ID}&branta_secret=${BRANTA_SECRET}`;
const PEONY_ONCHAIN =
    'bitcoin:bc1q6745z6cy3u0k9nprurh3x804c4r7u3u8vxca2n?branta_id=z15b5EsbP5LHJrFco38%2BFp%2BHVaiopAY676NCKek8e1Q%2B4a370TyYhvloS8uLCUHfJ4CzeI%2FbOFmFDGpAQszB0gu1pJ1HOQ%3D%3D&branta_secret=c6e9eb30-6258-4432-9847-bdcc4fd4b0db';

const INVOICE =
    'lnbc1pwxmpg5pp5pfc6hq9cn2059n8q6n0qhlxlyk6y38f7yxsg0cdq0s3s8xryaj6qdph235hqurfdcsyuet9wfsk5j6pyq58g6tswp5kutndv55jsaf5x5mrs2gcqzysxqyz5vq54gltey50ra8utdya5xj5yr9d30s4p627ftz4fjp78ky2slka2gskvp096jjefq3d5ujhnqwrrh70espxyh09kdmq8q64n3jaj8ldegq5m4ddp';
const LIGHTNING_PREFIXED = `lightning:${INVOICE}`;
const LIGHTNING_PREFIXED_UPPER = `LIGHTNING:${INVOICE.toUpperCase()}`;
const BIP21_LIGHTNING_ONLY = `bitcoin:?lightning=${INVOICE}`;
const BRANTA_LN_QR =
    'lightning:lnbc17760n1p4r4flypp5k56kq3v2935rl3glkqu9vngfueud2zj87hjcff3t0kn0yrge0pfqdzjgfexzmn5vysz6gzyv4mx2mr0wpjhygzvd9nksarwd9hxwgz6v4ex7gztdehhwmr9v3nk2gz90psk6urvv5cqzzsxq97zvuqsp5hut3t0l0s5mvp9yr06v4253kqtf452z6c65s6g9sga445hc03v6s9qxpqysgqqm430zkk9uymjgvllr3aha88hc6q59etxasfqswn8r8pfm3dstlpp46azv906xtcj3wzprxup5fxn65a5wymt7zzq9sw9qdzx8rgdhcpk80nrg';

const UNIFIED_BIP21 =
    'bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightning=LNBC10U1P3PJ257PP5YZTKWJCZ5FTL5LAXKAV23ZMZEKAW37ZK6KMV80PK4XAEV5QHTZ7QDPDWD3XGER9WD5KWM36YPRX7U3QD36KUCMGYP282ETNV3SHJCQZPGXQYZ5VQSP5USYC4LK9CHSFP53KVCNVQ456GANH60D89REYKDNGSMTJ6YW3NHVQ9QYYSSQJCEWM5CJWZ4A6RFJX77C490YCED6PEMK0UPKXHY89CMM7SCT66K8GNEANWYKZGDRWRFJE69H9U5U0W57RRCSYSAS7GADWMZXC8C6T0SPJAZUP6';
const UNIFIED_BRANTA = `bitcoin:${ADDRESS}?lightning=${INVOICE}&branta_id=${ENCODED_BRANTA_ID}&branta_secret=${BRANTA_SECRET}`;
const PEONY_UNIFIED =
    'bitcoin:bc1q6745z6cy3u0k9nprurh3x804c4r7u3u8vxca2n?lightning=lnbc17760n1p4r4flypp5k56kq3v2935rl3glkqu9vngfueud2zj87hjcff3t0kn0yrge0pfqdzjgfexzmn5vysz6gzyv4mx2mr0wpjhygzvd9nksarwd9hxwgz6v4ex7gztdehhwmr9v3nk2gz90psk6urvv5cqzzsxq97zvuqsp5hut3t0l0s5mvp9yr06v4253kqtf452z6c65s6g9sga445hc03v6s9qxpqysgqqm430zkk9uymjgvllr3aha88hc6q59etxasfqswn8r8pfm3dstlpp46azv906xtcj3wzprxup5fxn65a5wymt7zzq9sw9qdzx8rgdhcpk80nrg&branta_id=z15b5EsbP5LHJrFco38%2BFp%2BHVaiopAY676NCKek8e1Q%2B4a370TyYhvloS8uLCUHfJ4CzeI%2FbOFmFDGpAQszB0gu1pJ1HOQ%3D%3D&branta_secret=c6e9eb30-6258-4432-9847-bdcc4fd4b0db';

const PUBKEY =
    '0368fea53f886ddaf541212f78e2ef426fdfef82c2df8ec7e2e100b4088ac0ff1d';
const OFFER =
    'lno1pgqpvggr3l9u9ppv79mzn7g9v98cf8zw900skucuz53zr5vvjss454zrnyes';
const LIGHTNING_ADDRESS = 'lnaddress@zbd.gg';

const VERIFICATION = {
    platform: 'Peony Lane',
    platformLogoUrl: 'https://guardrail.branta.pro/logo.png',
    verifyUrl: 'https://guardrail.branta.pro/v2/verify/abc'
};

describe('handleAnything Branta verification', () => {
    beforeEach(() => {
        mockVerifyPayment.mockReset();
        mockVerifyPayment.mockResolvedValue(null);
        mockBlobUtilFetch.mockReset();
        (invoicesStore.getPayReq as jest.Mock).mockReset();
        mockSupportsOnchainSends = true;
        mockSupportsCashuWallet = false;
        settingsStore.settings = {
            locale: 'en',
            branta: { enabled: true }
        };
    });

    describe('calls verifyPayment', () => {
        it.each([
            [
                'on-chain BIP-21 with branta_id and branta_secret',
                ONCHAIN_BRANTA
            ],
            ['uppercase BITCOIN:/BRANTA_* keys', ONCHAIN_BRANTA_UPPER],
            [
                'on-chain BIP-21 with amount and Branta params',
                ONCHAIN_BRANTA_WITH_AMOUNT
            ],
            ['Peony Lane on-chain ZK QR', PEONY_ONCHAIN],
            ['bare bolt11 invoice', INVOICE],
            ['lightning: prefixed invoice', LIGHTNING_PREFIXED],
            ['LIGHTNING: prefixed invoice', LIGHTNING_PREFIXED_UPPER],
            [
                'BIP-21 lightning-only (no on-chain address)',
                BIP21_LIGHTNING_ONLY
            ],
            ['Peony Lane lightning ZK QR', BRANTA_LN_QR],
            [
                'ZK Unified BIP-21 (address + lightning + Branta params)',
                UNIFIED_BRANTA
            ],
            ['Peony Lane ZK Unified QR', PEONY_UNIFIED]
        ])('%s', async (_name, input) => {
            await handleAnything(input);

            expect(mockVerifyPayment).toHaveBeenCalledTimes(1);
            expect(mockVerifyPayment).toHaveBeenCalledWith(input);
        });

        it('trims whitespace before calling verifyPayment', async () => {
            await handleAnything(`  ${ONCHAIN_BRANTA}  `);

            expect(mockVerifyPayment).toHaveBeenCalledTimes(1);
            expect(mockVerifyPayment).toHaveBeenCalledWith(ONCHAIN_BRANTA);
        });

        it('calls verifyPayment when branta.enabled is omitted (existing-user default)', async () => {
            settingsStore.settings = { locale: 'en', branta: {} };

            await handleAnything(INVOICE);

            expect(mockVerifyPayment).toHaveBeenCalledTimes(1);
        });

        it('still verifies on-chain Branta URIs when Cashu is enabled', async () => {
            mockSupportsCashuWallet = true;
            settingsStore.settings.ecash = { enableCashu: true };

            await handleAnything(ONCHAIN_BRANTA);

            expect(mockVerifyPayment).toHaveBeenCalledTimes(1);
        });
    });

    describe('does not call verifyPayment', () => {
        it.each([
            ['bare bitcoin address', ADDRESS],
            ['bitcoin: URI with no query', `bitcoin:${ADDRESS}`],
            [
                'bitcoin: URI with amount only',
                `bitcoin:${ADDRESS}?amount=0.00170003`
            ],
            [
                'branta_id without branta_secret',
                `bitcoin:${ADDRESS}?branta_id=${ENCODED_BRANTA_ID}`
            ],
            [
                'branta_secret without branta_id',
                `bitcoin:${ADDRESS}?branta_secret=${BRANTA_SECRET}`
            ],
            ['keysend pubkey', PUBKEY],
            ['BOLT 12 offer', OFFER],
            [
                'unified BIP-21 address + lightning without Branta params',
                UNIFIED_BIP21
            ]
        ])('%s', async (_name, input) => {
            await handleAnything(input);

            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });

        it('does not call for on-chain Branta URI when Branta is disabled', async () => {
            settingsStore.settings.branta.enabled = false;

            await handleAnything(ONCHAIN_BRANTA);

            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });

        it('does not call for bolt11 when Branta is disabled', async () => {
            settingsStore.settings.branta.enabled = false;

            await handleAnything(INVOICE);

            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });

        it('does not call for clipboard on-chain Branta URI', async () => {
            const result = await handleAnything(
                ONCHAIN_BRANTA,
                undefined,
                true
            );

            expect(result).toBe(true);
            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });

        it('does not call for clipboard ZK Unified URI', async () => {
            const result = await handleAnything(
                UNIFIED_BRANTA,
                undefined,
                true
            );

            expect(result).toBe(true);
            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });

        it('does not call for ZK Unified when Branta is disabled', async () => {
            settingsStore.settings.branta.enabled = false;

            await handleAnything(UNIFIED_BRANTA);

            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });

        it('does not call for clipboard bolt11', async () => {
            const result = await handleAnything(INVOICE, undefined, true);

            expect(result).toBe(true);
            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });

        it('does not call for bolt11 in ecash mode', async () => {
            mockSupportsCashuWallet = true;
            settingsStore.settings.ecash = { enableCashu: true };

            const result = await handleAnything(INVOICE);

            expect(mockVerifyPayment).not.toHaveBeenCalled();
            expect(result).toEqual([
                'ChoosePaymentMethod',
                { lightning: INVOICE, locked: true }
            ]);
        });

        it('does not call for a lightning address', async () => {
            mockBlobUtilFetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({ callback: 'https://zbd.gg/callback' })
            });
            const fetchMock = jest.fn().mockRejectedValue(new Error('no dns'));
            const originalFetch = globalThis.fetch;
            (globalThis as any).fetch = fetchMock;

            try {
                await handleAnything(LIGHTNING_ADDRESS);
            } finally {
                (globalThis as any).fetch = originalFetch;
            }

            expect(mockVerifyPayment).not.toHaveBeenCalled();
        });
    });

    describe('forwards verification onto the payment screen', () => {
        it('passes verification through to Send for on-chain Branta URIs', async () => {
            mockVerifyPayment.mockResolvedValue(VERIFICATION);

            const result = await handleAnything(ONCHAIN_BRANTA);

            expect(result).toEqual([
                'Send',
                {
                    destination: ADDRESS,
                    satAmount: undefined,
                    transactionType: 'On-chain',
                    isValid: true,
                    brantaVerification: VERIFICATION
                }
            ]);
        });

        it('passes verification through to ChoosePaymentMethod for ZK Unified URIs', async () => {
            mockVerifyPayment.mockResolvedValue(VERIFICATION);

            const result = await handleAnything(UNIFIED_BRANTA);

            expect(mockVerifyPayment).toHaveBeenCalledWith(UNIFIED_BRANTA);
            expect(result).toEqual([
                'ChoosePaymentMethod',
                {
                    value: ADDRESS,
                    satAmount: undefined,
                    lightning: INVOICE,
                    offer: undefined,
                    clinkNoffer: undefined,
                    brantaVerification: VERIFICATION
                }
            ]);
        });

        it('passes verification through to ChoosePaymentMethod for the Peony Lane ZK Unified QR', async () => {
            mockVerifyPayment.mockResolvedValue(VERIFICATION);

            const result = await handleAnything(PEONY_UNIFIED);

            expect(mockVerifyPayment).toHaveBeenCalledTimes(1);
            expect(mockVerifyPayment).toHaveBeenCalledWith(PEONY_UNIFIED);
            expect(result[0]).toBe('ChoosePaymentMethod');
            expect(result[1]).toEqual({
                value: 'bc1q6745z6cy3u0k9nprurh3x804c4r7u3u8vxca2n',
                satAmount: undefined,
                lightning:
                    'lnbc17760n1p4r4flypp5k56kq3v2935rl3glkqu9vngfueud2zj87hjcff3t0kn0yrge0pfqdzjgfexzmn5vysz6gzyv4mx2mr0wpjhygzvd9nksarwd9hxwgz6v4ex7gztdehhwmr9v3nk2gz90psk6urvv5cqzzsxq97zvuqsp5hut3t0l0s5mvp9yr06v4253kqtf452z6c65s6g9sga445hc03v6s9qxpqysgqqm430zkk9uymjgvllr3aha88hc6q59etxasfqswn8r8pfm3dstlpp46azv906xtcj3wzprxup5fxn65a5wymt7zzq9sw9qdzx8rgdhcpk80nrg',
                offer: undefined,
                clinkNoffer: undefined,
                brantaVerification: VERIFICATION
            });
        });

        it('still routes ZK Unified to ChoosePaymentMethod when lookup returns null', async () => {
            const result = await handleAnything(UNIFIED_BRANTA);

            expect(mockVerifyPayment).toHaveBeenCalledWith(UNIFIED_BRANTA);
            expect(result).toEqual([
                'ChoosePaymentMethod',
                {
                    value: ADDRESS,
                    satAmount: undefined,
                    lightning: INVOICE,
                    offer: undefined,
                    clinkNoffer: undefined,
                    brantaVerification: null
                }
            ]);
        });

        it('does not attach a lookup to unified BIP-21 without Branta params', async () => {
            const result = await handleAnything(UNIFIED_BIP21);

            expect(mockVerifyPayment).not.toHaveBeenCalled();
            expect(result[0]).toBe('ChoosePaymentMethod');
            expect(result[1].brantaVerification).toBeNull();
            expect(result[1].lightning).toBeDefined();
            expect(result[1].value).toBeDefined();
        });

        it('passes verification through to PaymentRequest for bolt11', async () => {
            mockVerifyPayment.mockResolvedValue(VERIFICATION);

            const result = await handleAnything(INVOICE);

            expect(invoicesStore.getPayReq).toHaveBeenCalledWith(INVOICE);
            expect(result).toEqual([
                'PaymentRequest',
                { brantaVerification: VERIFICATION }
            ]);
        });

        it('passes null through when verifyPayment finds nothing', async () => {
            const result = await handleAnything(INVOICE);

            expect(result).toEqual([
                'PaymentRequest',
                { brantaVerification: null }
            ]);
        });
    });
});
