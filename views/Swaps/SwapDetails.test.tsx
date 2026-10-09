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

const nativeClaim = lndMobile.swaps.createReverseClaimTransaction as jest.Mock;

const originalWebSocket = global.WebSocket;
let socket: any;
let unexpectedErrors: any[][];

beforeEach(() => {
    jest.useFakeTimers();
    nativeClaim.mockReset();
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
const renderView = async (swapData: any = {}) => {
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
                        endpoint: 'https://provider.test/v2'
                    }
                },
                NodeInfoStore: { nodeInfo: { isTestNet: false } },
                SwapStore: store,
                InvoicesStore: {}
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

    it('checks after a delayed fee lookup, immediately before the native claim', async () => {
        let resolveFees!: () => void;
        const fees = new Promise<void>((resolve) => {
            resolveFees = resolve;
        });
        const { store } = await renderView();
        store.claimMinerFee = 0;
        store.getSwapFees.mockReturnValue(fees);

        // the update handler waits on the fee lookup, so it is not awaited
        // until the lookup is released
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
        expect(store.getSwapFees).toHaveBeenCalled();
        expect(store.verifyReverseLockup).not.toHaveBeenCalled();

        store.verifyReverseLockup.mockResolvedValue({
            status: 'invalid',
            reason: 'refund-deadline'
        });
        await act(async () => {
            resolveFees();
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

    it('builds the claim for the host without its /v2 suffix', async () => {
        await renderView();
        nativeClaim.mockResolvedValue(undefined);

        await sendConfirmedLockup();

        expect(
            (ReverseClaimTransaction.build as jest.Mock).mock.calls[0][0]
                .endpoint
        ).toBe('https://provider.test');
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
