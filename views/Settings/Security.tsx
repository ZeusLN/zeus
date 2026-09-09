import { inject, observer } from 'mobx-react';
import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { BiometryType } from 'react-native-biometrics';
import { Icon, ListItem } from '@rneui/themed';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

import SettingsStore, { Settings } from '../../stores/SettingsStore';
import ModalStore from '../../stores/ModalStore';

import { verifyBiometry } from '../../utils/BiometricUtils';
import { hasVerifier } from '../../utils/LockVerifierUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface SecurityProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    ModalStore: ModalStore;
    route: { params?: { enableBiometrics?: boolean } };
}

type SecurityItem =
    | { translateKey: string; screen: string }
    | { translateKey: string; action: string };

interface SecurityState {
    scramblePin: boolean;
    loginBackground: boolean;
    displaySecurityItems: SecurityItem[];
    pinExists: boolean;
    passphraseExists: boolean;
    supportedBiometryType: BiometryType | undefined;
    isBiometryEnabled: boolean | undefined;
}

// Build list rows from in-memory settings so first paint matches other
// settings screens (no empty → populated flash after async load).
const buildSecurityItems = (
    settings: Pick<
        Settings,
        | 'passphraseVerifier'
        | 'pinVerifier'
        | 'duressPassphraseVerifier'
        | 'duressPinVerifier'
    >
): SecurityItem[] => {
    // Credentials persist as verifier records; presence is checked via
    // hasVerifier since the plaintext fields no longer exist post-migration.
    const passphraseSet = hasVerifier(settings.passphraseVerifier);
    const pinSet = hasVerifier(settings.pinVerifier);
    // Three cases:
    // 1) If no passphrase or pin is set, allow user to set passphrase or pin
    // 2) If passphrase is set, allow user to change passphrase or set/change duress passphrase
    // 3) If pin is set, allow user to change pin, delete pin, set/change duress pin
    if (!passphraseSet && !pinSet) {
        return [
            {
                translateKey: 'views.Settings.SetPassword.title',
                screen: 'SetPassword'
            },
            {
                translateKey: 'views.Settings.SetPin.title',
                screen: 'SetPin'
            }
        ];
    }
    if (passphraseSet) {
        const duressPassphraseSet = hasVerifier(
            settings.duressPassphraseVerifier
        );
        const items: SecurityItem[] = [
            {
                translateKey: 'views.Settings.ChangePassword.title',
                screen: 'SetPassword'
            },
            {
                translateKey: 'views.Settings.SetPassword.deletePassword',
                action: 'DeletePassword'
            },
            {
                translateKey: duressPassphraseSet
                    ? 'views.Settings.ChangeDuressPassword.title'
                    : 'views.Settings.SetDuressPassword.title',
                screen: 'SetDuressPassword'
            }
        ];
        if (duressPassphraseSet) {
            items.push({
                translateKey: 'views.Settings.SetDuressPassword.deletePassword',
                action: 'DeleteDuressPassword'
            });
        }
        return items;
    }
    // Remaining case: pin is set (branch 1 handled neither; branch 2 handled passphrase)
    const duressPinSet = hasVerifier(settings.duressPinVerifier);
    const items: SecurityItem[] = [
        {
            translateKey: 'views.Settings.ChangePin.title',
            screen: 'SetPin'
        },
        {
            translateKey: 'views.Settings.Security.deletePIN',
            action: 'DeletePin'
        },
        {
            translateKey: duressPinSet
                ? 'views.Settings.ChangeDuressPin.title'
                : 'views.Settings.SetDuressPin.title',
            screen: 'SetDuressPin'
        }
    ];
    if (duressPinSet) {
        items.push({
            translateKey: 'views.Settings.Security.deleteDuressPIN',
            action: 'DeleteDuressPin'
        });
    }
    return items;
};

const deriveStateFromSettings = (
    settings: Settings,
    biometrics?: {
        isBiometryEnabled: boolean;
        supportedBiometryType: BiometryType | undefined;
    }
): SecurityState => ({
    scramblePin: settings.scramblePin ?? true,
    loginBackground: settings.loginBackground ?? false,
    displaySecurityItems: buildSecurityItems(settings),
    pinExists: hasVerifier(settings.pinVerifier),
    passphraseExists: hasVerifier(settings.passphraseVerifier),
    supportedBiometryType:
        biometrics?.supportedBiometryType ?? settings.supportedBiometryType,
    isBiometryEnabled:
        biometrics?.isBiometryEnabled ?? settings.isBiometryEnabled
});

@inject('SettingsStore', 'ModalStore')
@observer
export default class Security extends React.Component<
    SecurityProps,
    SecurityState
