jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('./ShareIntentProcessor', () => ({
    processSharedQRImageFast: jest.fn()
}));

let mockLoginRequired = false;
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        loginRequired: () => mockLoginRequired,
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

    it('does not pop while a payment is in flight on SendingLightning', async () => {
        const navigation = makeNavigation([
            'Wallet',
            'PaymentRequest',
            'SendingLightning'
        ]);

        LinkingUtils.handleDeepLink('lightning:lnbc1...', navigation as any);
        await flushPromises();

        expect(navigation.navigate).toHaveBeenCalledWith('PaymentRequest', {});
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

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
