import { inject, observer } from 'mobx-react';
import * as React from 'react';
import {
    AppState,
    AppStateStatus,
    NativeEventSubscription,
    Platform,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import Header from '../components/Header';
import Pin from '../components/Pin';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';
import TextInput from '../components/TextInput';
import ShowHideToggle from '../components/ShowHideToggle';

import SettingsStore, { PosEnabled } from '../stores/SettingsStore';

import { verifyBiometry } from '../utils/BiometricUtils';
import LinkingUtils from '../utils/LinkingUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface LockscreenProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<
        'Lockscreen',
        {
            modifySecurityScreen: string;
            deletePin: boolean;
            deleteDuressPin: boolean;
            pendingNavigation?: { screen: string; params?: any };
            shareIntentData?: { qrData?: string; base64Image?: string };
        }
    >;
}

interface LockscreenState {
    passphrase: string;
    passphraseAttempt: string;
    duressPassphrase: string;
    pin: string;
    pinAttempt: string;
    duressPin: string;
    hidden: boolean;
    error: boolean;
    modifySecurityScreen: string;
    deletePin: boolean;
    deleteDuressPin: boolean;
    authenticationAttempts: number;
}

const maxAuthenticationAttempts = 5;

@inject('SettingsStore')
@observer
export default class Lockscreen extends React.Component<
    LockscreenProps,
    LockscreenState
