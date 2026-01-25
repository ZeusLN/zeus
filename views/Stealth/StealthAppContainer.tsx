import * as React from 'react';
import { View, StyleSheet } from 'react-native';

import CalculatorApp from './CalculatorApp';
import VPNApp from './VPNApp';
import NotepadApp from './NotepadApp';
import QRScannerApp from './QRScannerApp';

import { StealthApp } from '../../utils/StealthModeUtils';

interface StealthConfig {
    pinLength: number;
    vpnCountry: string;
    vpnServer: string;
}

interface StealthAppContainerProps {
    stealthApp: StealthApp;
    onUnlock: () => void;
    config?: StealthConfig;
}

const StealthAppContainer: React.FC<StealthAppContainerProps> = ({
    stealthApp,
    onUnlock,
    config = { pinLength: 5, vpnCountry: 'Switzerland', vpnServer: 'Geneva' }
}) => {
    const renderDecoyApp = () => {
        switch (stealthApp) {
            case 'calculator':
                return (
                    <CalculatorApp
                        onUnlock={onUnlock}
                        requiredTaps={config.pinLength}
                    />
                );
            case 'vpn':
                return (
                    <VPNApp
                        onUnlock={onUnlock}
                        unlockCountry={config.vpnCountry}
                        unlockServer={config.vpnServer}
                    />
                );
            case 'notepad':
                return (
                    <NotepadApp
                        onUnlock={onUnlock}
                        requiredTaps={config.pinLength}
                    />
                );
            case 'qrscanner':
                return (
                    <QRScannerApp
                        onUnlock={onUnlock}
                        requiredTaps={config.pinLength}
                    />
                );
            default:
                return (
                    <CalculatorApp
                        onUnlock={onUnlock}
                        requiredTaps={config.pinLength}
                    />
                );
        }
    };

    return <View style={styles.container}>{renderDecoyApp()}</View>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});

export default StealthAppContainer;
