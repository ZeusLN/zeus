jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ LinearProgress: 'LinearProgress' }));
jest.mock('react-native-blob-util', () => ({}));
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
        createReverseClaimTransaction: jest.fn()
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
import SwapDetails from './SwapDetails';
import lndMobile from '../../lndmobile/LndMobileInjection';
import { ReverseClaimTransaction } from '../../models/ClaimTransaction';
import { SwapType } from '../../models/Swap';

const nativeClaim = lndMobile.swaps.createReverseClaimTransaction as jest.Mock;

const originalWebSocket = global.WebSocket;
let socket: any;
let unexpectedErrors: any[][];

beforeEach(() => {
    jest.useFakeTimers();
    nativeClaim.mockReset();
    (ReverseClaimTransaction.build as jest.Mock).mockClear();
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
        statusColor: () => '#000'
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