> {
    private subscription: NativeEventSubscription;

    constructor(props: any) {
        super(props);
        this.state = {
            passphraseAttempt: '',
            passphrase: '',
            duressPassphrase: '',
            pin: '',
            pinAttempt: '',
            duressPin: '',
            hidden: true,
            error: false,
            modifySecurityScreen: '',
            deletePin: false,
            deleteDuressPin: false,
            authenticationAttempts: 0
        };
    }

    proceed = (targetScreen?: string, navigationParams?: any) => {
        const { SettingsStore, navigation, route } = this.props;
        const shareIntentData = route.params?.shareIntentData;

        if (shareIntentData) {
            if (SettingsStore.settings.selectNodeOnStartup) {
                navigation.replace('Wallets', {
                    fromStartup: true,
                    shareIntentData
                });
            } else {
                navigation.replace('Wallet', {
                    shareIntentData
                });
            }
            return;
        }

        if (targetScreen) {
            navigation.popTo(targetScreen, { ...navigationParams });
        } else if (SettingsStore.settings.selectNodeOnStartup) {
            navigation.replace('Wallets', { fromStartup: true });
        } else {
            SettingsStore.triggerSettingsRefresh = true;

            const shareIntentProcessed =
                LinkingUtils.processPendingShareIntent(navigation);

            if (!shareIntentProcessed) {
                navigation.pop();
            }
        }
    };

    async componentDidMount() {
        const { SettingsStore, navigation, route } = this.props;
        const { settings } = SettingsStore;
        const {
            modifySecurityScreen,
            deletePin,
            deleteDuressPin,
            pendingNavigation
        } = route.params ?? {};

        const posEnabled: PosEnabled =
            (settings && settings.pos && settings.pos.posEnabled) ||
            PosEnabled.Disabled;

        if (
            posEnabled !== PosEnabled.Disabled &&
            SettingsStore.posStatus === 'active' &&
            !pendingNavigation &&
            !deletePin &&
            !deleteDuressPin
        ) {
            // If POS is enabled and active, proceed without authentication
            SettingsStore.setLoginStatus(true);
            this.proceed('Wallet');
            return;
        }

        const isBiometryConfigured = SettingsStore.isBiometryConfigured();

        if (
            isBiometryConfigured &&
            !deletePin &&
            !deleteDuressPin &&
            !modifySecurityScreen
        ) {
            const isVerified = await verifyBiometry(
                localeString('views.Lockscreen.Biometrics.prompt').replace(
                    'Zeus',
                    'ZEUS'
                )
            );

            if (isVerified) {
                SettingsStore.setPosStatus('inactive');
                this.resetAuthenticationAttempts();
                SettingsStore.setLoginStatus(true);
                this.proceed(
                    pendingNavigation?.screen,
                    pendingNavigation?.params
                );
                return;
            }
        }

        if (settings.authenticationAttempts) {
            this.setState({
                authenticationAttempts: settings.authenticationAttempts
            });
        }

        if (modifySecurityScreen) {
            this.setState({
                modifySecurityScreen
            });
        } else if (deletePin) {
            this.setState({
                deletePin
            });
        } else if (deleteDuressPin) {
            this.setState({
                deleteDuressPin
            });
        }

        if (settings && settings.passphrase) {
            this.setState({ passphrase: settings.passphrase });
            if (settings.duressPassphrase) {
                this.setState({
                    duressPassphrase: settings.duressPassphrase
                });
            }
        } else if (settings && settings.pin) {
            this.setState({ pin: settings.pin });
            if (settings.duressPin) {
                this.setState({
                    duressPin: settings.duressPin
                });
            }
        } else if (settings && settings.nodes && settings?.nodes?.length > 0) {
            this.proceed(pendingNavigation?.screen, pendingNavigation?.params);
        } else {
            navigation.popTo('IntroSplash');
        }

        this.subscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange
        );
    }

    componentWillUnmount() {
        this.subscription?.remove();
    }

    handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background') {
            this.setState({ passphraseAttempt: '' });
        }
    };

    onInputLabelPressed = () => {
        this.setState({ hidden: !this.state.hidden });
    };

    onAttemptLogIn = async () => {
        const { SettingsStore, navigation, route } = this.props;
        const {
            passphrase,
            duressPassphrase,
            passphraseAttempt,
            pin,
            pinAttempt,
            duressPin,
            modifySecurityScreen,
            deletePin,
            deleteDuressPin
        } = this.state;
        const { updateSettings, getSettings, setPosStatus } = SettingsStore;

        this.setState({
            error: false
        });

        const shareIntentData = route.params?.shareIntentData;

        if (
            (passphraseAttempt && passphraseAttempt === passphrase) ||
            (pinAttempt && pinAttempt === pin)
        ) {
            SettingsStore.setLoginStatus(true);

            // Check if we're modifying security settings first
            if (modifySecurityScreen) {
                this.resetAuthenticationAttempts();
                navigation.popTo(modifySecurityScreen);
                return;
            } else if (deletePin) {
                this.deletePin();
                return;
            } else if (deleteDuressPin) {
                this.deleteDuressPin();
                return;
            } else if (SettingsStore.settings.selectNodeOnStartup) {
                // Only handle wallet selection when NOT modifying security
                this.resetAuthenticationAttempts();

                const shareIntentData = route.params?.shareIntentData;

                if (shareIntentData) {
                    navigation.replace('Wallets', {
                        fromStartup: true,
                        shareIntentData
                    });
                } else {
                    navigation.replace('Wallets', { fromStartup: true });
                }
                return;
            } else if (
                !(
                    SettingsStore.settings.selectNodeOnStartup &&
                    SettingsStore.initialStart
                ) &&
                !shareIntentData
            ) {
                LinkingUtils.handleInitialUrl(navigation);
            }
            if (!SettingsStore.settings.selectNodeOnStartup) {
                if (
                    (SettingsStore.settings?.pos?.posEnabled ||
                        PosEnabled.Disabled) !== PosEnabled.Disabled
                ) {
                    setPosStatus('inactive');
                }
                this.resetAuthenticationAttempts();
                const pendingNavigation = route.params?.pendingNavigation;
                this.proceed(
                    pendingNavigation?.screen,
                    pendingNavigation?.params
                );
            }
        } else if (
            (duressPassphrase && passphraseAttempt === duressPassphrase) ||
            (duressPin && pinAttempt === duressPin)
        ) {
            SettingsStore.setLoginStatus(true);
            if (
                !(
                    SettingsStore.settings.selectNodeOnStartup &&
                    SettingsStore.initialStart
                )
            ) {
                LinkingUtils.handleInitialUrl(navigation);
            }
            this.deleteNodes();
        } else {
            // need to fetch updated settings to get incremented value of
            // authenticationAttempts, in case there are multiple failed attempts in a row
            const updatedSettings = await getSettings();
            let authenticationAttempts = 1;
            if (updatedSettings?.authenticationAttempts) {
                authenticationAttempts =
                    updatedSettings.authenticationAttempts + 1;
            }
            this.setState({
                authenticationAttempts
            });
            if (authenticationAttempts >= maxAuthenticationAttempts) {
                SettingsStore.setLoginStatus(true);
                if (
                    !(
                        SettingsStore.settings.selectNodeOnStartup &&
                        SettingsStore.initialStart
                    )
                ) {
                    LinkingUtils.handleInitialUrl(navigation);
                }
                // wipe node configs, passwords, and pins
                this.authenticationFailure();
            } else {
                await updateSettings({ authenticationAttempts }).then(() => {
                    this.setState({
                        error: true,
                        pinAttempt: ''
                    });
                });
            }
        }
    };

    onSubmitPin = (value: string) => {
        this.setState({ pinAttempt: value }, () => {
            this.onAttemptLogIn();
        });
    };

    deletePin = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        // duress pin is also deleted when pin is deleted
        // biometry is also disabled when pin is deleted
        updateSettings({
            pin: '',
            duressPin: '',
            authenticationAttempts: 0,
            isBiometryEnabled: false
        }).then(() => {
            navigation.popTo('Security');
        });
    };

    deleteDuressPin = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({
            duressPin: '',
            authenticationAttempts: 0
        }).then(() => {
            navigation.popTo('Security');
        });
    };

    deleteNodes = () => {
        const { SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({
            nodes: undefined,
            selectedNode: undefined,
            authenticationAttempts: 0
        }).then(() => {
            this.proceed('IntroSplash');
        });
    };

    authenticationFailure = () => {
        const { SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({
            nodes: undefined,
            selectedNode: undefined,
            passphrase: '',
            duressPassphrase: '',
            pin: '',
            duressPin: '',
            authenticationAttempts: 0
        }).then(() => {
            this.proceed('IntroSplash');
        });
    };

    resetAuthenticationAttempts = () => {
        const { SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({ authenticationAttempts: 0 });
    };

    generateErrorMessage = (): string => {
        const { passphrase, authenticationAttempts } = this.state;
        let incorrect = '';

        if (passphrase) {
            incorrect = localeString('views.Lockscreen.incorrectPassword');
        } else {
            incorrect = localeString('views.Lockscreen.incorrectPin');
        }

        return (
            incorrect +
            '\n' +
            (maxAuthenticationAttempts - authenticationAttempts).toString() +
            ' ' +
            localeString('views.Lockscreen.authenticationAttempts')
        );
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const pendingNavigation = this.props.route.params?.pendingNavigation;
        const { settings } = SettingsStore;
        const {
            passphrase,
            passphraseAttempt,
            pin,
            hidden,
            error,
            modifySecurityScreen,
            deletePin,
            deleteDuressPin
        } = this.state;

        return (
            <Screen>
                {(!!modifySecurityScreen ||
                    deletePin ||
                    deleteDuressPin ||
                    pendingNavigation) && (
                    <Header leftComponent="Back" navigation={navigation} />
                )}
                {!!passphrase && (
                    <View
                        style={{
                            ...styles.content,
                            flex: 1,
                            justifyContent: 'center',
                            marginTop:
                                Platform.OS === 'android' &&
                                SettingsStore.loginRequired()
                                    ? 30
                                    : 0
                        }}
                    >
                        {error && (
                            <ErrorMessage
                                message={this.generateErrorMessage()}
                            />
                        )}
                        <View style={{ marginBottom: 40 }}>
                            <Text
                                style={{
                                    ...styles.mainText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Lockscreen.enterPassword')}
                            </Text>
                        </View>
                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder={'****************'}
                                placeholderTextColor="darkgray"
                                value={passphraseAttempt}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        passphraseAttempt: text,
                                        error: false
                                    })
                                }
                                autoCapitalize="none"
                                autoCorrect={false}
                                secureTextEntry={hidden}
                                autoFocus={true}
                                style={{
                                    ...styles.textInput,
                                    paddingTop: passphraseAttempt === '' ? 6 : 2
                                }}
                                onSubmitEditing={() => this.onAttemptLogIn()}
                            />
                            <View style={styles.showHideToggle}>
                                <ShowHideToggle
                                    onPress={() => this.onInputLabelPressed()}
                                />
                            </View>
                        </View>
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Lockscreen.login')}
                                onPress={() => this.onAttemptLogIn()}
                                containerStyle={{ width: 300 }}
                                adaptiveWidth
                            />
                        </View>
                    </View>
                )}
                {!!pin && (
                    <View style={styles.container}>
                        <View style={{ flex: 1 }}>
                            <>
                                {(!!modifySecurityScreen ||
                                    deletePin ||
                                    deleteDuressPin) && (
                                    <View
                                        style={{
                                            flex: 2,
                                            marginTop: 25,
                                            marginBottom: 25
                                        }}
                                    >
                                        {error && (
                                            <ErrorMessage
                                                message={this.generateErrorMessage()}
                                            />
                                        )}
                                    </View>
                                )}
                                {!modifySecurityScreen &&
                                    !deletePin &&
                                    !deleteDuressPin && (
                                        <View
                                            style={{
                                                flex: 2,
                                                marginTop: 25,
                                                marginBottom: 25
                                            }}
                                        >
                                            {error && (
                                                <ErrorMessage
                                                    message={this.generateErrorMessage()}
                                                />
                                            )}
                                        </View>
                                    )}
                                <Text
                                    style={{
                                        ...styles.mainText,
                                        color: themeColor('text'),
                                        flex: 1,
                                        justifyContent: 'flex-end'
                                    }}
                                >
                                    {localeString('views.Lockscreen.pin')}
                                </Text>
                                <View
                                    style={{
                                        flex: 8,
                                        justifyContent: 'flex-end'
                                    }}
                                >
                                    <Pin
                                        onSubmit={this.onSubmitPin}
                                        onPinChange={() =>
                                            this.setState({ error: false })
                                        }
                                        hidePinLength={true}
                                        pinLength={pin.length}
                                        shuffle={settings.scramblePin}
                                    />
                                </View>
                            </>
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20,
        alignItems: 'center'
    },
    container: {
        flex: 1
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    },
    inputContainer: {
        flexDirection: 'row'
    },
    textInput: {
        flex: 1
    },
    showHideToggle: {
        alignSelf: 'center',
        marginLeft: 10
    },
    mainText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 20,
        textAlign: 'center'
    }
});
