jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ LinearProgress: 'LinearProgress' }));
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} },
    unitsStore: { resetUnits: jest.fn() }
}));
jest.mock('../../utils/handleAnything', () => jest.fn());
jest.mock('../../utils/BackendUtils', () => ({
    supportsOnchainReceiving: () => true
}));
jest.mock('../../utils/UrlUtils', () => ({}));
// the real SwapUtils below touches the filesystem and save dialog for the
// rescue key export; neither is exercised here
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
// keep the real helpers, so exports added later (e.g. nativeSwapEndpoint
// from #4944) don't turn into undefined functions here
jest.mock('../../utils/SwapUtils', () => ({
    ...jest.requireActual('../../utils/SwapUtils'),
    swapWebSocketUrl: () => 'wss://swap.test'
}));
jest.mock('../../utils/UnitsUtils', () => ({
    numberWithCommas: (s: string) => s
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../utils/SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../lndmobile/LndMobileInjection', () => ({
    swaps: {
        createClaimTransaction: jest.fn(),
        buildReverseClaimTransaction: jest.fn()
    }
}));
jest.mock('../../models/ClaimTransaction', () => ({
    ReverseClaimTransaction: {
        build: jest.fn(() => ({ preimageHex: 'test' }))
    },
    SubmarineClaimTransaction: { build: jest.fn() }
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => (
            <Text testID="error">{message}</Text>
        ),
        WarningMessage: ({ message }: any) => (
            <Text testID="notice">{message}</Text>
        )
    };
});
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../../assets/images/SVG/QR.svg', () => 'QR');

import * as React from 'react';
import { Alert } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { crypto } from 'bitcoinjs-lib';
import SwapDetails from './SwapDetails';
import lndMobile from '../../lndmobile/LndMobileInjection';
import Bolt11Utils from '../../utils/Bolt11Utils';
import {
    ReverseClaimTransaction,
    SubmarineClaimTransaction
} from '../../models/ClaimTransaction';
import { SwapType } from '../../models/Swap';

// builds and signs the claim; the app broadcasts it through the store
const nativeClaim = lndMobile.swaps.buildReverseClaimTransaction as jest.Mock;

const originalWebSocket = global.WebSocket;
let socket: any;
let unexpectedErrors: any[][];

beforeEach(() => {
    jest.useFakeTimers();
    nativeClaim.mockReset();
    nativeClaim.mockResolvedValue('claimhex');
    (ReverseClaimTransaction.build as jest.Mock).mockClear();
    (SubmarineClaimTransaction.build as jest.Mock).mockClear();
    socket = { close: jest.fn(), send: jest.fn() };
    global.WebSocket = jest.fn(() => socket) as any;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // the view logs rejected lockups; anything else, act warnings
    // included, fails the test
    unexpectedErrors = [];
    jest.spyOn(console, 'error').mockImplementation((...args) => {
        if (args[0] !== 'Reverse swap lockup verification failed:') {
            unexpectedErrors.push(args);
        }
    });
});

