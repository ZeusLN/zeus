import { NativeModules, Platform } from 'react-native';

const { StealthMode } = NativeModules;

export type StealthApp =
    | 'zeus'
    | 'calculator'
    | 'vpn'
    | 'qrscanner'
    | 'notepad';

class StealthModeUtils {
    /**
     * Check if stealth mode is supported on this platform
     */
    isSupported(): boolean {
        return Platform.OS === 'android' && StealthMode != null;
    }

    /**
     * Enable stealth mode with the specified disguise app
     */
    async enableStealthMode(app: StealthApp): Promise<boolean> {
        if (!this.isSupported()) {
            console.warn('Stealth mode is only supported on Android');
            return false;
        }

        try {
            await StealthMode.enableStealthMode(app);
            return true;
        } catch (error) {
            console.error('Failed to enable stealth mode:', error);
            return false;
        }
    }

    /**
     * Disable stealth mode and restore normal Zeus appearance
     */
    async disableStealthMode(): Promise<boolean> {
        if (!this.isSupported()) {
            return false;
        }

        try {
            await StealthMode.disableStealthMode();
            return true;
        } catch (error) {
            console.error('Failed to disable stealth mode:', error);
            return false;
        }
    }

    /**
     * Check if stealth mode is currently active
     */
    async isStealthModeActive(): Promise<boolean> {
        if (!this.isSupported()) {
            return false;
        }

        try {
            return await StealthMode.isStealthModeActive();
        } catch (error) {
            console.error('Failed to check stealth mode status:', error);
            return false;
        }
    }

    /**
     * Fix stealth mode if no launcher alias is enabled (safety check)
     */
    async fixStealthModeIfNeeded(): Promise<boolean> {
        if (!this.isSupported()) {
            return false;
        }

        try {
            await StealthMode.fixStealthModeIfNeeded();
            return true;
        } catch (error) {
            console.error('Failed to fix stealth mode:', error);
            return false;
        }
    }
}

export default new StealthModeUtils();
