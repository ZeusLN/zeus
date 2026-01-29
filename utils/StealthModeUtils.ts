import { NativeModules, Platform } from 'react-native';

const { StealthMode } = NativeModules;

export type StealthApp =
    | 'zeus'
    | 'calculator'
    | 'vpn'
    | 'qrscanner'
    | 'notepad';

export interface StealthStatus {
    enabled: boolean;
    app: StealthApp;
}

export const STEALTH_APP_OPTIONS: {
    key: StealthApp;
    label: string;
    translateKey: string;
}[] = [
    {
        key: 'calculator',
        label: 'Calculator',
        translateKey: 'views.Settings.StealthMode.calculator'
    },
    {
        key: 'vpn',
        label: 'Edge VPN',
        translateKey: 'views.Settings.StealthMode.vpn'
    },
    {
        key: 'qrscanner',
        label: 'QR Scanner',
        translateKey: 'views.Settings.StealthMode.qrscanner'
    },
    {
        key: 'notepad',
        label: 'Notepad',
        translateKey: 'views.Settings.StealthMode.notepad'
    }
];

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
     * Get the current stealth mode status
     */
    async getStealthStatus(): Promise<StealthStatus> {
        if (!this.isSupported()) {
            return { enabled: false, app: 'zeus' };
        }

        try {
            return await StealthMode.getStealthStatus();
        } catch (error) {
            console.error('Failed to get stealth status:', error);
            return { enabled: false, app: 'zeus' };
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
