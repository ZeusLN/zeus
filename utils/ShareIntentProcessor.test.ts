jest.mock('react-native', () => ({
    NativeModules: {
        MobileTools: {
            takeSharedImageBase64: jest.fn()
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

const takeSharedImageBase64 = NativeModules.MobileTools
    .takeSharedImageBase64 as jest.Mock;

describe('processSharedQRImageFast', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        takeSharedImageBase64.mockResolvedValue('QRIMAGE');
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
    // terminal back on the PIN screen. Reading and clearing in two native
    // calls let a share that arrived in between be cleared unread, so the
    // image is taken in one call.
    it('takes the share in a single native call', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            true
        );

        const result = await processSharedQRImageFast();

        expect(takeSharedImageBase64).toHaveBeenCalledTimes(1);
        expect(result?.params.base64Image).toBe('QRIMAGE');
    });

    // When the native side cannot consume the share it still returns the
    // image and leaves the share in place, so the next read delivers it again
    // rather than losing it
    it('delivers a share again when the native side could not consume it', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            true
        );

        const result = await processSharedQRImageFast();
        const again = await processSharedQRImageFast();

        expect(takeSharedImageBase64).toHaveBeenCalledTimes(2);
        expect(result?.params.base64Image).toBe('QRIMAGE');
        expect(again?.params.base64Image).toBe('QRIMAGE');
    });

    it('returns null when nothing was shared', async () => {
        takeSharedImageBase64.mockResolvedValueOnce(null);

        expect(await processSharedQRImageFast()).toBeNull();

        // An empty read releases the guard too
        const result = await processSharedQRImageFast();

        expect(result?.params.base64Image).toBe('QRIMAGE');
    });

    it('returns null for an empty shared file', async () => {
        takeSharedImageBase64.mockResolvedValueOnce('');

        expect(await processSharedQRImageFast()).toBeNull();
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

        expect(takeSharedImageBase64).toHaveBeenCalledTimes(1);
        expect(first?.params.base64Image).toBe('QRIMAGE');
        expect(second).toBeNull();
    });

    it('holds off a concurrent reader until the take has settled', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );
        let finishTake: (value: string) => void = () => {};
        takeSharedImageBase64.mockReturnValueOnce(
            new Promise((resolve) => (finishTake = resolve))
        );

        const first = processSharedQRImageFast();
        await new Promise((resolve) => setImmediate(resolve));
        expect(takeSharedImageBase64).toHaveBeenCalledTimes(1);

        expect(await processSharedQRImageFast()).toBeNull();
        expect(takeSharedImageBase64).toHaveBeenCalledTimes(1);

        finishTake('QRIMAGE');
        expect((await first)?.params.base64Image).toBe('QRIMAGE');
    });

    it('reads a later share once the earlier read has settled', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );

        await processSharedQRImageFast();
        takeSharedImageBase64.mockResolvedValue('NEXTIMAGE');

        const result = await processSharedQRImageFast();

        expect(result?.params.base64Image).toBe('NEXTIMAGE');
    });

    it('reads again after a failed read', async () => {
        (settingsStore.externalInputAuthRequired as jest.Mock).mockReturnValue(
            false
        );
        takeSharedImageBase64.mockRejectedValueOnce(new Error('decode failed'));
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
