import React, { useState, useEffect, useCallback } from 'react';
import { Platform, View } from 'react-native';

import { StealthAppContainer } from '../views/Stealth';
import StealthModeUtils, { StealthApp } from '../utils/StealthModeUtils';
import Storage from '../storage';

interface StealthModeWrapperProps {
    children: React.ReactNode;
}

// Must match STORAGE_KEY in SettingsStore
const STORAGE_KEY = 'zeus-settings-v2';

/**
 * Wrapper component that checks if stealth mode is active on startup
 * and renders the appropriate decoy app if so.
 */
interface StealthConfig {
    pinLength: number;
    vpnCountry: string;
    vpnServer: string;
}

const StealthModeWrapper: React.FC<StealthModeWrapperProps> = ({
    children
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isStealthActive, setIsStealthActive] = useState(false);
    const [stealthApp, setStealthApp] = useState<StealthApp>('calculator');
    const [stealthConfig, setStealthConfig] = useState<StealthConfig>({
        pinLength: 5,
        vpnCountry: 'Switzerland',
        vpnServer: 'Geneva'
    });

    useEffect(() => {
        checkStealthStatus();
    }, []);

    const checkStealthStatus = async () => {
        // Only check on Android
        if (Platform.OS !== 'android') {
            setIsLoading(false);
            return;
        }

        try {
            // Check native stealth status first (most reliable)
            const nativeActive = await StealthModeUtils.isStealthModeActive();

            if (nativeActive) {
                // Get the selected stealth app and config from settings
                const settingsStr = await Storage.getItem(STORAGE_KEY);
                if (settingsStr) {
                    const settings = JSON.parse(settingsStr);
                    const selectedApp =
                        settings?.privacy?.stealthApp || 'calculator';
                    setStealthApp(selectedApp);
                    setStealthConfig({
                        pinLength: settings?.privacy?.stealthPinLength || 5,
                        vpnCountry:
                            settings?.privacy?.stealthVpnCountry ||
                            'Switzerland',
                        vpnServer:
                            settings?.privacy?.stealthVpnServer || 'Geneva'
                    });
                }
                setIsStealthActive(true);
            }
        } catch (error) {
            console.error('Error checking stealth status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnlock = useCallback(async () => {
        // Disable stealth mode when unlocked
        setIsStealthActive(false);

        // Note: We don't call StealthModeUtils.disableStealthMode() here
        // because the user might want to keep stealth mode enabled
        // (icon/name change) while using the app.
        // The stealth mode toggle in settings controls the actual
        // icon/name change. Here we just reveal the real app.
    }, []);

    // Show nothing while loading to prevent flash
    if (isLoading) {
        return <View style={{ flex: 1, backgroundColor: '#000' }} />;
    }

    // Show decoy app if stealth is active
    if (isStealthActive) {
        return (
            <StealthAppContainer
                stealthApp={stealthApp}
                onUnlock={handleUnlock}
                config={stealthConfig}
            />
        );
    }

    // Show normal app
    return <>{children}</>;
};

export default StealthModeWrapper;
