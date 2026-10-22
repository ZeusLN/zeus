// This screen decodes whatever QR it is handed and navigates wherever that
// QR points, including Send with an invoice loaded and WalletConfiguration
// pre-filled from a link. It used to gate only on a truthy requiresAuth, so
// a caller that never set the flag got the payload processed with no PIN:
// the POS cold start did exactly that, since it enters POS unauthenticated
// and forwarded the raw share payload.
jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));

jest.mock('react-native', () => ({
    View: 'View',
    Text: 'Text',
    Alert: { alert: jest.fn() },
    NativeModules: {
        MobileTools: {
            clearSharedIntent: jest.fn().mockResolvedValue(undefined)
        }
    }
}));

jest.mock('react-native-qr-kit', () => ({
    __esModule: true,
    default: {
        decodeBase64: jest.fn().mockResolvedValue({
            success: true,
            data: 'lightning:lnbc1invoice'
        })
    }
}));

jest.mock('../utils/handleAnything', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(['Send', { invoice: 'lnbc1invoice' }])
}));

jest.mock('../utils/LocaleUtils');

jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));

let mockExternalInputAuthRequired = false;
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        externalInputAuthRequired: () => mockExternalInputAuthRequired
    }
}));

jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => 'Screen');

import ShareIntentProcessing from './ShareIntentProcessing';
import handleAnything from '../utils/handleAnything';

let mockRoutes = ['Wallet', 'ShareIntentProcessing'];
const makeNavigation = () => ({
    replace: jest.fn(),
    popTo: jest.fn(),
    getState: jest.fn(() => ({
        routes: mockRoutes.map((name) => ({ name }))
    })),
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => false)
});

const mount = async (params: any) => {
    const navigation = makeNavigation();
    const screen: any = new (ShareIntentProcessing as any)({
        navigation,
        route: { params }
    });
    screen.setState = function (state: any) {
        this.state = { ...this.state, ...state };
    };
    await screen.componentDidMount();
    // let processQRCode's promise chain settle
    await Promise.resolve();
    await Promise.resolve();
    return { navigation, screen };
};

describe('ShareIntentProcessing auth gate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExternalInputAuthRequired = false;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    // The payload the POS cold start used to produce: no flags at all
    it('sends a payload with no auth flag to the Lockscreen', async () => {
        const { navigation } = await mount({ base64Image: 'QRIMAGE' });

        expect(navigation.replace).toHaveBeenCalledWith(
            'Lockscreen',
            expect.objectContaining({
                shareIntentData: expect.objectContaining({
                    base64Image: 'QRIMAGE'
                })
            })
        );
        expect(handleAnything).not.toHaveBeenCalled();
    });

    it('sends a payload that requires auth to the Lockscreen', async () => {
        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: true
        });

        expect(navigation.replace).toHaveBeenCalledWith(
            'Lockscreen',
            expect.objectContaining({
                shareIntentData: expect.objectContaining({
                    base64Image: 'QRIMAGE'
                })
            })
        );
        expect(handleAnything).not.toHaveBeenCalled();
    });

    // Unlocking does not pick a wallet: the other gate has to survive the
    // trip through the Lockscreen or it is silently skipped
    it('keeps a pending wallet selection across the Lockscreen', async () => {
        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: true,
            requiresWalletSelection: true
        });

        expect(navigation.replace).toHaveBeenCalledWith(
            'Lockscreen',
            expect.objectContaining({
                shareIntentData: expect.objectContaining({
                    requiresWalletSelection: true
                })
            })
        );
    });

    // Only a caller that knows the user is through, or that no login is
    // configured, may say so
    it('processes the QR when auth is explicitly satisfied', async () => {
        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false
        });

        expect(handleAnything).toHaveBeenCalledWith('lightning:lnbc1invoice');
        expect(navigation.replace).toHaveBeenCalledWith('Send', {
            invoice: 'lnbc1invoice'
        });
    });

    // requiresAuth is fixed when the intent is read, but the payload can
    // wait in Wallet's pendingShareIntent while the app locks on background
    // or the terminal returns to POS mode
    it('sends a stale satisfied payload to the Lockscreen when auth is now required', async () => {
        mockExternalInputAuthRequired = true;

        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false
        });

        expect(navigation.replace).toHaveBeenCalledWith(
            'Lockscreen',
            expect.anything()
        );
        expect(handleAnything).not.toHaveBeenCalled();
    });

    it('routes to wallet selection with auth already marked satisfied', async () => {
        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false,
            requiresWalletSelection: true
        });

        expect(navigation.replace).toHaveBeenCalledWith(
            'Wallets',
            expect.objectContaining({
                fromStartup: true,
                shareIntentData: expect.objectContaining({
                    requiresAuth: false
                })
            })
        );
        expect(handleAnything).not.toHaveBeenCalled();
    });
});

