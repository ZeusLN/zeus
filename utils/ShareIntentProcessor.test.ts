jest.mock('react-native', () => ({
    NativeModules: {
        MobileTools: {
            getSharedImageBase64: jest.fn(),
            clearSharedIntent: jest.fn()
        }
    }
}));

jest.mock('react-native-qr-kit', () => ({
    __esModule: true,
    default: { decodeBase64: jest.fn() }
}));

jest.mock('./handleAnything', () => ({ __esModule: true, default: jest.fn() }));

jest.mock('./LocaleUtils', () => ({ localeString: (key: string) => key }));

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        externalInputAuthRequired: jest.fn(),
        settings: {},
        initialStart: true
    }
}));

import { NativeModules } from 'react-native';
import {
    authenticatedShareIntent,
    processSharedQRImageFast,
    walletSelectedShareIntent
} from './ShareIntentProcessor';
import { settingsStore } from '../stores/Stores';

const getSharedImageBase64 = NativeModules.MobileTools
    .getSharedImageBase64 as jest.Mock;
const clearSharedIntent = NativeModules.MobileTools
    .clearSharedIntent as jest.Mock;

describe('processSharedQRImageFast', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getSharedImageBase64.mockResolvedValue('QRIMAGE');
        clearSharedIntent.mockResolvedValue(true);
        (settingsStore as any).settings = {};
        (settingsStore as any).initialStart = true;
    });

    // An intent read from the OS has passed no authentication. The flags are
    // attached here so no call site can forget them: the POS cold start
    // forwarded the bare payload and the processing screen, which gated only
    // on a truthy requiresAuth, decoded the QR and navigated with no PIN.
    it('marks a shared image as needing auth when a login is configured', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            true
        );

        const result = await processSharedQRImageFast();

        expect(result?.params).toEqual({
            base64Image: 'QRIMAGE',
            requiresAuth: true,
            requiresWalletSelection: false
        });
    });

    it('does not require auth when no login is configured', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );

        const result = await processSharedQRImageFast();

        expect(result?.params.requiresAuth).toBe(false);
    });

    it('carries the wallet-selection requirement', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );
        (settingsStore as any).settings = { selectNodeOnStartup: true };

        const result = await processSharedQRImageFast();

        expect(result?.params.requiresWalletSelection).toBe(true);
    });

    // A warm share after a wallet was already picked this session must not
    // put the picker up again
    it('does not ask for wallet selection once a wallet was picked', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );
        (settingsStore as any).settings = { selectNodeOnStartup: true };
        (settingsStore as any).initialStart = false;

        const result = await processSharedQRImageFast();

        expect(result?.params.requiresWalletSelection).toBe(false);
    });

    // Left in place, each resume re-read the same image, which put a POS
    // terminal back on the PIN screen
    it('consumes the intent once the image is read', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            true
        );

        await processSharedQRImageFast();

        expect(clearSharedIntent).toHaveBeenCalledTimes(1);
    });

    it('still returns the image when clearing the intent fails', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            true
        );
        clearSharedIntent.mockRejectedValue(new Error('no activity'));
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await processSharedQRImageFast();

        expect(result?.params.base64Image).toBe('QRIMAGE');
    });

    it('returns null when nothing was shared', async () => {
        getSharedImageBase64.mockResolvedValue(null);

        expect(await processSharedQRImageFast()).toBeNull();
        expect(clearSharedIntent).not.toHaveBeenCalled();
    });
});

describe('share intent gate continuations', () => {
    // Each gate clears its own flag once satisfied. Without this the
    // fail-closed check in ShareIntentProcessing would send the payload back
    // to the screen it just came from, forever.
    it('marks a payload as authenticated without disturbing the rest', () => {
        expect(
            authenticatedShareIntent({
                base64Image: 'QRIMAGE',
                requiresAuth: true,
                requiresWalletSelection: true
            })
        ).toEqual({
            base64Image: 'QRIMAGE',
            requiresAuth: false,
            requiresWalletSelection: true
        });
    });

    it('marks a payload as wallet-selected without disturbing the rest', () => {
        expect(
            walletSelectedShareIntent({
                base64Image: 'QRIMAGE',
                requiresAuth: false,
                requiresWalletSelection: true
            })
        ).toEqual({
            base64Image: 'QRIMAGE',
            requiresAuth: false,
            requiresWalletSelection: false
        });
    });

    it('passes through a missing payload', () => {
        expect(authenticatedShareIntent(undefined)).toBeUndefined();
        expect(walletSelectedShareIntent(undefined)).toBeUndefined();
    });
});