afterEach(() => {
    expect(unexpectedErrors).toEqual([]);
    global.WebSocket = originalWebSocket;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

// Opens the details of a reverse swap waiting for its lockup. Mounting
// subscribes to the host's updates over the mocked WebSocket.
const renderView = async (
    swapData: any = {},
    params: any = {},
    props: any = {}
) => {
    const store = {
        claimMinerFee: 100,
        getSwapFees: jest.fn(),
        getReverseSwapReceiveAmount: jest.fn(() => 0),
        updateSwapStatus: jest.fn().mockResolvedValue(undefined),
        verifyReverseLockup: jest.fn().mockResolvedValue({ status: 'ok' }),
        resolveClaimAddress: jest.fn(
            async ({ destinationAddress }: any) =>
                destinationAddress || 'bc1qwallet'
        ),
        formatStatus: (status: string) => status,
        statusColor: () => '#000',
        saveClaimTransaction: jest.fn().mockResolvedValue(true),
        saveClaimTxid: jest.fn().mockResolvedValue(true),
        broadcastSwapTransaction: jest.fn().mockResolvedValue('claim-txid'),
        getReverseLockupTransactionHex: jest
            .fn()
            .mockResolvedValue({ status: 'none' }),
        checkStoredClaim: jest.fn().mockResolvedValue({ status: 'ok' })
    };
    const view = await render(
        <SwapDetails
            {...({
                navigation: { navigate: jest.fn() },
                // a stored host keeps its /v2 suffix, as in the app
                route: {
                    params: {
                        swapData: {
                            id: 'swap',
                            type: SwapType.Reverse,
                            destinationAddress: 'destination',
                            ...swapData
                        },
                        endpoint: 'https://provider.test/v2',
                        ...params
                    }
                },
                NodeInfoStore: { nodeInfo: { isTestNet: false } },
                SwapStore: store,
                InvoicesStore: {},
                ...props
            } as any)}
        />
    );
    return { store, unmount: view.unmount };
};

const sendUpdate = (args: any) =>
    act(() =>
        socket.onmessage({
            data: JSON.stringify({ event: 'update', args: [args] })
        })
    );

const sendConfirmedLockup = () =>
    sendUpdate({
        status: 'transaction.confirmed',
        transaction: { hex: 'txhex' }
    });

const sendStatus = (status: string) => sendUpdate({ status });

const FOUND = { status: 'found', hex: 'lockuphex' };

const advance = (ms: number) =>
    act(async () => {
        await jest.advanceTimersByTimeAsync(ms);
    });

const errorShown = () => screen.queryByTestId('error')?.props.children;
const noticeShown = () => screen.queryByTestId('notice')?.props.children;

const claimedTo = () =>
    (ReverseClaimTransaction.build as jest.Mock).mock.calls[0][0].swap
        .destinationAddress;

describe('SwapDetails reverse claim', () => {
    it('subscribes to the swap on mount', async () => {
        await renderView();
        expect(global.WebSocket).toHaveBeenCalledWith('wss://swap.test');
        socket.onopen();
        expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
            op: 'subscribe',
            channel: 'swap.update',
            args: ['swap']
        });
    });

    it.each([
        ['invalid', 'views.SwapDetails.lockupVerificationFailed', undefined],
        [
            'unconfirmed',
            undefined,
            'views.SwapDetails.waitingForLockupConfirmation'
        ],
        [
            'unavailable',
            undefined,
            'views.SwapDetails.lockupVerificationUnavailable'
        ]
    ])(
        'does not hand the preimage to native code when verification is %s',
        async (status, error, notice) => {
            const { store } = await renderView();
            store.verifyReverseLockup.mockResolvedValue({ status });

            await sendConfirmedLockup();

            expect(nativeClaim).not.toHaveBeenCalled();
            expect(errorShown()).toBe(error);
            expect(noticeShown()).toBe(notice);
        }
    );

    it('checks after a delayed address lookup, immediately before the native claim', async () => {
        let resolveAddress!: (address: string) => void;
        const address = new Promise<string>((resolve) => {
            resolveAddress = resolve;
        });
        const { store } = await renderView({ imported: true });
        store.resolveClaimAddress.mockReturnValue(address);

        // the update handler waits on the address lookup, so it is not
        // awaited until the lookup is released
        let update!: Promise<void>;
        await act(async () => {
            update = socket.onmessage({
                data: JSON.stringify({
                    event: 'update',
                    args: [
                        {
                            status: 'transaction.confirmed',
                            transaction: { hex: 'txhex' }
                        }
                    ]
                })
            });
        });
        expect(store.resolveClaimAddress).toHaveBeenCalled();
        expect(store.verifyReverseLockup).not.toHaveBeenCalled();

        store.verifyReverseLockup.mockResolvedValue({
            status: 'invalid',
            reason: 'refund-deadline'
        });
        await act(async () => {
            resolveAddress('bc1qwallet');
            await update;
        });

        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        expect(nativeClaim).not.toHaveBeenCalled();
        expect(errorShown()).toBe('views.SwapDetails.lockupVerificationFailed');
    });

    it('rechecks after a failed native attempt and stops if the output has been spent', async () => {
        const { store } = await renderView();
        store.verifyReverseLockup
            .mockResolvedValueOnce({ status: 'ok' })
            .mockResolvedValue({ status: 'invalid', reason: 'lockup-spent' });
        nativeClaim.mockRejectedValue(new Error('broadcast response lost'));

        await sendConfirmedLockup();

        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(2);
        expect(nativeClaim).toHaveBeenCalledTimes(1);
        expect(errorShown()).toBe('views.SwapDetails.lockupVerificationFailed');
    });

    it('claims a rescued swap to a wallet address, not one stored from the host', async () => {
        const { store } = await renderView({
            imported: true,
            destinationAddress: 'bc1qhost'
        });
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        expect(claimedTo()).toBe('bc1qwallet');
        expect(store.resolveClaimAddress).toHaveBeenCalledWith(
            expect.objectContaining({ destinationAddress: undefined })
        );
        expect(nativeClaim).toHaveBeenCalledTimes(1);
    });

    it('builds the claim without the host endpoint', async () => {
        await renderView();
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        // with the host's endpoint the native claim would post the
        // preimage there before broadcasting
        expect(
            (ReverseClaimTransaction.build as jest.Mock).mock.calls[0][0]
        ).not.toHaveProperty('endpoint');
        expect(nativeClaim).toHaveBeenCalledTimes(1);
    });

    it('claims a swap created on this device to the address picked for it', async () => {
        await renderView({ destinationAddress: 'bc1qpicked' });
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        expect(claimedTo()).toBe('bc1qpicked');
    });
});