> {
    constructor(props: SecurityProps) {
        super(props);
        this.state = deriveStateFromSettings(props.SettingsStore.settings);
    }

    componentDidMount() {
        this.props.navigation.addListener('focus', this.checkSettings);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.checkSettings);
    }

    checkSettings = async () => {
        const { SettingsStore, navigation, route } = this.props;
        const biometricsStatus = await SettingsStore.checkBiometricsStatus();
        const settings = await SettingsStore.getSettings();

        this.setState(
            deriveStateFromSettings(settings, {
                isBiometryEnabled: biometricsStatus.isBiometryEnabled,
                supportedBiometryType: biometricsStatus.supportedBiometryType
            })
        );

        // If user tried to enable biometrics, but was forced to first set up pin or password,
        // call handleBiometricsSwitchChange again
        if (route.params?.enableBiometrics) {
            // Clear before prompting so a later focus (e.g. after Lockscreen)
            // does not re-trigger the OS biometric prompt
            navigation.setParams({ enableBiometrics: undefined });
            this.handleBiometricsSwitchChange(true);
        }
    };

    async handleBiometricsSwitchChange(value: boolean): Promise<void> {
        const { SettingsStore, ModalStore, navigation } = this.props;
        const { pinVerifier, passphraseVerifier } = SettingsStore.settings;

        if (
            value &&
            !hasVerifier(pinVerifier) &&
            !hasVerifier(passphraseVerifier)
        ) {
            ModalStore.toggleInfoModal({
                text: localeString(
                    'views.Settings.Security.BiometryRequiresPinOrPassword'
                ),
                buttons: [
                    {
                        title: localeString(
                            'views.Settings.createYourPassword'
                        ),
                        callback: () =>
                            navigation.navigate('SetPassword', {
                                forBiometrics: true
                            })
                    },
                    {
                        title: localeString('views.Settings.newPin'),
                        callback: () =>
                            navigation.navigate('SetPin', {
                                forBiometrics: true
                            })
                    }
                ]
            });
            return;
        }

        const isVerified = await verifyBiometry(
            localeString('views.Settings.Security.Biometrics.prompt')
        );

        if (isVerified) {
            this.setState({ isBiometryEnabled: value });
            SettingsStore.updateSettings({
                isBiometryEnabled: value
            });
        }
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    navigateSecurity = (item: SecurityItem) => {
        const { navigation, SettingsStore, ModalStore } = this.props;
        const { settings } = SettingsStore;
        const { isBiometryEnabled } = this.state;

        if (!('action' in item)) {
            if (
                !(
                    hasVerifier(settings.passphraseVerifier) ||
                    hasVerifier(settings.pinVerifier)
                )
            ) {
                navigation.navigate(item.screen);
            } else {
                // if we already have a pin/password set, make user authenticate in order to change
                navigation.navigate('Lockscreen', {
                    modifySecurityScreen: item.screen
                });
            }
            return;
        }

        if (item.action === 'DeletePin' && isBiometryEnabled) {
            ModalStore.toggleInfoModal({
                text: [
                    localeString(
                        'views.Settings.Security.biometricsWillBeDisabled'
                    ),
                    localeString('general.continueQuestion')
                ],
                buttons: [
                    {
                        title: localeString('general.ok'),
                        callback: () =>
                            navigation.navigate('Lockscreen', {
                                deletePin: true
                            })
                    }
                ]
            });
        } else if (item.action === 'DeletePin') {
            navigation.navigate('Lockscreen', { deletePin: true });
        } else if (item.action === 'DeletePassword' && isBiometryEnabled) {
            ModalStore.toggleInfoModal({
                text: [
                    localeString(
                        'views.Settings.Security.biometricsWillBeDisabled'
                    ),
                    localeString('general.continueQuestion')
                ],
                buttons: [
                    {
                        title: localeString('general.ok'),
                        callback: () =>
                            navigation.navigate('Lockscreen', {
                                deletePassword: true
                            })
                    }
                ]
            });
        } else if (item.action === 'DeletePassword') {
            navigation.navigate('Lockscreen', { deletePassword: true });
        } else if (item.action === 'DeleteDuressPassword') {
            navigation.navigate('Lockscreen', { deleteDuressPassword: true });
        } else if (item.action === 'DeleteDuressPin') {
            navigation.navigate('Lockscreen', { deleteDuressPin: true });
        }
    };

    renderItem = ({ item }: { item: SecurityItem }) => {
        return (
            <ListItem
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: 'transparent'
                }}
                onPress={() => this.navigateSecurity(item)}
            >
                <ListItem.Content>
                    <ListItem.Title
                        style={{
                            color: themeColor('secondaryText'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {localeString(item.translateKey)}
                    </ListItem.Title>
                </ListItem.Content>
                <Icon
                    name="keyboard-arrow-right"
                    color={themeColor('secondaryText')}
                />
            </ListItem>
        );
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            scramblePin,
            displaySecurityItems,
            pinExists,
            passphraseExists,
            loginBackground,
            isBiometryEnabled = false,
            supportedBiometryType
        } = this.state;
        const { updateSettings } = SettingsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.Security.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    <FlatList
                        data={displaySecurityItems}
                        renderItem={this.renderItem}
                        keyExtractor={(item: SecurityItem, index) =>
                            `${item.translateKey}-${index}`
                        }
                        ItemSeparatorComponent={this.renderSeparator}
                        scrollEnabled={false}
                    />
                    {supportedBiometryType !== undefined && (
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        `views.Settings.Security.${supportedBiometryType}.title`
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>

                            <Switch
                                value={isBiometryEnabled}
                                onValueChange={(value: boolean) =>
                                    this.handleBiometricsSwitchChange(value)
                                }
                            />
                        </ListItem>
                    )}
                    {pinExists && (
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Security.scramblePIN'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Switch
                                value={scramblePin}
                                onValueChange={async () => {
                                    this.setState({
                                        scramblePin: !scramblePin
                                    });
                                    updateSettings({
                                        scramblePin: !scramblePin
                                    });
                                }}
                            />
                        </ListItem>
                    )}
                    {(pinExists || passphraseExists || isBiometryEnabled) && (
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Security.loginBackground'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Switch
                                value={loginBackground}
                                onValueChange={async () => {
                                    this.setState({
                                        loginBackground: !loginBackground
                                    });
                                    updateSettings({
                                        loginBackground: !loginBackground
                                    });
                                }}
                            />
                        </ListItem>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}
