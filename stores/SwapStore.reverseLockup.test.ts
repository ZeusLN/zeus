// Reverse swap lockup verification. Uses the real ecpair, bitcoinjs-lib
// and @scure key material like SwapStore.rescue.test.ts, so the swap tree
// and lockup address are derived exactly as the app derives them.
jest.mock('../stores/Stores');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (s: string) => s
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: jest.fn(),
        fs: { dirs: { LibraryDir: '/lib', DocumentDir: '/docs' } }
    }
}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/BackendUtils', () => ({ getPayments: jest.fn() }));
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/MigrationUtils', () => ({
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    migrateRgsDefaultToZeus: jest.fn().mockResolvedValue(undefined),
    migrateInvoiceExpiryDisplay: jest.fn().mockResolvedValue(undefined),
    legacySettingsMigrations: jest.fn().mockResolvedValue({}),
    storageMigrationV2: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: '',
    DEFAULT_VSS_SERVER: '',
    getDefaultEsploraServer: jest.fn().mockReturnValue(''),
    getDefaultRgsServer: jest.fn().mockReturnValue('')
}));
// the invoice check has its own tests in SwapUtils.test.ts; building a
// signed BOLT11 for the derived preimage hash here adds nothing
jest.mock('../utils/SwapUtils', () => ({
    ...jest.requireActual('../utils/SwapUtils'),
    verifyReverseSwapInvoice: jest.fn(() => ({ valid: true }))
}));
jest.mock('../storage', () => {
    const store: { [key: string]: string } = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (key: string) => store[key] ?? null),
            setItem: jest.fn(async (key: string, value: string) => {
                store[key] = value;
                return true;
            }),
            __store: store
        }
    };
});

import ReactNativeBlobUtil from 'react-native-blob-util';
import ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';
import { crypto, payments, Transaction } from 'bitcoinjs-lib';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

import SwapStore from './SwapStore';
import BackendUtils from '../utils/BackendUtils';
import Bolt11Utils from '../utils/Bolt11Utils';
import Storage from '../storage';
import Swap from '../models/Swap';
import {
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    buildReverseSwapLeaves,
    deriveReverseSwapOutputKey,
    deriveSwapPreimage
} from '../utils/SwapUtils';

// BIP39 canonical test mnemonic, used as a swap rescue key
const RESCUE_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const storageBacking = (Storage as any).__store as { [key: string]: string };
const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;

const ECPair = ECPairFactory(ecc);
const childPrivateKey = HDKey.fromMasterSeed(
    mnemonicToSeedSync(RESCUE_MNEMONIC)
).derive('m/44/0/0/0/0').privateKey!;
const OUR_KEYS = ECPair.fromPrivateKey(Buffer.from(childPrivateKey));
const PREIMAGE = deriveSwapPreimage(childPrivateKey);
const SERVER_PUBKEY = Buffer.from(
    ecc.pointFromScalar(Buffer.alloc(32, 2), true)!
);
const OTHER_PUBKEY = Buffer.from(
    ecc.pointFromScalar(Buffer.alloc(32, 3), true)!
);
const TIMEOUT = 900000;

const swapDetails = (ourPubKey: Buffer = Buffer.from(OUR_KEYS.publicKey)) => {
    const { claimLeaf, refundLeaf } = buildReverseSwapLeaves({
        claimPubKey: ourPubKey,
        refundPubKey: SERVER_PUBKEY,
        preimageHash: crypto.sha256(PREIMAGE),
        timeoutBlockHeight: TIMEOUT
    });
    const outputKey = deriveReverseSwapOutputKey({
        ourPubKey,
        serverPubKey: SERVER_PUBKEY,
        claimLeaf,
        refundLeaf
    });
    const { address, output } = payments.p2tr({ pubkey: outputKey });
    return {
        swapTree: {
            claimLeaf: { version: 192, output: claimLeaf.toString('hex') },
            refundLeaf: { version: 192, output: refundLeaf.toString('hex') }
        },
        lockupAddress: address!,
        refundPublicKey: SERVER_PUBKEY.toString('hex'),
        timeoutBlockHeight: TIMEOUT,
        outputScript: Buffer.from(output!)
    };
};

const VALID = swapDetails();
// a correctly formed swap for a key that isn't ours: its address is a
// real taproot address the provider could control
const OTHER_ADDRESS = swapDetails(OTHER_PUBKEY).lockupAddress;

const newStore = () =>
    new SwapStore(
        { nodeInfo: { nodeId: 'node-pubkey', isTestNet: false } } as any,
        { settings: {}, implementation: 'lnd' } as any
    );

// members a swap creation response is not expected to have: "model" and
// "qrCodeValue" are names of Swap getters, which new Swap() can't assign,
// and "imported" marks a rescued swap
const EXTRA_MEMBERS = {
    model: 'not a swap',
    qrCodeValue: 'lnbc-other-invoice',
    imported: true
};
const expectNoExtraMembers = (swap: any) => {
    for (const member of Object.keys(EXTRA_MEMBERS)) {
        expect(Object.keys(swap)).not.toContain(member);
    }
};

beforeEach(() => {
    for (const key of Object.keys(storageBacking)) delete storageBacking[key];
    jest.clearAllMocks();
});