// handleAnything puts a shared invoice into InvoicesStore before this screen
// navigates. A PaymentRequest that is already open then shows it with the
// payment-request-changed warning; a second PaymentRequest stacked on top
// would review the shared invoice with no warning.
describe('ShareIntentProcessing navigation', () => {
    const sharedInvoice = () =>
        (handleAnything as jest.Mock).mockResolvedValueOnce([
            'PaymentRequest',
            {}
        ]);

    beforeEach(() => {
        jest.clearAllMocks();
        mockExternalInputAuthRequired = false;
        mockRoutes = ['Wallet', 'ShareIntentProcessing'];
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('pops back to an open PaymentRequest instead of stacking another', async () => {
        sharedInvoice();
        mockRoutes = ['Wallet', 'PaymentRequest', 'ShareIntentProcessing'];

        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false
        });

        expect(navigation.popTo).toHaveBeenCalledWith('PaymentRequest', {});
        expect(navigation.replace).not.toHaveBeenCalled();
    });

    it('pops past screens opened over the PaymentRequest', async () => {
        sharedInvoice();
        mockRoutes = [
            'Wallet',
            'PaymentRequest',
            'Contacts',
            'ShareIntentProcessing'
        ];

        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false
        });

        expect(navigation.popTo).toHaveBeenCalledWith('PaymentRequest', {});
    });

    it('replaces itself with PaymentRequest when none is open', async () => {
        sharedInvoice();

        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false
        });

        expect(navigation.replace).toHaveBeenCalledWith('PaymentRequest', {});
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('replaces itself for other routes with a PaymentRequest open', async () => {
        mockRoutes = ['Wallet', 'PaymentRequest', 'ShareIntentProcessing'];

        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false
        });

        expect(navigation.replace).toHaveBeenCalledWith('Send', {
            invoice: 'lnbc1invoice'
        });
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it.each(['SendingLightning', 'SendingOnChain', 'CashuSendingLightning'])(
        'does not pop through %s',
        async (sendingScreen) => {
            sharedInvoice();
            mockRoutes = [
                'Wallet',
                'PaymentRequest',
                sendingScreen,
                'ShareIntentProcessing'
            ];

            const { navigation } = await mount({
                base64Image: 'QRIMAGE',
                requiresAuth: false
            });

            expect(navigation.replace).toHaveBeenCalledWith(
                'PaymentRequest',
                {}
            );
            expect(navigation.popTo).not.toHaveBeenCalled();
        }
    );

    it('pops to a PaymentRequest opened after an earlier payment', async () => {
        sharedInvoice();
        mockRoutes = [
            'Wallet',
            'SendingLightning',
            'PaymentRequest',
            'ShareIntentProcessing'
        ];

        const { navigation } = await mount({
            base64Image: 'QRIMAGE',
            requiresAuth: false
        });

        expect(navigation.popTo).toHaveBeenCalledWith('PaymentRequest', {});
    });
});
