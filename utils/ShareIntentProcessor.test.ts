jest.mock('react-native', () => ({
    NativeModules: {
        MobileTools: {
            getSharedImageBase64: jest.fn(),
            clearSharedIntent: jest.fn()
        }
    }
}));

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

    // On resume two handlers look for the same share at once (iOS:
    // Wallet.handleOpenURL and Wallet.handleAppStateChange; Android:
    // LinkingUtils.handleAndroidIntents and Wallet.handleAppStateChange).
    // Both reads used to finish before either cleared the intent, so the
    // processing screen was navigated to twice (#4742).
    it('hands a share to only one of two concurrent readers', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );

        const [first, second] = await Promise.all([
            processSharedQRImageFast(),
            processSharedQRImageFast()
        ]);

        expect(getSharedImageBase64).toHaveBeenCalledTimes(1);
        expect(first?.params.base64Image).toBe('QRIMAGE');
        expect(second).toBeNull();
    });

    it('holds off a concurrent reader until the intent is cleared', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );
        let finishClear: (value: boolean) => void = () => {};
        clearSharedIntent.mockReturnValueOnce(
            new Promise((resolve) => (finishClear = resolve))
        );

        const first = processSharedQRImageFast();
        await new Promise((resolve) => setImmediate(resolve));
        expect(clearSharedIntent).toHaveBeenCalledTimes(1);

        expect(await processSharedQRImageFast()).toBeNull();

        finishClear(true);
        expect((await first)?.params.base64Image).toBe('QRIMAGE');
    });

    it('reads a later share once the earlier read has settled', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );

        await processSharedQRImageFast();
        getSharedImageBase64.mockResolvedValue('NEXTIMAGE');

        const result = await processSharedQRImageFast();

        expect(result?.params.base64Image).toBe('NEXTIMAGE');
    });

    it('reads again after a failed read', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );
        getSharedImageBase64.mockRejectedValueOnce(new Error('decode failed'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        expect((await processSharedQRImageFast())?.success).toBe(false);

        const result = await processSharedQRImageFast();

        expect(result?.params.base64Image).toBe('QRIMAGE');
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
