jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('./ShareIntentProcessor', () => ({
    processSharedQRImageFast: jest.fn()
}));

let mockLoginRequired = false;
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        externalInputAuthRequired: () => mockLoginRequired,
        settings: {}
    }
}));

let mockHandleAnythingResult: [string, any] = ['PaymentRequest', {}];
jest.mock('./handleAnything', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(mockHandleAnythingResult))
}));

import LinkingUtils from './LinkingUtils';

const flushPromises = () => new Promise(setImmediate);

const makeNavigation = (routeNames: string[], focusedIndex?: number) => ({
    navigate: jest.fn(),
    popTo: jest.fn(),
    replace: jest.fn(),
    getState: jest.fn(() => ({
        index: focusedIndex ?? routeNames.length - 1,
        routes: routeNames.map((name) => ({ name }))
    }))
});

describe('LinkingUtils.handleDeepLink', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLoginRequired = false;
        mockHandleAnythingResult = ['PaymentRequest', {}];
    });

    it('pops back to an existing PaymentRequest instead of pushing a duplicate', async () => {
        // A payment request arrives while the QR view sits on top of
        // PaymentRequest: navigate() would push a second, freshly pinned
        // instance, bypassing the payment-request-changed warning on the
        // buried one.
        const navigation = makeNavigation(['Wallet', 'PaymentRequest', 'QR']);

        LinkingUtils.handleDeepLink('lightning:lnbc1...', navigation as any);
        await flushPromises();

        expect(navigation.popTo).toHaveBeenCalledWith('PaymentRequest', {});
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('navigates normally when no PaymentRequest is in the stack', async () => {
        // popTo with no matching route would REPLACE the focused route
        // rather than push, so the existence check is load-bearing.
        const navigation = makeNavigation(['Wallet']);

        LinkingUtils.handleDeepLink('lightning:lnbc1...', navigation as any);
        await flushPromises();

        expect(navigation.navigate).toHaveBeenCalledWith('PaymentRequest', {});
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it.each(['SendingLightning', 'SendingOnChain', 'CashuSendingLightning'])(
        'does not pop while a payment is in flight on %s',
        async (sendingScreen) => {
            const navigation = makeNavigation([
                'Wallet',
                'PaymentRequest',
                sendingScreen
            ]);

            LinkingUtils.handleDeepLink(
                'lightning:lnbc1...',
                navigation as any
            );
            await flushPromises();

            expect(navigation.navigate).toHaveBeenCalledWith(
                'PaymentRequest',
                {}
            );
            expect(navigation.popTo).not.toHaveBeenCalled();
        }
    );

    it('navigates normally for routes other than PaymentRequest', async () => {
        mockHandleAnythingResult = [
            'ChoosePaymentMethod',
            { lightning: 'lnbc1...', locked: true }
        ];
        const navigation = makeNavigation(['Wallet', 'PaymentRequest', 'QR']);

        LinkingUtils.handleDeepLink('lightning:lnbc1...', navigation as any);
        await flushPromises();

        expect(navigation.navigate).toHaveBeenCalledWith(
            'ChoosePaymentMethod',
            { lightning: 'lnbc1...', locked: true }
        );
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it.each([
        ['LnurlPay', { lnurlParams: { callback: 'https://b.example/cb' } }],
        ['LnurlChannel', { lnurlParams: { callback: 'https://b.example/cb' } }],
        ['ClinkPay', { noffer: 'noffer1...' }],
        ['ChoosePaymentMethod', { lightning: 'lnbc1...', locked: true }]
    ])(
        'mounts a fresh %s when that screen is focused',
        async (route, props) => {
            mockHandleAnythingResult = [route, props];
            const navigation = makeNavigation(['Wallet', route]);

            LinkingUtils.handleDeepLink(
                'lightning:lnurl1...',
                navigation as any
            );
            await flushPromises();

            expect(navigation.replace).toHaveBeenCalledWith(route, props);
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('navigates when the focused screen is a different one', async () => {
        mockHandleAnythingResult = ['LnurlPay', { lnurlParams: {} }];
        const navigation = makeNavigation(['Wallet', 'LnurlPay', 'Send']);

        LinkingUtils.handleDeepLink('lightning:lnurl1...', navigation as any);
        await flushPromises();

        expect(navigation.navigate).toHaveBeenCalledWith('LnurlPay', {
            lnurlParams: {}
        });
        expect(navigation.replace).not.toHaveBeenCalled();
    });

    it('pops to a focused PaymentRequest instead of replacing it', async () => {
        const navigation = makeNavigation(['Wallet', 'PaymentRequest']);

        LinkingUtils.handleDeepLink('lightning:lnbc1...', navigation as any);
        await flushPromises();

        expect(navigation.popTo).toHaveBeenCalledWith('PaymentRequest', {});
        expect(navigation.replace).not.toHaveBeenCalled();
    });

    it('defers the deep link while login is required, then dispatches it', async () => {
        mockLoginRequired = true;
        const navigation = makeNavigation(['Wallet', 'PaymentRequest', 'QR']);

        LinkingUtils.handleDeepLink('lightning:lnbc1...', navigation as any);
        await flushPromises();

        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();

        mockLoginRequired = false;
        LinkingUtils.processPendingDeepLink(navigation as any);
        await flushPromises();

        expect(navigation.popTo).toHaveBeenCalledWith('PaymentRequest', {});
    });
});

// processSharedQRImageFast clears the intent when it reads it. A second
// clear here would discard a share that arrived between the two.
describe('LinkingUtils share intents', () => {
    const { Linking, NativeModules, Platform } = require('react-native');
    const { processSharedQRImageFast } = require('./ShareIntentProcessor');
    const originalOS = Platform.OS;
    const payload = {
        base64Image: 'QRIMAGE',
        requiresAuth: true,
        requiresWalletSelection: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
        LinkingUtils.resetShareIntentFlag();
        NativeModules.MobileTools = {
            getIntentNfcData: jest.fn().mockResolvedValue(null),
            clearSharedIntent: jest.fn().mockResolvedValue(true)
        };
        processSharedQRImageFast.mockResolvedValue({
            success: true,
            route: 'ShareIntentProcessing',
            params: payload
        });
    });

    afterEach(() => {
        Platform.OS = originalOS;
    });

    it('hands an Android share to the processing screen without clearing it again', async () => {
        Platform.OS = 'android';
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleAndroidIntents(navigation as any);

        expect(navigation.navigate).toHaveBeenCalledWith(
            'ShareIntentProcessing',
            payload
        );
        expect(
            NativeModules.MobileTools.clearSharedIntent
        ).not.toHaveBeenCalled();
    });

    it('hands an iOS share URL to the processing screen without clearing it again', async () => {
        Platform.OS = 'ios';
        jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(
            'zeusln://share'
        );
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);

        expect(navigation.navigate).toHaveBeenCalledWith(
            'ShareIntentProcessing',
            payload
        );
        expect(
            NativeModules.MobileTools.clearSharedIntent
        ).not.toHaveBeenCalled();
    });
});