describe('SwapDetails submarine claim', () => {
    it('builds the cooperative claim for the host without its /v2 suffix', async () => {
        const preimage = '11'.repeat(32);
        (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
            json: () => ({
                preimage,
                transactionHash: 'hash',
                pubNonce: 'nonce'
            })
        });
        jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
            payment_hash: crypto
                .sha256(Buffer.from(preimage, 'hex'))
                .toString('hex')
        } as any);
        await renderView({ type: SwapType.Submarine });

        await sendStatus('transaction.claim.pending');

        // the host's own claim details still come from the full API path
        expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledWith(
            'GET',
            'https://provider.test/v2/swap/submarine/swap/claim',
            expect.anything()
        );
        expect(SubmarineClaimTransaction.build).toHaveBeenCalledWith(
            expect.objectContaining({ endpoint: 'https://provider.test' })
        );
    });
});

describe('SwapDetails reverse claim fee', () => {
    const claimedFee = () =>
        (ReverseClaimTransaction.build as jest.Mock).mock.calls[0][0].minerFee;

    const claim = async (swapData: any, params: any = {}) => {
        const view = await renderView(swapData, params);
        nativeClaim.mockResolvedValue(undefined);
        await sendConfirmedLockup();
        return view;
    };

    it('raises a 1 sat claim fee to the rate on the largest claim', async () => {
        // a swap stored before the fee was decided at creation
        await claim({ claimMinerFee: 1 }, { fee: '25' });

        expect(claimedFee()).toBe(25 * 152);
        expect(nativeClaim).toHaveBeenCalledTimes(1);
    });

    it('pays the fee decided at creation', async () => {
        await claim({ claimMinerFee: 4000, claimFeeRate: 25 }, { fee: '25' });

        expect(claimedFee()).toBe(4000);
    });

    it('uses the rate stored with a swap reopened from the list', async () => {
        // reopened from the list or Activity: no rate in the route
        await claim({ claimMinerFee: 1, claimFeeRate: 25 });

        expect(claimedFee()).toBe(25 * 152);
    });

    it('claims a swap with no stored fee at the rate, not the current quote', async () => {
        const { store } = await renderView({}, { fee: '10' });
        store.claimMinerFee = 99999;
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        expect(claimedFee()).toBe(10 * 152);
        expect(store.getSwapFees).not.toHaveBeenCalled();
    });

    it('uses the current mempool rate for a swap with no stored rate', async () => {
        const FeeStore = {
            getOnchainFeesviaMempool: jest
                .fn()
                .mockResolvedValue({ fastestFee: 30 })
        };
        await renderView({ claimMinerFee: 1 }, {}, { FeeStore });
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        expect(claimedFee()).toBe(30 * 152);
    });

    it('does not look up a rate for a swap that has one stored', async () => {
        const FeeStore = { getOnchainFeesviaMempool: jest.fn() };
        await renderView(
            { claimMinerFee: 3800, claimFeeRate: 25 },
            {},
            { FeeStore }
        );
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        expect(claimedFee()).toBe(3800);
        expect(FeeStore.getOnchainFeesviaMempool).not.toHaveBeenCalled();
    });

    it('falls back to 2 sat/vB when no rate is stored or available', async () => {
        const FeeStore = {
            getOnchainFeesviaMempool: jest
                .fn()
                .mockRejectedValue(new Error('offline'))
        };
        await renderView({ claimMinerFee: 1 }, {}, { FeeStore });
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        expect(claimedFee()).toBe(2 * 152);
    });

    it('does not claim with a stored fee above the maximum', async () => {
        await claim({ claimMinerFee: 2000 * 152 + 1, claimFeeRate: 25 });

        expect(nativeClaim).not.toHaveBeenCalled();
        expect(errorShown()).toBe('views.SwapDetails.claimFailed');
    });

    it('shows the amount the claim pays out', async () => {
        const { store } = await renderView({
            claimMinerFee: 1,
            claimFeeRate: 25,
            onchainAmount: 99100
        });

        expect(store.getReverseSwapReceiveAmount).toHaveBeenCalledWith(
            99100,
            25 * 152
        );
    });
});

