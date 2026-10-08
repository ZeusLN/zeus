jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ LinearProgress: 'LinearProgress' }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../utils/handleAnything', () => jest.fn());
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../utils/SwapUtils', () => ({
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

import SwapDetails from './SwapDetails';
import lndMobile from '../../lndmobile/LndMobileInjection';

const nativeClaim = lndMobile.swaps.createReverseClaimTransaction as jest.Mock;

const makeView = () => {
    const store = {
        claimMinerFee: 100,
        getSwapFees: jest.fn(),
        updateSwapStatus: jest.fn().mockResolvedValue(undefined),
        verifyReverseLockup: jest.fn().mockResolvedValue({ status: 'ok' })
    };
    const view = new SwapDetails({
        route: { params: { swapData: { id: 'swap' } } },
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

    const start = async (view: SwapDetails) => {
        // Avoid address generation in these tests, which exercise the
        // verification results crossing back into the websocket handler.
        jest.spyOn(view, 'resolveDestinationAddress').mockResolvedValue(
            'destination'
        );
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
