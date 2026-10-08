jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ LinearProgress: 'LinearProgress' }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../utils/handleAnything', () => jest.fn());
jest.mock('../../utils/BackendUtils', () => ({
    supportsOnchainReceiving: () => true
}));
jest.mock('../../utils/UrlUtils', () => ({}));
// the real SwapUtils below touches the filesystem and save dialog for the
// rescue key export; neither is exercised here
jest.mock('react-native-fs', () => ({}));
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
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
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
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../../assets/images/SVG/QR.svg', () => 'QR');

import { Alert } from 'react-native';
import SwapDetails from './SwapDetails';
import lndMobile from '../../lndmobile/LndMobileInjection';
import { ReverseClaimTransaction } from '../../models/ClaimTransaction';

const nativeClaim = lndMobile.swaps.createReverseClaimTransaction as jest.Mock;

const makeView = (swapData: any = { id: 'swap' }) => {
    const store = {
        claimMinerFee: 100,
        getSwapFees: jest.fn(),
        updateSwapStatus: jest.fn().mockResolvedValue(undefined),
        verifyReverseLockup: jest.fn().mockResolvedValue({ status: 'ok' }),
        resolveClaimAddress: jest.fn(
            async ({ destinationAddress }: any) =>
                destinationAddress || 'bc1qwallet'
        )
    };
    const view = new SwapDetails({
        // a stored host keeps its /v2 suffix, as in the app
        route: { params: { swapData, endpoint: 'https://provider.test/v2' } },
        NodeInfoStore: { nodeInfo: { isTestNet: false } },
        SwapStore: store
    } as any);
    jest.spyOn(view, 'setState').mockImplementation((update: any) => {
        view.state = { ...view.state, ...update };
    });
    const claim = () =>
        view.createReverseClaimTransaction(
            { id: 'swap' },
            {},
            'https://provider.test',
            'lockup',
            'destination',
            'preimage',
            'txhex',
            '2'
        );
    return { store, view, claim };
};

beforeEach(() => {
    nativeClaim.mockReset();
    (ReverseClaimTransaction.build as jest.Mock).mockClear();
});

it.each(['invalid', 'unconfirmed', 'unavailable'])(
    'does not hand the preimage to native code when verification is %s',
    async (status) => {
        const { store, claim } = makeView();
        store.verifyReverseLockup.mockResolvedValue({ status });
        await expect(claim()).resolves.toEqual({ status });
        expect(nativeClaim).not.toHaveBeenCalled();
    }
);

it('checks after a delayed fee lookup, immediately before the native claim', async () => {
    const { store, claim } = makeView();
    store.claimMinerFee = 0;
    let resolveFees!: () => void;
    store.getSwapFees.mockReturnValue(
        new Promise<void>((resolve) => {
            resolveFees = resolve;
        })
    );
    const pending = claim();
    expect(store.verifyReverseLockup).not.toHaveBeenCalled();
    store.verifyReverseLockup.mockResolvedValue({
        status: 'invalid',
        reason: 'refund-deadline'
    });
    resolveFees();
    await expect(pending).resolves.toEqual({
        status: 'invalid',
        reason: 'refund-deadline'
    });
    expect(nativeClaim).not.toHaveBeenCalled();
});

it('rechecks after a failed native attempt and stops if the output has been spent', async () => {
    const { store, claim } = makeView();
    store.verifyReverseLockup
        .mockResolvedValueOnce({ status: 'ok' })
        .mockResolvedValue({ status: 'invalid', reason: 'lockup-spent' });
    nativeClaim.mockRejectedValue(new Error('broadcast response lost'));
    await expect(claim()).resolves.toEqual({
        status: 'invalid',
        reason: 'lockup-spent'
    });
    expect(store.verifyReverseLockup).toHaveBeenCalledTimes(2);
    expect(nativeClaim).toHaveBeenCalledTimes(1);
});

it('claims a verified lockup and clears a previous waiting notice', async () => {
    const { view, claim } = makeView();
    view.setState({ lockupNotice: 'waiting' });
    nativeClaim.mockResolvedValue(undefined);
    await expect(claim()).resolves.toBe(true);
    expect(nativeClaim).toHaveBeenCalledTimes(1);
    expect(view.state.lockupNotice).toBeNull();
});

