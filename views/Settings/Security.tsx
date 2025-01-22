import { inject, observer } from 'mobx-react';
import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { BiometryType } from 'react-native-biometrics';
import { Icon, ListItem } from 'react-native-elements';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';

import SettingsStore from '../../stores/SettingsStore';
import ModalStore from '../../stores/ModalStore';

import { verifyBiometry } from '../../utils/BiometricUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface SecurityProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    ModalStore: ModalStore;
    route: { params?: { enableBiometrics?: boolean } };
}

interface SecurityState {
    scramblePin: boolean;
    loginBackground: boolean;
    displaySecurityItems: Array<any>;
    pinExists: boolean;
    passphraseExists: boolean;
    supportedBiometryType: BiometryType | undefined;
    isBiometryEnabled: boolean | undefined;
}

const possibleSecurityItems = [
    {
        translateKey: 'views.Settings.SetPassword.title',
        screen: 'SetPassword'
    },
    {
        translateKey: 'views.Settings.SetDuressPassword.title',
        screen: 'SetDuressPassword'
    },
    {
        translateKey: 'views.Settings.SetPin.title',
        screen: 'SetPin'
    },
    {
        translateKey: 'views.Settings.Security.deletePIN',
        action: 'DeletePin'
    },
    {
        translateKey: 'views.Settings.SetDuressPin.title',
        screen: 'SetDuressPin'
    },
    {
        translateKey: 'views.Settings.Security.deleteDuressPIN',
        action: 'DeleteDuressPin'
    }
];

@inject('SettingsStore', 'ModalStore')
@observer
export default class Security extends React.Component<
    SecurityProps,
    SecurityState
> {
    constructor(props: SecurityProps) {
        super(props);
    }

    state = {
        scramblePin: true,
        loginBackground: false,
        displaySecurityItems: [],
        pinExists: false,
        passphraseExists: false,
        supportedBiometryType: undefined,
        isBiometryEnabled: undefined
    };

    componentDidMount() {
        this.checkSettings();
        this.props.navigation.addListener('focus', this.checkSettings);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.checkSettings);
    }

    checkSettings = async () => {
        const { SettingsStore, route } = this.props;
        const biometricsStatus = await SettingsStore.checkBiometricsStatus();
        const settings = await SettingsStore.getSettings();

        this.setState({
            scramblePin: settings.scramblePin ?? true,
            loginBackground: settings.loginBackground ?? false,
            isBiometryEnabled: biometricsStatus.isBiometryEnabled,
            supportedBiometryType: biometricsStatus.supportedBiometryType,
            pinExists: !!settings.pin,
            passphraseExists: !!settings.passphrase
        });

        if (settings.pin) {
            this.setState({
                pinExists: true
            });
        }

        if (settings.passphrase) {
            this.setState({
                passphraseExists: true
            });
        }

        // Three cases:
        // 1) If no passphrase or pin is set, allow user to set passphrase or pin
        // 2) If passphrase is set, allow user to set passphrase or duress passphrase
        // 3) If pin is set, allow user to set pin or duress pin
        if (!settings.passphrase && !settings.pin) {
            this.setState({
                displaySecurityItems: [
                    possibleSecurityItems[0],
                    possibleSecurityItems[2]
                ]
            });
        } else if (settings.passphrase) {
            this.setState({
                displaySecurityItems: [
                    possibleSecurityItems[0],
                    possibleSecurityItems[1]
                ]
            });
        } else if (settings.pin) {
            const minPinItems = [
                possibleSecurityItems[2],
                possibleSecurityItems[3],
                possibleSecurityItems[4]
            ];
            if (settings.duressPin) {
                minPinItems.push(possibleSecurityItems[5]);
            }
            this.setState({
                displaySecurityItems: minPinItems
            });
        }

        // If user tried to enable biometrics, but was forced to first set up pin or password,
        // call handleBiometricsSwitchChange again
        if (route.params?.enableBiometrics) {
            this.handleBiometricsSwitchChange(true);
        }
    };

    async handleBiometricsSwitchChange(value: boolean): Promise<void> {
        const { SettingsStore, ModalStore, navigation } = this.props;
        const { pin, passphrase } = SettingsStore.settings;

        if (value && !pin && !passphrase) {
            ModalStore.toggleInfoModal(
                localeString(
                    'views.Settings.Security.BiometryRequiresPinOrPassword'
                ),
                undefined,
                [
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
            );
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

    navigateSecurity = (item: any) => {
        const { navigation, SettingsStore, ModalStore } = this.props;
        const { settings }: any = SettingsStore;
        const { isBiometryEnabled } = this.state;

        if (!(settings.passphrase || settings.pin)) {
            navigation.navigate(item.screen);
        } else if (item.action === 'DeletePin' && isBiometryEnabled) {
            ModalStore.toggleInfoModal(
                [
                    localeString(
                        'views.Settings.Security.biometricsWillBeDisabled'
                    ),
                    localeString('general.continueQuestion')
                ],
                undefined,
                [
                    {
                        title: localeString('general.ok'),
                        callback: () =>
                            navigation.navigate('Lockscreen', {
                                deletePin: true
                            })
                    }
                ]
            );
        } else if (item.action === 'DeletePin') {
            navigation.navigate('Lockscreen', {
                deletePin: true
            });
        } else if (item.action === 'DeleteDuressPin') {
            navigation.navigate('Lockscreen', {
                deleteDuressPin: true
            });
        } else {
            // if we already have a pin/password set, make user authenticate in order to change
            navigation.navigate('Lockscreen', {
                modifySecurityScreen: item.screen
            });
        }
    };

    renderItem = ({ item }: { item: any }) => {
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
            isBiometryEnabled = false
        } = this.state;
        const { updateSettings, settings } = SettingsStore;

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
                        keyExtractor={(item: any, index) =>
                            `${item.translateKey}-${index}`
                        }
                        ItemSeparatorComponent={this.renderSeparator}
                        scrollEnabled={false}
                    />
                    {settings.supportedBiometryType !== undefined && (
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
                                        `views.Settings.Security.${this.state.supportedBiometryType}.title`
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