describe('SwapDetails lockup verification retry wiring', () => {
    it.each(['unavailable', 'unconfirmed'])(
        'rechecks a %s lockup and claims once it verifies, clearing the notice',
        async (status) => {
            const { store } = await renderView();
            store.verifyReverseLockup
                .mockResolvedValueOnce({ status })
                .mockResolvedValue({ status: 'ok' });
            nativeClaim.mockResolvedValue(undefined);

            await sendConfirmedLockup();
            expect(nativeClaim).not.toHaveBeenCalled();
            expect(noticeShown()).toBeDefined();

            await advance(60000);

            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(noticeShown()).toBeUndefined();
            expect(errorShown()).toBeUndefined();
        }
    );

    it.each(['unavailable', 'ok'])(
        'neither rechecks nor claims when a lookup in flight at unmount comes back %s',
        async (status) => {
            const { store, unmount } = await renderView();
            let resolveLookup!: (value: any) => void;
            store.verifyReverseLockup.mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveLookup = resolve;
                })
            );

            // keep the handler's promise out of act so it stays
            // pending until after unmount
            let update!: Promise<void>;
            await act(() => {
                update = socket.onmessage({
                    data: JSON.stringify({
                        event: 'update',
                        args: [
                            {
                                status: 'transaction.confirmed',
                                transaction: { hex: 'txhex' }
                            }
                        ]
                    })
                });
            });
            await advance(0);
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);

            await unmount();
            expect(socket.close).toHaveBeenCalled();
            resolveLookup({ status });
            await update;
            await jest.advanceTimersByTimeAsync(120000);

            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
            expect(nativeClaim).not.toHaveBeenCalled();
        }
    );

    it.each([
        'swap.expired',
        'invoice.expired',
        'transaction.failed',
        'invoice.settled'
    ])('cancels a scheduled recheck on %s', async (status) => {
        const { store } = await renderView();
        store.verifyReverseLockup.mockResolvedValue({ status: 'unavailable' });
        await sendConfirmedLockup();
        expect(noticeShown()).toBeDefined();

        await sendStatus(status);
        await advance(120000);

        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        expect(nativeClaim).not.toHaveBeenCalled();
        expect(socket.close).toHaveBeenCalled();
    });

    it('cancels a scheduled recheck when the host reports an error', async () => {
        const { store } = await renderView();
        store.verifyReverseLockup.mockResolvedValue({ status: 'unavailable' });
        await sendConfirmedLockup();

        await sendUpdate({ error: 'Operation timeout' });
        await advance(120000);

        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        expect(errorShown()).toBe('The operation timed out.');
    });

    describe('the signed claim', () => {
        it('stores the claim before broadcasting it, then records its txid', async () => {
            const { store } = await renderView();

            await sendConfirmedLockup();

            expect(store.saveClaimTransaction).toHaveBeenCalledWith(
                'swap',
                'claimhex'
            );
            expect(store.broadcastSwapTransaction).toHaveBeenCalledWith(
                'claimhex',
                'https://provider.test/v2'
            );
            expect(
                store.saveClaimTransaction.mock.invocationCallOrder[0]
            ).toBeLessThan(
                store.broadcastSwapTransaction.mock.invocationCallOrder[0]
            );
            expect(store.saveClaimTxid).toHaveBeenCalledWith(
                'swap',
                'claim-txid'
            );
        });

        it.each([
            [{ isTestNet: false }, 'mainnet'],
            [{ isTestNet: true }, 'testnet'],
            [{ isSigNet: true }, 'testnet'],
            [{ isRegTest: true }, 'regtest']
        ])('builds the claim for %j as %s', async (nodeInfo, network) => {
            await renderView({}, {}, { NodeInfoStore: { nodeInfo } });

            await sendConfirmedLockup();

            expect(nativeClaim).toHaveBeenCalledWith(
                expect.objectContaining({ network })
            );
        });

        it('resends the same claim when a broadcast fails, without rebuilding or rechecking', async () => {
            const { store } = await renderView();
            store.broadcastSwapTransaction
                .mockRejectedValueOnce(new Error('mempool down'))
                .mockResolvedValueOnce('claim-txid');

            await sendConfirmedLockup();

            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(2);
            expect(store.broadcastSwapTransaction).toHaveBeenLastCalledWith(
                'claimhex',
                'https://provider.test/v2'
            );
            expect(store.saveClaimTxid).toHaveBeenCalledWith(
                'swap',
                'claim-txid'
            );
        });

        it('keeps the claim and reports it when every broadcast fails', async () => {
            const { store } = await renderView();
            store.broadcastSwapTransaction.mockRejectedValue(
                new Error('mempool down')
            );

            await sendConfirmedLockup();

            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(store.saveClaimTransaction).toHaveBeenCalledTimes(1);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(11);
            expect(store.saveClaimTxid).not.toHaveBeenCalled();
            expect(errorShown()).toBe('views.SwapDetails.claimBroadcastFailed');
        });

        it('sends the stored claim again a minute after every broadcast fails', async () => {
            const { store } = await renderView();
            store.broadcastSwapTransaction.mockRejectedValue(
                new Error('mempool down')
            );

            await sendConfirmedLockup();
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(11);

            store.broadcastSwapTransaction.mockReset();
            store.broadcastSwapTransaction.mockResolvedValue('claim-txid');
            await advance(59000);
            expect(store.broadcastSwapTransaction).not.toHaveBeenCalled();

            await advance(2000);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(1);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledWith(
                'claimhex',
                'https://provider.test/v2'
            );
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(store.saveClaimTxid).toHaveBeenCalledWith(
                'swap',
                'claim-txid'
            );
            expect(errorShown()).toBeUndefined();

            await advance(120000);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(1);
        });

        it('keeps sending a claim stored on an earlier visit', async () => {
            const { store } = await renderView({
                claimTransactionHex: 'storedhex'
            });
            store.broadcastSwapTransaction.mockRejectedValue(
                new Error('mempool down')
            );

            await sendStatus('invoice.settled');
            await advance(60000);
            await advance(60000);

            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(33);
            expect(store.getReverseLockupTransactionHex).not.toHaveBeenCalled();
            expect(nativeClaim).not.toHaveBeenCalled();
            expect(errorShown()).toBe('views.SwapDetails.claimBroadcastFailed');
        });

        it('stops sending the stored claim once the screen is closed', async () => {
            const { store, unmount } = await renderView();
            store.broadcastSwapTransaction.mockRejectedValue(
                new Error('mempool down')
            );

            await sendConfirmedLockup();
            await unmount();
            await jest.advanceTimersByTimeAsync(180000);

            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(11);
        });

        it('does not schedule another send when the screen closes during a broadcast', async () => {
            const { store, unmount } = await renderView({
                claimTransactionHex: 'storedhex'
            });
            let fail!: (error: Error) => void;
            store.broadcastSwapTransaction
                .mockReturnValueOnce(
                    new Promise((_resolve, reject) => {
                        fail = reject;
                    })
                )
                .mockRejectedValue(new Error('mempool down'));

            let settled!: Promise<void>;
            await act(async () => {
                settled = socket.onmessage({
                    data: JSON.stringify({
                        event: 'update',
                        args: [{ status: 'invoice.settled' }]
                    })
                });
            });
            await unmount();
            const timers = jest.getTimerCount();
            fail(new Error('mempool down'));
            await settled;

            // a claim that may have reached the host is still sent in full
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(11);
            expect(jest.getTimerCount()).toBe(timers);
        });

        it('does not retry when no claim could be built', async () => {
            const { store } = await renderView();
            nativeClaim.mockRejectedValue(new Error('build failed'));

            await sendConfirmedLockup();
            const builds = nativeClaim.mock.calls.length;
            await advance(180000);

            expect(nativeClaim).toHaveBeenCalledTimes(builds);
            expect(store.broadcastSwapTransaction).not.toHaveBeenCalled();
            expect(errorShown()).toBe('views.SwapDetails.claimBroadcastFailed');
        });

        it('resends a claim stored on an earlier visit without rechecking or rebuilding', async () => {
            const { store } = await renderView({
                claimTransactionHex: 'storedhex'
            });

            await sendConfirmedLockup();

            expect(store.verifyReverseLockup).not.toHaveBeenCalled();
            expect(nativeClaim).not.toHaveBeenCalled();
            expect(store.broadcastSwapTransaction).toHaveBeenCalledWith(
                'storedhex',
                'https://provider.test/v2'
            );
        });

        it('leaves a swap alone once its claim has been broadcast', async () => {
            const { store } = await renderView({
                claimTransactionHex: 'storedhex',
                claimTxid: 'claim-txid'
            });

            await sendConfirmedLockup();
            await sendStatus('invoice.settled');

            expect(store.verifyReverseLockup).not.toHaveBeenCalled();
            expect(store.broadcastSwapTransaction).not.toHaveBeenCalled();
        });
    });

    describe('invoice.settled before the claim was broadcast', () => {
        it('resends a stored claim', async () => {
            const { store } = await renderView({
                claimTransactionHex: 'storedhex'
            });

            await sendStatus('invoice.settled');

            expect(store.getReverseLockupTransactionHex).not.toHaveBeenCalled();
            expect(store.broadcastSwapTransaction).toHaveBeenCalledWith(
                'storedhex',
                'https://provider.test/v2'
            );
            expect(store.saveClaimTxid).toHaveBeenCalled();
        });

        // #5288 review: after the timeout the host can refund, and the
        // stored claim can then never confirm
        describe('checks the lockup before resending a stored claim', () => {
            const spent = (spentBy?: string) => ({
                status: 'invalid',
                reason: 'lockup-spent',
                spendingTxid: 'spender',
                spentBy
            });

            it('looks up the lockup the stored claim spends', async () => {
                const { store } = await renderView({
                    claimTransactionHex: 'storedhex',
                    preimage: 'preimage'
                });

                await sendStatus('invoice.settled');

                expect(store.checkStoredClaim).toHaveBeenCalledWith(
                    'storedhex',
                    'preimage'
                );
            });

            it("stops and reports the host's refund", async () => {
                const { store } = await renderView({
                    claimTransactionHex: 'storedhex'
                });
                store.checkStoredClaim.mockResolvedValue(spent('refund'));

                await sendStatus('invoice.settled');
                await advance(180000);

                expect(store.broadcastSwapTransaction).not.toHaveBeenCalled();
                expect(store.checkStoredClaim).toHaveBeenCalledTimes(1);
                expect(errorShown()).toBe(
                    'views.SwapDetails.lockupSpentElsewhere'
                );
            });

            it('stops once the retry finds the lockup refunded', async () => {
                const { store } = await renderView({
                    claimTransactionHex: 'storedhex'
                });
                store.broadcastSwapTransaction.mockRejectedValue(
                    new Error('missing inputs')
                );

                await sendStatus('invoice.settled');
                expect(errorShown()).toBe(
                    'views.SwapDetails.claimBroadcastFailed'
                );

                store.checkStoredClaim.mockResolvedValue(spent('refund'));
                await advance(61000);
                await advance(180000);

                expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(
                    11
                );
                expect(store.checkStoredClaim).toHaveBeenCalledTimes(2);
                expect(errorShown()).toBe(
                    'views.SwapDetails.lockupSpentElsewhere'
                );
            });

            it('stops without an error when another claim spent it', async () => {
                const { store } = await renderView({
                    claimTransactionHex: 'storedhex'
                });
                store.checkStoredClaim.mockResolvedValue(spent('claim'));

                await sendStatus('invoice.settled');
                await advance(180000);

                expect(store.broadcastSwapTransaction).not.toHaveBeenCalled();
                expect(errorShown()).toBeUndefined();
                expect(noticeShown()).toBeUndefined();
            });

            it('checks again later, without sending, when the spender is unknown', async () => {
                const { store } = await renderView({
                    claimTransactionHex: 'storedhex'
                });
                store.checkStoredClaim.mockResolvedValue(spent(undefined));

                await sendStatus('invoice.settled');
                expect(noticeShown()).toBe(
                    'views.SwapDetails.lockupVerificationUnavailable'
                );

                store.checkStoredClaim.mockResolvedValue(spent('refund'));
                await advance(61000);

                expect(store.broadcastSwapTransaction).not.toHaveBeenCalled();
                expect(errorShown()).toBe(
                    'views.SwapDetails.lockupSpentElsewhere'
                );
            });

            it('still sends the claim when the lockup cannot be looked up', async () => {
                const { store } = await renderView({
                    claimTransactionHex: 'storedhex'
                });
                store.checkStoredClaim.mockResolvedValue({
                    status: 'unavailable'
                });

                await sendStatus('invoice.settled');

                expect(store.broadcastSwapTransaction).toHaveBeenCalledWith(
                    'storedhex',
                    'https://provider.test/v2'
                );
                expect(store.saveClaimTxid).toHaveBeenCalled();
            });
        });

        it('fetches the lockup and claims it through the usual checks', async () => {
            const { store } = await renderView();
            store.getReverseLockupTransactionHex.mockResolvedValue(FOUND);

            await sendStatus('invoice.settled');
            await advance(2000);

            expect(store.getReverseLockupTransactionHex).toHaveBeenCalledWith(
                'swap',
                'https://provider.test/v2'
            );
            expect(store.verifyReverseLockup).toHaveBeenCalledWith(
                expect.anything(),
                'lockuphex',
                expect.anything()
            );
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledWith(
                'claimhex',
                'https://provider.test/v2'
            );
        });

        const SPENT = {
            status: 'invalid',
            reason: 'lockup-spent',
            spendingTxid: 'spender',
            spentBy: 'claim'
        };
        const REFUNDED = { ...SPENT, spentBy: 'refund' };

        it('treats a lockup spent by our claim as done, not as an error', async () => {
            const { store } = await renderView();
            store.getReverseLockupTransactionHex.mockResolvedValue(FOUND);
            store.verifyReverseLockup.mockResolvedValue(SPENT);

            await sendStatus('invoice.settled');
            await advance(120000);

            expect(nativeClaim).not.toHaveBeenCalled();
            expect(errorShown()).toBeUndefined();
            expect(noticeShown()).toBeUndefined();
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        });

        // #5288 review: the original device's claim pays an address this
        // device never had, and must not read as a refund
        it('treats a rescued swap claimed on another device as done', async () => {
            const { store } = await renderView({
                imported: true,
                destinationAddress: undefined
            });
            store.getReverseLockupTransactionHex.mockResolvedValue(FOUND);
            store.verifyReverseLockup.mockResolvedValue(SPENT);

            await sendStatus('invoice.settled');
            await advance(120000);

            expect(nativeClaim).not.toHaveBeenCalled();
            expect(errorShown()).toBeUndefined();
            expect(noticeShown()).toBeUndefined();
        });

        it("reports a lockup spent by the host's refund", async () => {
            const { store } = await renderView();
            store.getReverseLockupTransactionHex.mockResolvedValue(FOUND);
            store.verifyReverseLockup.mockResolvedValue(REFUNDED);

            await sendStatus('invoice.settled');
            await advance(120000);

            expect(nativeClaim).not.toHaveBeenCalled();
            expect(errorShown()).toBe('views.SwapDetails.lockupSpentElsewhere');
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        });

        it.each([
            [
                'the spender cannot be looked up',
                { ...SPENT, spentBy: undefined }
            ],
            [
                'the mempool instance does not name the spender',
                { status: 'invalid', reason: 'lockup-spent' }
            ]
        ])('checks again later when %s', async (_case, spent) => {
            const { store } = await renderView();
            store.getReverseLockupTransactionHex.mockResolvedValue(FOUND);
            store.verifyReverseLockup.mockResolvedValue(spent);

            await sendStatus('invoice.settled');
            await advance(2000);

            expect(errorShown()).toBeUndefined();
            expect(noticeShown()).toBe(
                'views.SwapDetails.lockupVerificationUnavailable'
            );

            store.verifyReverseLockup.mockResolvedValue(SPENT);
            await advance(60000);
            await advance(2000);

            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(2);
            expect(noticeShown()).toBeUndefined();
            expect(errorShown()).toBeUndefined();
        });

        it('stops checking the spender once the screen is closed', async () => {
            const { store, unmount } = await renderView();
            store.getReverseLockupTransactionHex.mockResolvedValue(FOUND);
            store.verifyReverseLockup.mockResolvedValue({
                ...SPENT,
                spentBy: undefined
            });

            await sendStatus('invoice.settled');
            await advance(2000);
            await unmount();
            await jest.advanceTimersByTimeAsync(180000);

            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        });

        it('still reports any other failed check', async () => {
            const { store } = await renderView();
            store.getReverseLockupTransactionHex.mockResolvedValue(FOUND);
            store.verifyReverseLockup.mockResolvedValue({
                status: 'invalid',
                reason: 'refund-deadline'
            });

            await sendStatus('invoice.settled');
            await advance(2000);

            expect(nativeClaim).not.toHaveBeenCalled();
            expect(errorShown()).toBe(
                'views.SwapDetails.lockupVerificationFailed'
            );
        });

        it('does nothing more when the host has no lockup to give', async () => {
            const { store } = await renderView();

            await sendStatus('invoice.settled');
            await advance(120000);

            expect(store.getReverseLockupTransactionHex).toHaveBeenCalledTimes(
                1
            );
            expect(store.verifyReverseLockup).not.toHaveBeenCalled();
            expect(nativeClaim).not.toHaveBeenCalled();
            expect(noticeShown()).toBeUndefined();
        });

        it('asks the host again when it cannot be reached, and says so', async () => {
            const { store } = await renderView();
            store.getReverseLockupTransactionHex
                .mockResolvedValueOnce({ status: 'unavailable' })
                .mockResolvedValueOnce({ status: 'unavailable' })
                .mockResolvedValue(FOUND);

            await sendStatus('invoice.settled');

            expect(noticeShown()).toBe(
                'views.SwapDetails.lockupVerificationUnavailable'
            );
            expect(store.verifyReverseLockup).not.toHaveBeenCalled();

            await advance(60000);
            expect(store.getReverseLockupTransactionHex).toHaveBeenCalledTimes(
                2
            );
            expect(store.verifyReverseLockup).not.toHaveBeenCalled();

            await advance(60000);
            await advance(2000);
            expect(store.getReverseLockupTransactionHex).toHaveBeenCalledTimes(
                3
            );
            expect(store.verifyReverseLockup).toHaveBeenCalledWith(
                expect.anything(),
                'lockuphex',
                expect.anything()
            );
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(store.saveClaimTxid).toHaveBeenCalledWith(
                'swap',
                'claim-txid'
            );
            expect(noticeShown()).toBeUndefined();
        });

        it('stops asking the host once the screen is closed', async () => {
            const { store, unmount } = await renderView();
            store.getReverseLockupTransactionHex.mockResolvedValue({
                status: 'unavailable'
            });

            await sendStatus('invoice.settled');
            await unmount();
            await jest.advanceTimersByTimeAsync(180000);

            expect(store.getReverseLockupTransactionHex).toHaveBeenCalledTimes(
                1
            );
        });

        it('does not schedule another try when the screen closes during the request', async () => {
            const { store, unmount } = await renderView();
            let answer!: (value: any) => void;
            store.getReverseLockupTransactionHex.mockReturnValueOnce(
                new Promise((resolve) => {
                    answer = resolve;
                })
            );

            let settled!: Promise<void>;
            await act(async () => {
                settled = socket.onmessage({
                    data: JSON.stringify({
                        event: 'update',
                        args: [{ status: 'invoice.settled' }]
                    })
                });
            });
            await unmount();
            const timers = jest.getTimerCount();
            answer({ status: 'unavailable' });
            await settled;

            expect(jest.getTimerCount()).toBe(timers);
            await jest.advanceTimersByTimeAsync(180000);

            expect(store.getReverseLockupTransactionHex).toHaveBeenCalledTimes(
                1
            );
        });

        it('leaves a claim still being built to finish', async () => {
            // the host settles as soon as the cooperative request inside the
            // native build gives it the preimage, before the build returns
            let resolveBuild!: (hex: string) => void;
            nativeClaim.mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveBuild = resolve;
                })
            );
            const { store } = await renderView();

            // the update handler waits on the build, so it is not awaited
            // until the build is released
            let confirmed!: Promise<void>;
            await act(async () => {
                confirmed = socket.onmessage({
                    data: JSON.stringify({
                        event: 'update',
                        args: [
                            {
                                status: 'transaction.confirmed',
                                transaction: { hex: 'txhex' }
                            }
                        ]
                    })
                });
            });
            await advance(1000);
            expect(nativeClaim).toHaveBeenCalledTimes(1);

            await sendStatus('invoice.settled');
            await act(async () => {
                resolveBuild('claimhex');
                await confirmed;
            });

            expect(store.getReverseLockupTransactionHex).not.toHaveBeenCalled();
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(1);
            expect(store.saveClaimTxid).toHaveBeenCalledWith(
                'swap',
                'claim-txid'
            );
        });

        it('does not claim again after a claim broadcast on this screen', async () => {
            const { store } = await renderView();

            await sendConfirmedLockup();
            await sendStatus('invoice.settled');

            expect(store.getReverseLockupTransactionHex).not.toHaveBeenCalled();
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(store.broadcastSwapTransaction).toHaveBeenCalledTimes(1);
        });
    });

    describe('a lockup amount nothing in the wallet vouches for', () => {
        const alertButtons = (alert: jest.SpyInstance) =>
            alert.mock.calls[alert.mock.calls.length - 1][2];

        it('asks before claiming and claims once the user confirms', async () => {
            const alert = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});
            const { store } = await renderView();
            store.verifyReverseLockup
                .mockResolvedValueOnce({
                    status: 'confirm-amount',
                    amount: 1000
                })
                .mockResolvedValue({ status: 'ok' });
            nativeClaim.mockResolvedValue(undefined);

            await sendConfirmedLockup();
            expect(nativeClaim).not.toHaveBeenCalled();
            expect(alert).toHaveBeenCalledTimes(1);
            expect(alert.mock.calls[0][1]).toBe(
                'views.SwapDetails.confirmLockupAmount.message'
            );

            // another update while the prompt is up doesn't ask again
            await sendConfirmedLockup();
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
            expect(alert).toHaveBeenCalledTimes(1);

            await act(async () => alertButtons(alert)[1].onPress());
            await advance(2000);

            expect(store.verifyReverseLockup).toHaveBeenLastCalledWith(
                expect.anything(),
                'txhex',
                { confirmedLockupAmount: 1000 }
            );
            expect(nativeClaim).toHaveBeenCalledTimes(1);
        });

        it('shows what the user paid when the lockup falls short of it', async () => {
            const alert = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});
            const { store } = await renderView();
            store.verifyReverseLockup.mockResolvedValue({
                status: 'confirm-amount',
                amount: 1000,
                paidAmount: 10000
            });

            await sendConfirmedLockup();

            expect(alert.mock.calls[0][1]).toBe(
                'views.SwapDetails.confirmLockupAmount.shortfall'
            );
            expect(nativeClaim).not.toHaveBeenCalled();
        });

        it('does not claim or ask again once the user declines', async () => {
            const alert = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});
            const { store } = await renderView();
            store.verifyReverseLockup.mockResolvedValue({
                status: 'confirm-amount',
                amount: 1000
            });

            await sendConfirmedLockup();
            await act(async () => alertButtons(alert)[0].onPress());
            expect(errorShown()).toBe('views.SwapDetails.lockupAmountDeclined');

            await sendConfirmedLockup();
            await advance(120000);

            expect(alert).toHaveBeenCalledTimes(1);
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
            expect(nativeClaim).not.toHaveBeenCalled();
        });
    });

    it('shows a fatal verification error without scheduling another claim', async () => {
        const { store } = await renderView();
        store.verifyReverseLockup.mockResolvedValue({
            status: 'invalid',
            reason: 'refund-deadline'
        });

        await sendConfirmedLockup();
        await advance(120000);

        expect(errorShown()).toBe('views.SwapDetails.lockupVerificationFailed');
        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        expect(nativeClaim).not.toHaveBeenCalled();
    });
});