describe('lockup verification retry wiring', () => {
    const originalWebSocket = global.WebSocket;
    let socket: any;

    beforeEach(() => {
        jest.useFakeTimers();
        socket = { close: jest.fn() };
        global.WebSocket = jest.fn(() => socket) as any;
    });

    afterEach(() => {
        global.WebSocket = originalWebSocket;
        jest.useRealTimers();
    });

    const sendConfirmedLockup = async (view: SwapDetails) => {
        view.getReverseSwapUpdates({ id: 'swap' }, false);
        await socket.onmessage({
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
    };

    const start = async (view: SwapDetails) => {
        // Avoid address generation in these tests, which exercise the
        // verification results crossing back into the websocket handler.
        jest.spyOn(view, 'resolveDestinationAddress').mockResolvedValue(
            'destination'
        );
        await sendConfirmedLockup(view);
    };

    const claimedTo = () =>
        (ReverseClaimTransaction.build as jest.Mock).mock.calls[0][0].swap
            .destinationAddress;

    it('claims a rescued swap to a wallet address, not one stored from the host', async () => {
        const { store, view } = makeView({
            id: 'swap',
            imported: true,
            destinationAddress: 'bc1qhost'
        });
        nativeClaim.mockResolvedValue(undefined);
        await sendConfirmedLockup(view);
        expect(claimedTo()).toBe('bc1qwallet');
        expect(store.resolveClaimAddress).toHaveBeenCalledWith(
            expect.objectContaining({ destinationAddress: undefined })
        );
        expect(nativeClaim).toHaveBeenCalledTimes(1);
        view.componentWillUnmount?.();
    });

    it('claims a swap created on this device to the address picked for it', async () => {
        const { view } = makeView({
            id: 'swap',
            destinationAddress: 'bc1qpicked'
        });
        nativeClaim.mockResolvedValue(undefined);
        await sendConfirmedLockup(view);
        expect(claimedTo()).toBe('bc1qpicked');
        view.componentWillUnmount?.();
    });

    it.each(['unavailable', 'unconfirmed'])(
        'rechecks a %s lockup and claims once it verifies',
        async (status) => {
            const { store, view } = makeView();
            store.verifyReverseLockup
                .mockResolvedValueOnce({ status })
                .mockResolvedValue({ status: 'ok' });
            nativeClaim.mockResolvedValue(undefined);
            await start(view);
            expect(nativeClaim).not.toHaveBeenCalled();
            expect(view.state.lockupNotice).not.toBeNull();
            await jest.advanceTimersByTimeAsync(60000);
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            expect(view.state.lockupNotice).toBeNull();
            view.componentWillUnmount?.();
        }
    );

    const sendStatus = (status: string) =>
        socket.onmessage({
            data: JSON.stringify({ event: 'update', args: [{ status }] })
        });

    it('schedules no recheck when a lookup in flight at unmount comes back unavailable', async () => {
        const { store, view } = makeView();
        let resolveLookup!: (value: any) => void;
        store.verifyReverseLockup.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveLookup = resolve;
            })
        );
        jest.spyOn(view, 'resolveDestinationAddress').mockResolvedValue(
            'destination'
        );
        view.getReverseSwapUpdates({ id: 'swap' }, false);
        const update = socket.onmessage({
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
        await jest.advanceTimersByTimeAsync(0);
        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);

        view.componentWillUnmount?.();
        resolveLookup({ status: 'unavailable' });
        await update;
        await jest.advanceTimersByTimeAsync(120000);

        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        expect(nativeClaim).not.toHaveBeenCalled();
    });

    it.each([
        'swap.expired',
        'invoice.expired',
        'transaction.failed',
        'invoice.settled'
    ])('cancels a scheduled recheck on %s', async (status) => {
        const { store, view } = makeView();
        store.verifyReverseLockup.mockResolvedValue({ status: 'unavailable' });
        await start(view);
        expect(view.state.lockupNotice).not.toBeNull();

        await sendStatus(status);
        await jest.advanceTimersByTimeAsync(120000);

        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        expect(nativeClaim).not.toHaveBeenCalled();
        view.componentWillUnmount?.();
    });

    it('cancels a scheduled recheck when the host reports an error', async () => {
        const { store, view } = makeView();
        store.verifyReverseLockup.mockResolvedValue({ status: 'unavailable' });
        await start(view);

        await socket.onmessage({
            data: JSON.stringify({
                event: 'update',
                args: [{ error: 'Operation timeout' }]
            })
        });
        await jest.advanceTimersByTimeAsync(120000);

        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        view.componentWillUnmount?.();
    });

    describe('a lockup amount nothing in the wallet vouches for', () => {
        const alertButtons = (alert: jest.SpyInstance) =>
            alert.mock.calls[alert.mock.calls.length - 1][2];

        it('asks before claiming and claims once the user confirms', async () => {
            const alert = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});
            const { store, view } = makeView();
            store.verifyReverseLockup
                .mockResolvedValueOnce({
                    status: 'confirm-amount',
                    amount: 1000
                })
                .mockResolvedValue({ status: 'ok' });
            nativeClaim.mockResolvedValue(undefined);

            await start(view);
            expect(nativeClaim).not.toHaveBeenCalled();
            expect(alert).toHaveBeenCalledTimes(1);
            expect(alert.mock.calls[0][1]).toBe(
                'views.SwapDetails.confirmLockupAmount.message'
            );

            // another update while the prompt is up doesn't ask again
            await socket.onmessage({
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
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
            expect(alert).toHaveBeenCalledTimes(1);

            alertButtons(alert)[1].onPress();
            await jest.advanceTimersByTimeAsync(2000);

            expect(store.verifyReverseLockup).toHaveBeenLastCalledWith(
                expect.anything(),
                'txhex',
                { confirmedLockupAmount: 1000 }
            );
            expect(nativeClaim).toHaveBeenCalledTimes(1);
            alert.mockRestore();
            view.componentWillUnmount?.();
        });

        it('does not claim or ask again once the user declines', async () => {
            const alert = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});
            const { store, view } = makeView();
            store.verifyReverseLockup.mockResolvedValue({
                status: 'confirm-amount',
                amount: 1000
            });

            await start(view);
            alertButtons(alert)[0].onPress();
            expect(view.state.error).toBe(
                'views.SwapDetails.lockupAmountDeclined'
            );

            await socket.onmessage({
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
            await jest.advanceTimersByTimeAsync(120000);

            expect(alert).toHaveBeenCalledTimes(1);
            expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
            expect(nativeClaim).not.toHaveBeenCalled();
            alert.mockRestore();
            view.componentWillUnmount?.();
        });
    });

    it('shows a fatal verification error without scheduling another claim', async () => {
        const { store, view } = makeView();
        store.verifyReverseLockup.mockResolvedValue({
            status: 'invalid',
            reason: 'refund-deadline'
        });
        await start(view);
        await jest.advanceTimersByTimeAsync(120000);
        expect(view.state.error).toBe(
            'views.SwapDetails.lockupVerificationFailed'
        );
        expect(store.verifyReverseLockup).toHaveBeenCalledTimes(1);
        expect(nativeClaim).not.toHaveBeenCalled();
        view.componentWillUnmount?.();
    });
});
