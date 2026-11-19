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

let mockRestartReason: string | null = null;
jest.mock('react-native-restart', () => ({
    __esModule: true,
    default: { getReason: () => Promise.resolve(mockRestartReason) }
}));

import { Linking, Platform } from 'react-native';

import handleAnything from './handleAnything';
import { IN_APP_RESTART } from './InAppRestartUtils';
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

    it.each([
        'SendingLightning',
        'SendingOnChain',
        'CashuSendingLightning',
        'MultimintPayment'
    ])(
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

describe('LinkingUtils.handleInitialUrl', () => {
    const { NativeModules } = require('react-native');
    const { processSharedQRImageFast } = require('./ShareIntentProcessor');
    const originalOS = Platform.OS;
    const payload = {
        base64Image: 'QRIMAGE',
        requiresAuth: false,
        requiresWalletSelection: false
    };

    const mockInitialUrl = (url: string | null) =>
        jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
    const handledUrls = () =>
        (handleAnything as jest.Mock).mock.calls.map(([url]) => url);

    beforeEach(() => {
        jest.clearAllMocks();
        mockLoginRequired = false;
        mockHandleAnythingResult = ['PaymentRequest', {}];
        Platform.OS = 'android';
        LinkingUtils.resetShareIntentFlag();
        NativeModules.MobileTools = {
            getIntentNfcData: jest.fn().mockResolvedValue(null),
            clearSharedIntent: jest.fn().mockResolvedValue(true)
        };
        processSharedQRImageFast.mockResolvedValue(null);
        mockRestartReason = null;
    });

    afterEach(() => {
        Platform.OS = originalOS;
    });

    // LinkingUtils is a singleton and lastHandledUrl carries over between
    // tests, so each test uses its own URL.

    it('handles the initial URL once when the Wallet view mounts again', async () => {
        mockInitialUrl('lightning:lnbc1once');
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();
        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('PaymentRequest', {});
    });

    it('handles a new initial URL after a different one was handled', async () => {
        const navigation = makeNavigation(['Wallet']);

        mockInitialUrl('lightning:lnbc1first');
        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();
        mockInitialUrl('lightning:lnbc1second');
        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(navigation.navigate).toHaveBeenCalledTimes(2);
    });

    it('does not mark a link deferred behind login as handled', async () => {
        mockLoginRequired = true;
        mockInitialUrl('lightning:lnbc1deferred');
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();
        expect(navigation.navigate).not.toHaveBeenCalled();

        mockLoginRequired = false;
        LinkingUtils.processPendingDeepLink(navigation as any);
        await flushPromises();
        expect(navigation.navigate).toHaveBeenCalledTimes(1);

        // handled now, so a remount does not open it a second time
        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('does not read NFC or share intents when there is a URL', async () => {
        mockInitialUrl('lightning:lnbc1withurl');
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(
            NativeModules.MobileTools.getIntentNfcData
        ).not.toHaveBeenCalled();
        expect(processSharedQRImageFast).not.toHaveBeenCalled();
    });

    it('handles NFC data on Android when there is no URL', async () => {
        mockInitialUrl(null);
        NativeModules.MobileTools.getIntentNfcData.mockResolvedValue(
            'lightning:lnbc1nfc'
        );
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(navigation.navigate).toHaveBeenCalledWith('PaymentRequest', {});
        expect(processSharedQRImageFast).not.toHaveBeenCalled();
    });

    it('opens ShareIntentProcessing for a shared image on Android when there is no URL', async () => {
        mockInitialUrl(null);
        processSharedQRImageFast.mockResolvedValue({
            success: true,
            route: 'ShareIntentProcessing',
            params: payload
        });
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);

        expect(navigation.navigate).toHaveBeenCalledWith(
            'ShareIntentProcessing',
            payload
        );
    });

    it('reads a new shared image on each call', async () => {
        // handleInitialUrl resets shareIntentProcessed, so a share that
        // arrives after the first one is not skipped
        mockInitialUrl(null);
        processSharedQRImageFast.mockResolvedValue({
            success: true,
            route: 'ShareIntentProcessing',
            params: payload
        });
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);
        await LinkingUtils.handleInitialUrl(navigation as any);

        expect(navigation.navigate).toHaveBeenCalledTimes(2);
    });

    it('does nothing on Android when there is no URL, NFC tag or share', async () => {
        mockInitialUrl(null);
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(NativeModules.MobileTools.getIntentNfcData).toHaveBeenCalled();
        expect(processSharedQRImageFast).toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('does not read Android intents on iOS when there is no URL', async () => {
        Platform.OS = 'ios';
        mockInitialUrl(null);
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);

        expect(
            NativeModules.MobileTools.getIntentNfcData
        ).not.toHaveBeenCalled();
        expect(processSharedQRImageFast).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('does not treat a failed iOS share URL as a deep link', async () => {
        Platform.OS = 'ios';
        mockInitialUrl('zeusln://share');
        processSharedQRImageFast.mockResolvedValue({
            success: false,
            error: 'utils.shareIntent.processingError'
        });
        const navigation = makeNavigation(['Wallet']);

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(processSharedQRImageFast).toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    // Linking.getInitialURL() keeps returning the launch URL; on iOS also
    // across an in-app restart, which reloads JS in the same process

    it('handles the launch URL when iOS launched the app', async () => {
        Platform.OS = 'ios';
        const navigation = makeNavigation(['Wallet']);
        mockInitialUrl('lndconnect://first.example:8080?macaroon=AgED');

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(handledUrls()).toEqual([
            'lndconnect://first.example:8080?macaroon=AgED'
        ]);
    });

    it('ignores the launch URL after an in-app restart on iOS', async () => {
        Platform.OS = 'ios';
        const navigation = makeNavigation(['Wallet']);
        mockInitialUrl('lndconnect://second.example:8080?macaroon=AgED');
        mockRestartReason = IN_APP_RESTART;

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(handledUrls()).toEqual([]);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('handles the launch URL on Android regardless of the restart reason', async () => {
        // Android restarts the whole process, so the launch intent is new
        Platform.OS = 'android';
        const navigation = makeNavigation(['Wallet']);
        mockInitialUrl('lndconnect://third.example:8080?macaroon=AgED');
        mockRestartReason = IN_APP_RESTART;

        await LinkingUtils.handleInitialUrl(navigation as any);
        await flushPromises();

        expect(handledUrls()).toEqual([
            'lndconnect://third.example:8080?macaroon=AgED'
        ]);
    });
});
