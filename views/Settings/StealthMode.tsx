import * as React from 'react';
import {
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';

import SettingsStore from '../../stores/SettingsStore';

// VPN locations for unlock configuration
const VPN_LOCATIONS: { country: string; servers: string[] }[] = [
    {
        country: 'United States',
        servers: ['New York', 'Los Angeles', 'Chicago', 'Miami']
    },
    { country: 'Canada', servers: ['Toronto', 'Vancouver', 'Montreal'] },
    {
        country: 'United Kingdom',
        servers: ['London', 'Manchester', 'Edinburgh']
    },
    { country: 'Germany', servers: ['Frankfurt', 'Berlin', 'Munich'] },
    { country: 'Netherlands', servers: ['Amsterdam', 'Rotterdam'] },
    { country: 'France', servers: ['Paris', 'Lyon', 'Marseille'] },
    { country: 'Japan', servers: ['Tokyo', 'Osaka'] },
    { country: 'Australia', servers: ['Sydney', 'Melbourne'] },
    { country: 'Sweden', servers: ['Stockholm', 'Gothenburg'] },
    { country: 'Switzerland', servers: ['Zurich', 'Geneva'] }
];

// Tap count options
const TAP_COUNT_OPTIONS = [
    { key: '3', value: '3 taps' },
    { key: '5', value: '5 taps' },
    { key: '7', value: '7 taps' },
    { key: '10', value: '10 taps' }
];

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import StealthModeUtils, { StealthApp } from '../../utils/StealthModeUtils';

// Stealth app icons
const CalculatorIcon = require('../../assets/images/stealth/calculator.png');
const VPNIcon = require('../../assets/images/stealth/vpn.png');
const QRScannerIcon = require('../../assets/images/stealth/qrscanner.png');
const NotepadIcon = require('../../assets/images/stealth/notepad.png');

interface StealthModeProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface StealthModeState {
    stealthEnabled: boolean;
    selectedApp: StealthApp;
    stealthPinLength: number;
    stealthVpnCountry: string;
    stealthVpnServer: string;
}

const STEALTH_APPS: {
    key: StealthApp;
    label: string;
    translateKey: string;
    icon: any;
    unlockInstruction: string;
}[] = [
    {
        key: 'calculator',
        label: 'Calculator',
        translateKey: 'views.Settings.StealthMode.calculator',
        icon: CalculatorIcon,
        unlockInstruction: 'views.Settings.StealthMode.unlockCalculator'
    },
    {
        key: 'vpn',
        label: 'Edge VPN',
        translateKey: 'views.Settings.StealthMode.vpn',
        icon: VPNIcon,
        unlockInstruction: 'views.Settings.StealthMode.unlockVPN'
    },
    {
        key: 'qrscanner',
        label: 'QR Scanner',
        translateKey: 'views.Settings.StealthMode.qrscanner',
        icon: QRScannerIcon,
        unlockInstruction: 'views.Settings.StealthMode.unlockQRScanner'
    },
    {
        key: 'notepad',
        label: 'Notepad',
        translateKey: 'views.Settings.StealthMode.notepad',
        icon: NotepadIcon,
        unlockInstruction: 'views.Settings.StealthMode.unlockNotepad'
    }
];

@inject('SettingsStore')
@observer
export default class StealthMode extends React.Component<
    StealthModeProps,
    StealthModeState
> {
    private unsubscribeBlur: (() => void) | null = null;
    private initialApp: StealthApp = 'calculator';
    private initialStealthEnabled: boolean = false;

    state = {
        stealthEnabled: false,
        selectedApp: 'calculator' as StealthApp,
        stealthPinLength: 5,
        stealthVpnCountry: 'Switzerland',
        stealthVpnServer: 'Geneva'
    };

    async componentDidMount() {
        const { SettingsStore, navigation } = this.props;
        const settings = await SettingsStore.getSettings();

        const currentApp =
            (settings.privacy && settings.privacy.stealthApp) || 'calculator';
        const currentStealthEnabled =
            (settings.privacy && settings.privacy.stealthMode) || false;

        this.initialApp = currentApp;
        this.initialStealthEnabled = currentStealthEnabled;

        this.setState({
            stealthEnabled: currentStealthEnabled,
            selectedApp: currentApp,
            stealthPinLength:
                (settings.privacy && settings.privacy.stealthPinLength) || 5,
            stealthVpnCountry:
                (settings.privacy && settings.privacy.stealthVpnCountry) ||
                'Switzerland',
            stealthVpnServer:
                (settings.privacy && settings.privacy.stealthVpnServer) ||
                'Geneva'
        });

        // Listen for navigation blur event to apply stealth mode changes
        this.unsubscribeBlur = navigation.addListener('blur', () => {
            this.applyStealthModeIfNeeded();
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeBlur) {
            this.unsubscribeBlur();
        }
    }

    applyStealthModeIfNeeded = async () => {
        const { stealthEnabled, selectedApp } = this.state;

        try {
            // Handle stealth mode toggle changes
            if (stealthEnabled !== this.initialStealthEnabled) {
                if (stealthEnabled) {
                    await StealthModeUtils.enableStealthMode(selectedApp);
                } else {
                    await StealthModeUtils.disableStealthMode();
                }
                return;
            }

            // Handle app selection changes (only if stealth is enabled)
            if (stealthEnabled && selectedApp !== this.initialApp) {
                await StealthModeUtils.enableStealthMode(selectedApp);
            }
        } catch (error) {
            console.error('Error applying stealth mode on blur:', error);
        }
    };

    handleToggleStealth = async () => {
        const { SettingsStore } = this.props;
        const { stealthEnabled } = this.state;
        const { settings, updateSettings } = SettingsStore;

        const newStealthEnabled = !stealthEnabled;

        this.setState({ stealthEnabled: newStealthEnabled });

        // Only save the setting - native stealth mode change will be applied
        // when the user navigates back from this screen
        await updateSettings({
            privacy: {
                ...settings.privacy,
                stealthMode: newStealthEnabled
            }
        });
    };

    handleSelectApp = async (app: StealthApp) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;

        this.setState({ selectedApp: app });

        // Only save the setting - native stealth mode change will be applied
        // when the app goes to background or is closed
        await updateSettings({
            privacy: {
                ...settings.privacy,
                stealthApp: app
            }
        });
    };

    getSelectedAppInfo = () => {
        const { selectedApp } = this.state;
        return STEALTH_APPS.find((app) => app.key === selectedApp);
    };

    getUnlockInstructionText = () => {
        const {
            selectedApp,
            stealthPinLength,
            stealthVpnCountry,
            stealthVpnServer
        } = this.state;

        switch (selectedApp) {
            case 'vpn':
                return localeString(
                    'views.Settings.StealthMode.unlockVPNCustom'
                )
                    .replace('{country}', stealthVpnCountry)
                    .replace('{server}', stealthVpnServer);
            case 'calculator':
                return localeString(
                    'views.Settings.StealthMode.unlockCalculatorCustom'
                ).replace('{count}', String(stealthPinLength));
            case 'notepad':
                return localeString(
                    'views.Settings.StealthMode.unlockNotepadCustom'
                ).replace('{count}', String(stealthPinLength));
            case 'qrscanner':
                return localeString(
                    'views.Settings.StealthMode.unlockQRScannerCustom'
                ).replace('{count}', String(stealthPinLength));
            default:
                return '';
        }
    };

    handleUpdateVpnCountry = async (country: string) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;

        // Get first server of the new country
        const countryData = VPN_LOCATIONS.find(
            (loc) => loc.country === country
        );
        const server = countryData?.servers[0] || 'Geneva';

        this.setState({ stealthVpnCountry: country, stealthVpnServer: server });

        await updateSettings({
            privacy: {
                ...settings.privacy,
                stealthVpnCountry: country,
                stealthVpnServer: server
            }
        });
    };

    handleUpdateVpnServer = async (server: string) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;

        this.setState({ stealthVpnServer: server });

        await updateSettings({
            privacy: {
                ...settings.privacy,
                stealthVpnServer: server
            }
        });
    };

    handleUpdateTapCount = async (count: string) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;

        const pinLength = parseInt(count, 10);
        this.setState({ stealthPinLength: pinLength });

        await updateSettings({
            privacy: {
                ...settings.privacy,
                stealthPinLength: pinLength
            }
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            stealthEnabled,
            selectedApp,
            stealthPinLength,
            stealthVpnCountry,
            stealthVpnServer
        } = this.state;
        const isAndroid = Platform.OS === 'android';

        if (!isAndroid) {
            return (
                <Screen>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.StealthMode.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: 20
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16,
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'views.Settings.StealthMode.androidOnly'
                            )}
                        </Text>
                    </View>
                </Screen>
            );
        }

        const selectedAppInfo = this.getSelectedAppInfo();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.StealthMode.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    {/* Toggle Section */}
                    <View
                        style={[
                            styles.section,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <View style={styles.toggleRow}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 16,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.StealthMode.offOn'
                                )}
                            </Text>
                            <Switch
                                value={stealthEnabled}
                                onValueChange={this.handleToggleStealth}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                            />
                        </View>
                    </View>

                    {/* App Selection Section */}
                    <View
                        style={[
                            styles.section,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 18,
                                fontFamily: 'PPNeueMontreal-Medium',
                                marginBottom: 5
                            }}
                        >
                            {localeString(
                                'views.Settings.StealthMode.chooseApp'
                            )}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 14,
                                fontFamily: 'PPNeueMontreal-Book',
                                marginBottom: 15
                            }}
                        >
                            {selectedAppInfo?.label}
                        </Text>

                        <View style={styles.appGrid}>
                            {STEALTH_APPS.map((app) => (
                                <TouchableOpacity
                                    key={app.key}
                                    style={[
                                        styles.appItem,
                                        selectedApp === app.key && {
                                            borderColor:
                                                themeColor('highlight'),
                                            backgroundColor:
                                                themeColor('background')
                                        }
                                    ]}
                                    onPress={() =>
                                        this.handleSelectApp(app.key)
                                    }
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                >
                                    <Image
                                        source={app.icon}
                                        style={styles.appIcon}
                                        resizeMode="contain"
                                    />
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 12,
                                            fontFamily: 'PPNeueMontreal-Book',
                                            marginTop: 8,
                                            textAlign: 'center'
                                        }}
                                    >
                                        {localeString(app.translateKey)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Configuration Section */}
                    <View
                        style={[
                            styles.section,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 18,
                                fontFamily: 'PPNeueMontreal-Medium',
                                marginBottom: 15,
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'views.Settings.StealthMode.unlockConfig'
                            )}
                        </Text>

                        {/* VPN Configuration */}
                        {selectedApp === 'vpn' && (
                            <>
                                <DropdownSetting
                                    title={localeString(
                                        'views.Settings.StealthMode.vpnCountry'
                                    )}
                                    selectedValue={stealthVpnCountry}
                                    onValueChange={(value: string) =>
                                        this.handleUpdateVpnCountry(value)
                                    }
                                    values={VPN_LOCATIONS.map((loc) => ({
                                        key: loc.country,
                                        value: loc.country
                                    }))}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                />
                                <DropdownSetting
                                    title={localeString(
                                        'views.Settings.StealthMode.vpnServer'
                                    )}
                                    selectedValue={stealthVpnServer}
                                    onValueChange={(value: string) =>
                                        this.handleUpdateVpnServer(value)
                                    }
                                    values={(
                                        VPN_LOCATIONS.find(
                                            (loc) =>
                                                loc.country ===
                                                stealthVpnCountry
                                        )?.servers || ['Geneva']
                                    ).map((server) => ({
                                        key: server,
                                        value: server
                                    }))}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                />
                            </>
                        )}

                        {/* Tap-based apps configuration */}
                        {(selectedApp === 'calculator' ||
                            selectedApp === 'notepad' ||
                            selectedApp === 'qrscanner') && (
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.StealthMode.tapCount'
                                )}
                                selectedValue={String(stealthPinLength)}
                                onValueChange={(value: string) =>
                                    this.handleUpdateTapCount(value)
                                }
                                values={TAP_COUNT_OPTIONS}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                            />
                        )}
                    </View>

                    {/* Instructions Section */}
                    <View
                        style={[
                            styles.section,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontSize: 18,
                                fontFamily: 'PPNeueMontreal-Medium',
                                marginBottom: 20,
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'views.Settings.StealthMode.instructions'
                            )}
                        </Text>

                        <View style={styles.instructionBlock}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 16,
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    marginBottom: 8
                                }}
                            >
                                {localeString(
                                    'views.Settings.StealthMode.unlockTitle'
                                )}
                            </Text>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 14,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {this.getUnlockInstructionText()}
                            </Text>
                        </View>

                        <View
                            style={{
                                height: 1,
                                backgroundColor: themeColor('separator'),
                                marginVertical: 15
                            }}
                        />

                        <View style={styles.instructionBlock}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 16,
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    marginBottom: 8
                                }}
                            >
                                {localeString(
                                    'views.Settings.StealthMode.disableTitle'
                                )}
                            </Text>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 14,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.StealthMode.disableDesc'
                                )}
                            </Text>
                        </View>
                    </View>

                    {/* Note about launcher refresh */}
                    <View
                        style={[
                            styles.section,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 13,
                                fontFamily: 'PPNeueMontreal-Book',
                                fontStyle: 'italic',
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'views.Settings.StealthMode.launcherNote'
                            )}
                        </Text>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    section: {
        marginHorizontal: 15,
        marginTop: 15,
        borderRadius: 10,
        padding: 15
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    appGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
    },
    appItem: {
        width: '23%',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    appIcon: {
        width: 50,
        height: 50
    },
    instructionBlock: {
        paddingHorizontal: 5
    }
});