describe('SwapStore.createReverseSwap response verification', () => {
    const INVOICE_AMOUNT = 100000;
    // 0.5% service fee and 700 sats of miner fees: the Swaps screen shows
    // 100000 - 500 - 700 = 98800 sats to receive
    const REVERSE_INFO = {
        fees: { percentage: 0.5, minerFees: { claim: 300, lockup: 400 } }
    };

    const create = async (
        responseOverrides: any = {},
        tip: any = TIMEOUT - 100,
        fee = '2',
        reverseInfo: any = REVERSE_INFO
    ) => {
        storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
        const { outputScript: _outputScript, ...details } = VALID;
        fetchMock.mockResolvedValueOnce({
            data: JSON.stringify({
                id: 'reverse-swap',
                invoice: 'lnbc-provider-invoice',
                onchainAmount: 99100,
                ...details,
                ...responseOverrides
            })
        });
        fetchMock.mockResolvedValue({
            info: () => ({ status: 200 }),
            text: () => String(tip)
        });

        const store = newStore();
        store.reverseInfo = reverseInfo;
        const navigation = { navigate: jest.fn() };
        const result = await store.createReverseSwap(
            'bc1qdestination',
            INVOICE_AMOUNT,
            fee,
            navigation
        );
        const stored = storageBacking[REVERSE_SWAPS_KEY]
            ? JSON.parse(storageBacking[REVERSE_SWAPS_KEY])
            : [];
        return { store, navigation, stored, result };
    };

    it('saves and opens a swap whose tree, address and amount check out', async () => {
        const { store, navigation, stored, result } = await create();

        expect(result).toBeUndefined();
        expect(store.apiError).toBe('');
        expect(stored).toHaveLength(1);
        expect(stored[0].onchainAmountVerified).toBe(true);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'SwapDetails',
            expect.anything()
        );
    });

    it.each([TIMEOUT + 1, TIMEOUT, TIMEOUT - 1, TIMEOUT - 5])(
        'does not save or offer payment when the explorer tip is %s',
        async (tip) => {
            const { store, navigation, stored } = await create({}, tip);
            expect(store.apiError).toBe(
                'views.Swaps.invalidReverseSwapResponse'
            );
            expect(store.loading).toBe(false);
            expect(stored).toHaveLength(0);
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('fails closed before payment when the explorer height is unusable', async () => {
        const { store, navigation, stored } = await create({}, 'not a height');
        expect(store.apiError).toBe('views.Swaps.tipHeightUnavailable');
        expect(stored).toHaveLength(0);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it.each([
        [
            'a lockup address the provider controls',
            { lockupAddress: OTHER_ADDRESS }
        ],
        [
            'a claim leaf for another key',
            { swapTree: swapDetails(OTHER_PUBKEY).swapTree }
        ],
        [
            'an on-chain amount below what the user was shown',
            { onchainAmount: 1000 }
        ],
        ['no swap tree', { swapTree: undefined }]
    ])(
        'aborts before saving or paying when the provider returns %s',
        async (_, overrides) => {
            const { store, navigation, stored } = await create(overrides);

            expect(store.apiError).toBe(
                'views.Swaps.invalidReverseSwapResponse'
            );
            expect(store.loading).toBe(false);
            expect(stored).toHaveLength(0);
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('stores and opens only the reverse swap fields of the response', async () => {
        const { store, navigation, stored } = await create(EXTRA_MEMBERS);

        expect(store.apiError).toBe('');
        expect(stored).toHaveLength(1);
        const { swapData } = navigation.navigate.mock.calls[0][1];
        for (const swap of [swapData, stored[0]]) {
            expectNoExtraMembers(swap);
            const model = new Swap(swap);
            expect(model.qrCodeValue).toBe('lnbc-provider-invoice');
            expect(model.claimDestinationAddress).toBe('bc1qdestination');
        }
    });

    it.each([null, []])(
        'aborts before saving or paying when the response body is %j',
        async (body) => {
            storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
            fetchMock.mockResolvedValueOnce({ data: JSON.stringify(body) });
            fetchMock.mockResolvedValue({
                info: () => ({ status: 200 }),
                text: () => String(TIMEOUT - 100)
            });
            const store = newStore();
            store.reverseInfo = REVERSE_INFO;
            const navigation = { navigate: jest.fn() };
            await store.createReverseSwap(
                'bc1qdestination',
                INVOICE_AMOUNT,
                '2',
                navigation
            );

            expect(store.apiError).toBe(
                'views.Swaps.invalidReverseSwapResponse'
            );
            expect(store.loading).toBe(false);
            expect(storageBacking[REVERSE_SWAPS_KEY]).toBeUndefined();
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );
});

describe('SwapStore.createReverseSwap claim fee', () => {
    const INVOICE_AMOUNT = 100000;
    // a refused swap leaves its queued host response unused
    afterEach(() => fetchMock.mockReset());

    const withClaimQuote = (claim: any) => ({
        fees: { percentage: 0.5, minerFees: { claim, lockup: 400 } }
    });

    const create = async (
        fee: string,
        claimQuote: any,
        invoiceAmount = INVOICE_AMOUNT,
        onchainAmount = 99100
    ) => {
        storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
        const { outputScript: _outputScript, ...details } = VALID;
        fetchMock.mockResolvedValueOnce({
            data: JSON.stringify({
                id: 'reverse-swap',
                invoice: 'lnbc-provider-invoice',
                onchainAmount,
                ...details
            })
        });
        fetchMock.mockResolvedValue({
            info: () => ({ status: 200 }),
            text: () => String(TIMEOUT - 100)
        });

        const store = newStore();
        store.reverseInfo = withClaimQuote(claimQuote);
        const navigation = { navigate: jest.fn() };
        await store.createReverseSwap(
            'bc1qdestination',
            invoiceAmount,
            fee,
            navigation
        );
        const stored = storageBacking[REVERSE_SWAPS_KEY]
            ? JSON.parse(storageBacking[REVERSE_SWAPS_KEY])
            : [];
        return { store, navigation, stored };
    };

    it.each([
        ['raises a 1 sat quote to the rate on the largest claim', 1, 25 * 152],
        ['keeps a quote above that', 4000, 4000]
    ])('%s', async (_, quote, expected) => {
        const { store, navigation, stored } = await create('25', quote);

        // the Swaps screen showed the same fee before the swap started
        expect(store.getReverseClaimMinerFee('25')).toBe(expected);
        expect(stored).toHaveLength(1);
        expect(stored[0].claimMinerFee).toBe(expected);
        expect(stored[0].claimFeeRate).toBe(25);
        expect(
            navigation.navigate.mock.calls[0][1].swapData.claimMinerFee
        ).toBe(expected);
    });

    it.each([
        [
            'a claim quote above the maximum',
            '25',
            2000 * 152 + 1,
            'views.Swaps.invalidReverseSwapResponse'
        ],
        [
            'a claim quote that is not a number',
            '25',
            'abc',
            'views.Swaps.invalidReverseSwapResponse'
        ],
        // the host is not at fault here, so the error asks for a rate
        [
            'no usable fee rate',
            '',
            300,
            'views.Swaps.reverseClaimFeeRateRequired'
        ],
        [
            'a fee rate of 0',
            '0',
            300,
            'views.Swaps.reverseClaimFeeRateRequired'
        ],
        [
            'an implausible fee rate',
            '100000',
            300,
            'views.Swaps.reverseClaimFeeRateRequired'
        ]
    ])(
        'refuses to start a swap with %s',
        async (_, fee: string, quote: any, error: string) => {
            const { store, navigation, stored } = await create(fee, quote);

            expect(store.apiError).toBe(error);
            expect(store.loading).toBe(false);
            // the host was never asked for an invoice
            expect(fetchMock).not.toHaveBeenCalled();
            expect(stored).toHaveLength(0);
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    // 100000 less 500 service and 400 lockup fees: the host locks up 99100
    it('refuses, before asking the host, a fee rate whose claim fee takes the whole lockup', async () => {
        // 652 x 152 = 99104 sats
        const { store, navigation, stored } = await create('652', 300);

        expect(store.apiError).toBe('views.Swaps.reverseClaimFeeExceedsAmount');
        expect(store.loading).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(stored).toHaveLength(0);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('starts a swap whose claim fee leaves some of the lockup', async () => {
        // 651 x 152 = 98952 sats
        const { store, stored } = await create('651', 300);

        expect(store.apiError).toBe('');
        expect(stored).toHaveLength(1);
        expect(stored[0].claimMinerFee).toBe(98952);
    });

    it('refuses a lockup above the quoted amount but not above the claim fee', async () => {
        // 4500 less 23 service and 400 lockup fees is 4077. The host's 3790
        // passes the quote check (above 4077 - 300), but the 25 x 152 = 3800
        // sat claim fee would take all of it
        const { store, navigation, stored } = await create(
            '25',
            300,
            4500,
            3790
        );

        expect(store.apiError).toBe('views.Swaps.invalidReverseSwapResponse');
        expect(stored).toHaveLength(0);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});

describe('SwapStore.verifyReverseLockup', () => {
    const ONCHAIN_AMOUNT = 99100;

    // a stored swap: keys and preimage in their JSON shapes
    const storedSwap = (overrides: any = {}) => {
        const { outputScript: _outputScript, ...details } = VALID;
        return new Swap(
            JSON.parse(
                JSON.stringify({
                    id: 'reverse-swap',
                    type: 'reverse',
                    keys: OUR_KEYS,
                    preimage: PREIMAGE,
                    onchainAmount: ONCHAIN_AMOUNT,
                    // created with the creation-time amount check
                    onchainAmountVerified: true,
                    ...details,
                    ...overrides
                })
            )
        );
    };

    // the provider's websocket supplies this hex; only its txid is used
    const lockupTx = () => {
        const tx = new Transaction();
        tx.addInput(Buffer.alloc(32, 1), 0);
        tx.addOutput(VALID.outputScript, ONCHAIN_AMOUNT);
        return tx;
    };
    const LOCKUP_TX = lockupTx();

    const esplora = (
        status: number,
        body: any = {
            txid: LOCKUP_TX.getId(),
            vout: [
                {
                    scriptpubkey: VALID.outputScript.toString('hex'),
                    value: ONCHAIN_AMOUNT
                }
            ],
            status: { confirmed: true }
        }
    ) => {
        fetchMock.mockImplementation(async (_method: string, url: string) => {
            if (url.endsWith('/blocks/tip/height')) {
                return {
                    info: () => ({ status: 200 }),
                    text: () => String(TIMEOUT - 100)
                };
            }
            if (url.includes('/outspend/')) {
                return {
                    info: () => ({ status: 200 }),
                    json: () => ({ spent: false })
                };
            }
            return { info: () => ({ status }), json: () => body };
        });
    };

    const verify = (swap = storedSwap(), hex = LOCKUP_TX.toHex()) =>
        newStore().verifyReverseLockup(swap, hex);

    it('allows the claim for a confirmed, fully funded lockup', async () => {
        esplora(200);
        await expect(verify()).resolves.toEqual({ status: 'ok' });
    });

    it('refuses a swap stored with an on-chain amount that is not a number', async () => {
        // [Infinity] is saved as [null], which compares as 0
        esplora(200);
        await expect(
            verify(storedSwap({ onchainAmount: [Infinity] }))
        ).resolves.toEqual({
            status: 'invalid',
            reason: 'onchain-amount-invalid'
        });
    });

    it('looks the lockup up on the mempool instance, not the provider', async () => {
        esplora(200);
        await verify();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${LOCKUP_TX.getId()}`
        );
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${LOCKUP_TX.getId()}/outspend/0`
        );
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            'https://mempool.test/api/blocks/tip/height'
        );
    });

    it.each([false, true])(
        'refuses a spent output (spend confirmed: %s)',
        async (confirmed) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.includes('/outspend/')
                    ? {
                          info: () => ({ status: 200 }),
                          json: () => ({ spent: true, status: { confirmed } })
                      }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toEqual({
                status: 'invalid',
                reason: 'lockup-spent'
            });
        }
    );

    it('names the spending transaction and whose it is, even past the refund deadline', async () => {
        esplora(200);
        const fetch = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation(async (method, url) => {
            if (url.endsWith(`/tx/${'ab'.repeat(32)}`)) {
                return {
                    info: () => ({ status: 200 }),
                    json: () => ({
                        vin: [
                            {
                                txid: LOCKUP_TX.getId(),
                                vout: 0,
                                witness: ['sig', 'refundscript', 'control']
                            }
                        ]
                    })
                };
            }
            if (url.includes('/outspend/')) {
                return {
                    info: () => ({ status: 200 }),
                    json: () => ({ spent: true, txid: 'ab'.repeat(32) })
                };
            }
            // the host may have refunded itself by now
            if (url.endsWith('/blocks/tip/height')) {
                return {
                    info: () => ({ status: 200 }),
                    text: () => String(TIMEOUT + 10)
                };
            }
            return fetch(method, url);
        });
        await expect(verify()).resolves.toEqual({
            status: 'invalid',
            reason: 'lockup-spent',
            spendingTxid: 'ab'.repeat(32),
            spentBy: 'refund'
        });
    });

    it.each([{}, { spent: 'false' }, null])(
        'fails closed on malformed outspend data %j',
        async (body) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.includes('/outspend/')
                    ? { info: () => ({ status: 200 }), json: () => body }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it.each([TIMEOUT + 1, TIMEOUT, TIMEOUT - 1, TIMEOUT - 5])(
        'refuses a deadline too close to fresh tip %s, including rescued swaps',
        async (tip) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.endsWith('/blocks/tip/height')
                    ? { info: () => ({ status: 200 }), text: () => String(tip) }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toEqual({
                status: 'invalid',
                reason: 'refund-deadline'
            });
            await expect(
                verify(storedSwap({ timeoutBlockHeight: undefined }))
            ).resolves.toEqual({
                status: 'invalid',
                reason: 'refund-deadline'
            });
        }
    );

    it('allows exactly six blocks before the refund deadline', async () => {
        esplora(200);
        const fetch = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation(async (method, url) =>
            url.endsWith('/blocks/tip/height')
                ? {
                      info: () => ({ status: 200 }),
                      text: () => String(TIMEOUT - 6)
                  }
                : fetch(method, url)
        );
        await expect(verify()).resolves.toEqual({ status: 'ok' });
    });

    it('checks the first matching output at its actual index, not a later unspent duplicate', async () => {
        const tx = new Transaction();
        tx.addInput(Buffer.alloc(32, 1), 0);
        tx.addOutput(Buffer.from('0014' + '00'.repeat(20), 'hex'), 1000);
        tx.addOutput(VALID.outputScript, ONCHAIN_AMOUNT);
        tx.addOutput(VALID.outputScript, ONCHAIN_AMOUNT);
        esplora(200, {
            txid: tx.getId(),
            vout: tx.outs.map((out) => ({
                scriptpubkey: out.script.toString('hex'),
                value: out.value
            })),
            status: { confirmed: true }
        });
        const fetch = fetchMock.getMockImplementation()!;
        fetchMock.mockImplementation(async (method, url) =>
            url.endsWith('/outspend/1')
                ? {
                      info: () => ({ status: 200 }),
                      json: () => ({ spent: true })
                  }
                : fetch(method, url)
        );
        await expect(verify(storedSwap(), tx.toHex())).resolves.toEqual({
            status: 'invalid',
            reason: 'lockup-spent'
        });
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${tx.getId()}/outspend/1`
        );
    });

    it.each(['', 'NaN', '-1', '1.5', '0', 'null'])(
        'retries rather than claiming with invalid height %j',
        async (height) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.endsWith('/blocks/tip/height')
                    ? { info: () => ({ status: 200 }), text: () => height }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it.each(['/outspend/0', '/blocks/tip/height'])(
        'retries when %s is unavailable',
        async (path) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) =>
                url.endsWith(path)
                    ? { info: () => ({ status: 503 }) }
                    : fetch(method, url)
            );
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it.each(['/outspend/0', '/blocks/tip/height'])(
        'retries when %s rejects',
        async (path) => {
            esplora(200);
            const fetch = fetchMock.getMockImplementation()!;
            fetchMock.mockImplementation(async (method, url) => {
                if (url.endsWith(path)) throw new Error('offline');
                return fetch(method, url);
            });
            await expect(verify()).resolves.toMatchObject({
                status: 'unavailable'
            });
        }
    );

    it('waits on a fabricated lockup the mempool instance has never seen', async () => {
        // the report's case: syntactically valid hex, never broadcast
        esplora(404, 'Transaction not found');
        await expect(verify()).resolves.toEqual({
            status: 'unconfirmed',
            reason: 'lockup-not-found'
        });
    });

    it('waits on a lockup that is not confirmed yet', async () => {
        esplora(200, {
            vout: [
                {
                    scriptpubkey: VALID.outputScript.toString('hex'),
                    value: ONCHAIN_AMOUNT
                }
            ],
            status: { confirmed: false }
        });
        await expect(verify()).resolves.toEqual({ status: 'unconfirmed' });
    });

    it('refuses a lockup that pays less than the swap amount', async () => {
        esplora(200, {
            vout: [
                {
                    scriptpubkey: VALID.outputScript.toString('hex'),
                    value: 1000
                }
            ],
            status: { confirmed: true }
        });
        await expect(verify()).resolves.toEqual({
            status: 'invalid',
            reason: 'underfunded'
        });
    });

    it('refuses a lockup with no output to the swap', async () => {
        esplora(200, {
            vout: [{ scriptpubkey: '0014' + '00'.repeat(20), value: 99100 }],
            status: { confirmed: true }
        });
        await expect(verify()).resolves.toEqual({
            status: 'invalid',
            reason: 'missing-output'
        });
    });

    it.each([
        ['an HTTP error', () => esplora(500, 'error')],
        [
            'a network failure',
            () => fetchMock.mockRejectedValue(new Error('offline'))
        ]
    ])('fails closed and retries on %s', async (_, setup) => {
        setup();
        await expect(verify()).resolves.toMatchObject({
            status: 'unavailable'
        });
    });

    it('refuses a stored swap whose lockup address is not its tree, without a lookup', async () => {
        esplora(200);
        await expect(
            verify(storedSwap({ lockupAddress: OTHER_ADDRESS }))
        ).resolves.toEqual({
            status: 'invalid',
            reason: 'lockup-address-mismatch'
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a key fromPrivateKey rejects, without throwing or a lookup', async () => {
        esplora(200);
        const swap = storedSwap();
        // out of range: the curve order n
        swap.keys = {
            __D: Buffer.from(
                'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
                'hex'
            )
        } as any;
        await expect(verify(swap)).resolves.toEqual({
            status: 'invalid',
            reason: 'invalid-key'
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses undecodable lockup hex', async () => {
        esplora(200);
        await expect(verify(storedSwap(), 'zz')).resolves.toEqual({
            status: 'invalid',
            reason: 'undecodable-lockup'
        });
    });

    it('accepts the live key and preimage shapes the creation screen passes', async () => {
        esplora(200);
        const swap = storedSwap();
        swap.keys = OUR_KEYS;
        swap.preimage = PREIMAGE as any;
        await expect(verify(swap)).resolves.toEqual({ status: 'ok' });
    });

    describe('a rescued swap, which has no on-chain amount', () => {
        const getPayments = BackendUtils.getPayments as jest.Mock;
        const PAYMENT_HASH = crypto.sha256(PREIMAGE).toString('hex');
        // 90% of a 100000-sat payment
        const FLOOR = 90000;

        const rescuedSwap = (overrides: any = {}) =>
            storedSwap({
                imported: true,
                onchainAmountVerified: undefined,
                swapTree: undefined,
                refundPublicKey: undefined,
                timeoutBlockHeight: undefined,
                onchainAmount: undefined,
                tree: VALID.swapTree,
                serverPublicKey: VALID.refundPublicKey,
                ...overrides
            });

        const lockedUp = (value: number) =>
            esplora(200, {
                vout: [
                    {
                        scriptpubkey: VALID.outputScript.toString('hex'),
                        value
                    }
                ],
                status: { confirmed: true }
            });

        const paid = (payment: any = {}) =>
            getPayments.mockResolvedValue({
                payments: [
                    { payment_hash: 'ab'.repeat(32), value_sat: '500' },
                    {
                        payment_hash: PAYMENT_HASH,
                        value_sat: '100000',
                        status: 'IN_FLIGHT',
                        ...payment
                    }
                ]
            });

        const shortOf = (paidAmount: number, amount: number) => ({
            status: 'confirm-amount',
            amount,
            paidAmount
        });

        it.each([1000, 0, 99100])(
            'ignores a legacy imported onchainAmount of %s',
            async (onchainAmount) => {
                paid();
                lockedUp(1000);
                const swap = rescuedSwap();
                swap.onchainAmount = onchainAmount;
                await expect(verify(swap)).resolves.toEqual(
                    shortOf(100000, 1000)
                );
                expect(getPayments).toHaveBeenCalled();
                await expect(
                    newStore().verifyReverseLockup(swap, LOCKUP_TX.toHex(), {
                        confirmedLockupAmount: 1000
                    })
                ).resolves.toEqual({ status: 'ok' });
            }
        );

        it.each([99100, FLOOR])(
            'claims a lockup of %s sats against a payment of 100000 sats',
            async (value) => {
                paid();
                lockedUp(value);
                await expect(verify(rescuedSwap())).resolves.toEqual({
                    status: 'ok'
                });
            }
        );

        it.each([1000, FLOOR - 1])(
            'asks before claiming a lockup of %s sats against a payment of 100000 sats',
            async (value) => {
                // the host trades a small lockup for the preimage that
                // settles the whole Lightning payment
                paid();
                lockedUp(value);
                await expect(verify(rescuedSwap())).resolves.toEqual(
                    shortOf(100000, value)
                );
            }
        );

        it.each([
            // a fixed sat allowance would have let these through
            [10000, 1000, false],
            [10000, 8999, false],
            [10000, 9000, true],
            [25000, 22499, false],
            [25000, 22500, true]
        ])(
            'against a payment of %s sats, a lockup of %s sats is claimed without asking: %s',
            async (payment, value, claims) => {
                paid({ value_sat: String(payment) });
                lockedUp(value);
                await expect(verify(rescuedSwap())).resolves.toEqual(
                    claims ? { status: 'ok' } : shortOf(payment, value)
                );
            }
        );

        it('reads a payment amount given in msat', async () => {
            paid({ value_sat: undefined, amount_msat: '100000000msat' });
            lockedUp(1000);
            await expect(verify(rescuedSwap())).resolves.toEqual(
                shortOf(100000, 1000)
            );
        });

        it('takes the amount from the invoice when the payment record has none', async () => {
            // CLN sums amount_msat only over completed parts
            paid({
                value_sat: undefined,
                amount_msat: '0',
                bolt11: 'lnbc-pending'
            });
            const decode = jest
                .spyOn(Bolt11Utils, 'decode')
                .mockReturnValue({ satoshis: 100000 } as any);
            lockedUp(1000);
            await expect(verify(rescuedSwap())).resolves.toEqual(
                shortOf(100000, 1000)
            );
            expect(decode).toHaveBeenCalledWith('lnbc-pending');
            decode.mockRestore();
        });

        it('asks for confirmation, with the lockup amount, when the wallet has no payment for it', async () => {
            getPayments.mockResolvedValue({
                payments: [{ payment_hash: 'ab'.repeat(32), value_sat: '1' }]
            });
            lockedUp(1000);
            await expect(verify(rescuedSwap())).resolves.toEqual({
                status: 'confirm-amount',
                amount: 1000
            });
        });

        it('still refuses an invalid lockup before asking for confirmation', async () => {
            getPayments.mockResolvedValue({ payments: [] });
            esplora(200, {
                vout: [
                    {
                        scriptpubkey: VALID.outputScript.toString('hex'),
                        value: 1000
                    }
                ],
                status: { confirmed: false }
            });
            await expect(verify(rescuedSwap())).resolves.toEqual({
                status: 'unconfirmed'
            });
        });

        it('claims once the user confirms the amount', async () => {
            getPayments.mockResolvedValue({ payments: [] });
            lockedUp(1000);
            await expect(
                newStore().verifyReverseLockup(
                    rescuedSwap(),
                    LOCKUP_TX.toHex(),
                    { confirmedLockupAmount: 1000 }
                )
            ).resolves.toEqual({ status: 'ok' });
            expect(getPayments).not.toHaveBeenCalled();
        });

        it('refuses a lockup below the amount the user confirmed', async () => {
            lockedUp(999);
            await expect(
                newStore().verifyReverseLockup(
                    rescuedSwap(),
                    LOCKUP_TX.toHex(),
                    { confirmedLockupAmount: 1000 }
                )
            ).resolves.toEqual({ status: 'invalid', reason: 'underfunded' });
        });

        it('retries when the payments cannot be listed', async () => {
            getPayments.mockRejectedValue(new Error('offline'));
            lockedUp(99100);
            await expect(verify(rescuedSwap())).resolves.toEqual({
                status: 'unavailable',
                reason: 'payment-lookup-failed'
            });
        });

        it('ignores an invoice a rescued record carries from the host', async () => {
            // the v13.2.2 rescue copied every host field, the invoice too
            const decode = jest.spyOn(Bolt11Utils, 'decode');
            paid();
            lockedUp(1000);
            await expect(
                verify(rescuedSwap({ invoice: 'lnbc-from-host' }))
            ).resolves.toEqual(shortOf(100000, 1000));
            expect(decode).not.toHaveBeenCalled();
            expect(getPayments).toHaveBeenCalled();
            decode.mockRestore();
        });

        it('does not look up payments for a swap with an on-chain amount', async () => {
            esplora(200);
            await expect(verify()).resolves.toEqual({ status: 'ok' });
            expect(getPayments).not.toHaveBeenCalled();
        });
    });

    describe('a swap created before the creation-time amount check', () => {
        const getPayments = BackendUtils.getPayments as jest.Mock;
        let decode: jest.SpyInstance;

        // v13.2.2 stored the host's onchainAmount unchecked; here the host
        // set it as low as the lockup it means to send
        const legacySwap = (overrides: any = {}) =>
            storedSwap({
                onchainAmountVerified: undefined,
                onchainAmount: 1000,
                invoice: 'lnbc-legacy',
                ...overrides
            });

        const lockedUp = (value: number) =>
            esplora(200, {
                vout: [
                    {
                        scriptpubkey: VALID.outputScript.toString('hex'),
                        value
                    }
                ],
                status: { confirmed: true }
            });

        beforeEach(() => {
            decode = jest
                .spyOn(Bolt11Utils, 'decode')
                .mockReturnValue({ satoshis: 100000 } as any);
        });

        afterEach(() => decode.mockRestore());

        it('asks before claiming a lockup that matches the low stored amount', async () => {
            lockedUp(1000);
            await expect(verify(legacySwap())).resolves.toEqual({
                status: 'confirm-amount',
                amount: 1000,
                paidAmount: 100000
            });
            expect(decode).toHaveBeenCalledWith('lnbc-legacy');
            expect(getPayments).not.toHaveBeenCalled();
        });

        it('claims without asking when the lockup is at least 90% of the invoice', async () => {
            lockedUp(99100);
            await expect(verify(legacySwap())).resolves.toEqual({
                status: 'ok'
            });
            expect(getPayments).not.toHaveBeenCalled();
        });

        it('still refuses a lockup below the stored amount', async () => {
            // above 90% of the invoice, but short of what the host promised
            lockedUp(95000);
            await expect(
                verify(legacySwap({ onchainAmount: ONCHAIN_AMOUNT }))
            ).resolves.toEqual({ status: 'invalid', reason: 'underfunded' });
        });

        it('claims once the user confirms the amount, without reading the invoice', async () => {
            lockedUp(1000);
            await expect(
                newStore().verifyReverseLockup(
                    legacySwap(),
                    LOCKUP_TX.toHex(),
                    { confirmedLockupAmount: 1000 }
                )
            ).resolves.toEqual({ status: 'ok' });
            expect(decode).not.toHaveBeenCalled();
            expect(getPayments).not.toHaveBeenCalled();
        });

        it('falls back to the payment lookup when the invoice cannot be read', async () => {
            decode.mockImplementation(() => {
                throw new Error('bad invoice');
            });
            getPayments.mockResolvedValue({ payments: [] });
            lockedUp(1000);
            await expect(verify(legacySwap())).resolves.toEqual({
                status: 'confirm-amount',
                amount: 1000
            });
            expect(getPayments).toHaveBeenCalled();
        });

        it('keeps the stored amount as the floor once the swap was checked at creation', async () => {
            lockedUp(1000);
            await expect(
                verify(legacySwap({ onchainAmountVerified: true }))
            ).resolves.toEqual({ status: 'ok' });
            expect(decode).not.toHaveBeenCalled();
        });
    });
});

describe('SwapStore.lockupSpentBy', () => {
    const SPENDER = 'cd'.repeat(32);
    const LOCKUP = 'ef'.repeat(32);
    const PREIMAGE_HEX = PREIMAGE.toString('hex');
    const spenderWith = (vin: any) =>
        fetchMock.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => ({ vin })
        });
    const spentBy = () =>
        newStore().lockupSpentBy(SPENDER, LOCKUP, 1, PREIMAGE_HEX);

    beforeEach(() => fetchMock.mockReset());

    it('reads a key-path spend as a claim', async () => {
        spenderWith([{ txid: LOCKUP, vout: 1, witness: ['ab'.repeat(64)] }]);
        await expect(spentBy()).resolves.toBe('claim');
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${SPENDER}`
        );
    });

    it('reads a claim-leaf spend that reveals the preimage as a claim', async () => {
        spenderWith([
            { txid: 'aa'.repeat(32), vout: 0, witness: ['sig'] },
            {
                txid: LOCKUP.toUpperCase(),
                vout: 1,
                witness: [
                    'sig',
                    PREIMAGE_HEX.toUpperCase(),
                    'claimscript',
                    'control'
                ]
            }
        ]);
        await expect(spentBy()).resolves.toBe('claim');
    });

    it('reads any other spend as the refund', async () => {
        spenderWith([
            {
                txid: LOCKUP,
                vout: 1,
                witness: ['sig', 'refundscript', 'control']
            }
        ]);
        await expect(spentBy()).resolves.toBe('refund');
    });

    it('only reads the input for the lockup output', async () => {
        // a key-path spend of another output of the lockup transaction
        spenderWith([
            { txid: LOCKUP, vout: 0, witness: ['sig'] },
            { txid: LOCKUP, vout: 1, witness: ['sig', 'refundscript', 'c'] }
        ]);
        await expect(spentBy()).resolves.toBe('refund');
    });

    it.each([
        [
            'an error status',
            () => fetchMock.mockResolvedValue({ info: () => ({ status: 404 }) })
        ],
        ['no inputs', () => spenderWith(undefined)],
        [
            'no input for the lockup',
            () => spenderWith([{ txid: LOCKUP, vout: 0, witness: ['sig'] }])
        ],
        ['no witness', () => spenderWith([{ txid: LOCKUP, vout: 1 }])],
        ['a failed request', () => fetchMock.mockRejectedValue(new Error())]
    ])('is unknown on %s', async (_case, setUp) => {
        setUp();
        await expect(spentBy()).resolves.toBeUndefined();
    });

    it('does not request a txid that is not 64 hex characters', async () => {
        await expect(
            newStore().lockupSpentBy('../blocks', LOCKUP, 1, PREIMAGE_HEX)
        ).resolves.toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('SwapStore.checkStoredClaim', () => {
    const LOCKUP_TXID = 'ef'.repeat(32);
    const claimTx = () => {
        const tx = new Transaction();
        // inputs carry the txid in internal (reversed) byte order
        tx.addInput(Buffer.from(LOCKUP_TXID, 'hex').reverse(), 2);
        tx.addOutput(VALID.outputScript, 1000);
        return tx;
    };
    const CLAIM = claimTx();
    const SPENDER = 'cd'.repeat(32);
    const respond = (outspend: any, spender?: any) =>
        fetchMock.mockImplementation(async (_method: string, url: string) =>
            url.includes('/outspend/')
                ? { info: () => ({ status: 200 }), json: () => outspend }
                : spender
                ? { info: () => ({ status: 200 }), json: () => spender }
                : { info: () => ({ status: 404 }) }
        );
    const check = (hex = CLAIM.toHex()) =>
        newStore().checkStoredClaim(hex, JSON.parse(JSON.stringify(PREIMAGE)));

    beforeEach(() => fetchMock.mockReset());

    it('allows the resend while the lockup is unspent', async () => {
        respond({ spent: false });
        await expect(check()).resolves.toEqual({ status: 'ok' });
        expect(fetchMock).toHaveBeenCalledWith(
            'GET',
            `https://mempool.test/api/tx/${LOCKUP_TXID}/outspend/2`
        );
    });

    it('allows the resend when the stored claim is the spender', async () => {
        respond({ spent: true, txid: CLAIM.getId() });
        await expect(check()).resolves.toEqual({ status: 'ok' });
    });

    it.each([
        ['the refund leaf', ['sig', 'refundscript', 'control'], 'refund'],
        ['the preimage', ['sig', PREIMAGE.toString('hex'), 's', 'c'], 'claim']
    ])(
        'names another spender with %s in its witness',
        async (_case, witness, spentBy) => {
            respond(
                { spent: true, txid: SPENDER },
                { vin: [{ txid: LOCKUP_TXID, vout: 2, witness }] }
            );
            await expect(check()).resolves.toEqual({
                status: 'invalid',
                reason: 'lockup-spent',
                spendingTxid: SPENDER,
                spentBy
            });
        }
    );

    it('leaves the spender unknown when it cannot be looked up', async () => {
        respond({ spent: true, txid: SPENDER });
        await expect(check()).resolves.toEqual({
            status: 'invalid',
            reason: 'lockup-spent',
            spendingTxid: SPENDER,
            spentBy: undefined
        });
    });

    it.each([
        [
            'an error status',
            () => fetchMock.mockResolvedValue({ info: () => ({ status: 500 }) })
        ],
        ['malformed outspend data', () => respond({ spent: 'true' })],
        ['a failed request', () => fetchMock.mockRejectedValue(new Error())]
    ])('is unavailable on %s', async (_case, setUp) => {
        setUp();
        await expect(check()).resolves.toMatchObject({ status: 'unavailable' });
    });

    it('fails closed on a stored claim that does not decode', async () => {
        await expect(check('zz')).resolves.toEqual({
            status: 'invalid',
            reason: 'undecodable-claim'
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('SwapStore.createReverseSwap on-chain amount minimum', () => {
    const INVOICE_AMOUNT = 100000;
    // 0.5% service fee, 300 sat claim and 400 sat lockup fee: the Swaps
    // screen shows 98800 sats to receive, and the claim pays 300 of the
    // lockup, so the provider has to lock up 99100, less 1 sat of
    // rounding slack
    const REVERSE_INFO = {
        hash: 'quote-hash',
        fees: { percentage: 0.5, minerFees: { claim: 300, lockup: 400 } }
    };

    const create = async ({
        onchainAmount = '99100',
        invoiceAmount = INVOICE_AMOUNT,
        reverseInfo = REVERSE_INFO,
        duringRequest,
        responseData,
        feesResponse = { status: 200, json: { BTC: { BTC: REVERSE_INFO } } }
    }: {
        // the raw JSON text of the provider's onchainAmount
        onchainAmount?: string;
        invoiceAmount?: number;
        reverseInfo?: any;
        duringRequest?: (store: SwapStore) => void;
        // replaces the whole POST /swap/reverse response body
        responseData?: string;
        // what GET /swap/submarine and /swap/reverse return
        feesResponse?: { status: number; json: any };
    } = {}) => {
        storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
        const { outputScript: _outputScript, ...details } = VALID;
        const data = JSON.stringify({
            id: 'reverse-swap',
            invoice: 'lnbc-provider-invoice',
            onchainAmount: 0,
            ...details
        }).replace('"onchainAmount":0', `"onchainAmount":${onchainAmount}`);

        const store = newStore();
        store.reverseInfo = reverseInfo;
        fetchMock.mockImplementation(async (method: string, url: string) => {
            if (method === 'POST') {
                duringRequest?.(store);
                return { data: responseData ?? data };
            }
            if (/\/swap\/(submarine|reverse)$/.test(url)) {
                return {
                    info: () => ({ status: feesResponse.status }),
                    json: () => feesResponse.json
                };
            }
            return {
                info: () => ({ status: 200 }),
                text: () => String(TIMEOUT - 100)
            };
        });
        const navigation = { navigate: jest.fn() };
        const result = await store.createReverseSwap(
            'bc1qdestination',
            invoiceAmount,
            // at 1 sat/vB any claim fee floor stays below the 300 quoted
            '1',
            navigation
        );
        const stored = storageBacking[REVERSE_SWAPS_KEY]
            ? JSON.parse(storageBacking[REVERSE_SWAPS_KEY])
            : [];
        return { store, navigation, stored, result };
    };

    const expectRefused = ({ store, navigation, stored }: any) => {
        expect(store.apiError).toBe('views.Swaps.invalidReverseSwapResponse');
        expect(store.loading).toBe(false);
        expect(stored).toHaveLength(0);
        expect(navigation.navigate).not.toHaveBeenCalled();
    };

    it('accepts the amount shown plus the claim fee', async () => {
        const { store, stored } = await create();
        expect(store.apiError).toBe('');
        expect(stored).toHaveLength(1);
        expect(stored[0].onchainAmount).toBe(99100);
        expect(stored[0].claimMinerFee).toBe(300);
    });

    it('accepts one sat less, for the provider rounding its fee up', async () => {
        const { store, stored } = await create({ onchainAmount: '99099' });
        expect(store.apiError).toBe('');
        expect(stored).toHaveLength(1);
    });

    it.each(['98801', '99098'])(
        'refuses %s, which leaves less than the amount shown after the claim fee',
        async (onchainAmount) => {
            expectRefused(await create({ onchainAmount }));
        }
    );

    describe('at a fee rate Boltz rounds up past the exact fee', () => {
        // Boltz computes Math.ceil(0.07 / 100 * 1000000) = 701, one sat
        // more than the exact 700, and locks up 1000000 - 701 - 400
        const reverseInfo = {
            fees: { percentage: 0.07, minerFees: { claim: 300, lockup: 400 } }
        };
        const invoiceAmount = 1000000;

        it('accepts what Boltz locks up', async () => {
            expect(Math.ceil((0.07 / 100) * invoiceAmount)).toBe(701);
            const { store, stored } = await create({
                onchainAmount: '998899',
                invoiceAmount,
                reverseInfo
            });
            expect(store.apiError).toBe('');
            expect(stored).toHaveLength(1);
        });

        it('refuses one sat less', async () => {
            expectRefused(
                await create({
                    onchainAmount: '998898',
                    invoiceAmount,
                    reverseInfo
                })
            );
        });
    });

    it.each(['1e999', '[1e999]', '"99100"', '99100.5', '[99100]'])(
        'refuses an on-chain amount of %s',
        async (onchainAmount) => {
            expectRefused(await create({ onchainAmount }));
        }
    );

    it('does not let a negative claim quote lower the minimum below the amount shown', async () => {
        // still 700 sats of miner fees and 98800 shown
        const reverseInfo = {
            fees: {
                percentage: 0.5,
                minerFees: { claim: -98000, lockup: 98700 }
            }
        };
        expectRefused(await create({ onchainAmount: '98799', reverseInfo }));
    });

    it('checks against the quote read before the request, not one that arrives during it', async () => {
        const result = await create({
            onchainAmount: '1000',
            duringRequest: (store) => {
                store.reverseInfo = {
                    fees: {
                        percentage: 0.5,
                        minerFees: { claim: 300, lockup: 300000 }
                    }
                };
            }
        });
        expectRefused(result);
    });

    it('stores the claim fee from the quote read before the request', async () => {
        const { stored } = await create({
            duringRequest: (store) => {
                store.reverseInfo = {
                    fees: {
                        percentage: 0.5,
                        minerFees: { claim: 5000, lockup: 400 }
                    }
                };
            }
        });
        expect(stored).toHaveLength(1);
        expect(stored[0].claimMinerFee).toBe(300);
    });

    describe('pair hash', () => {
        const postedBody = () => {
            const post = fetchMock.mock.calls.find(
                ([method]: any[]) => method === 'POST'
            );
            return JSON.parse(post[3]);
        };

        it('sends the hash of the quote the user saw', async () => {
            await create({
                duringRequest: (store) => {
                    store.reverseInfo = { ...REVERSE_INFO, hash: 'newer' };
                }
            });
            expect(postedBody().pairHash).toBe('quote-hash');
        });

        it('sends no pair hash when the quote has none', async () => {
            const { hash: _hash, ...reverseInfo } = REVERSE_INFO;
            const { stored } = await create({ reverseInfo });
            expect(postedBody()).not.toHaveProperty('pairHash');
            expect(stored).toHaveLength(1);
        });

        it('refreshes the quote and asks to retry when the fees changed', async () => {
            const newQuote = {
                hash: 'new-hash',
                fees: {
                    percentage: 0.5,
                    minerFees: { claim: 300, lockup: 500 }
                }
            };
            const { store, navigation, stored, result } = await create({
                responseData: JSON.stringify({ error: 'invalid pair hash' }),
                feesResponse: { status: 200, json: { BTC: { BTC: newQuote } } }
            });
            expect(result).toBe('fees-changed');
            expect(store.reverseInfo).toEqual(newQuote);
            expect(store.apiError).toBe('views.Swaps.swapFeesChanged');
            expect(store.loading).toBe(false);
            expect(stored).toHaveLength(0);
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('does not report a fee change for other provider errors', async () => {
            const { store, result } = await create({
                responseData: JSON.stringify({ error: 'amount too low' })
            });
            expect(result).toBeUndefined();
            expect(store.apiError).toBe('amount too low');
            expect(store.reverseInfo).toEqual(REVERSE_INFO);
        });

        it('shows the fetch error when the refresh fails', async () => {
            const { store, stored, result } = await create({
                responseData: JSON.stringify({ error: 'invalid pair hash' }),
                feesResponse: { status: 200, json: {} }
            });
            expect(result).toBe('fees-changed');
            expect(store.apiError).toBe('views.Swaps.fetchFeesFailed');
            expect(store.loading).toBe(false);
            expect(stored).toHaveLength(0);
        });
    });
});
