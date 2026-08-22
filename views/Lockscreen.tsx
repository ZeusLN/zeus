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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/Button';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Pin from '../components/Pin';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';
import TextInput from '../components/TextInput';
import ShowHideToggle from '../components/ShowHideToggle';

import SettingsStore, { PosEnabled } from '../stores/SettingsStore';

import { verifyBiometry } from '../utils/BiometricUtils';
import {
    blockNavigationDuringWipe,
    clearAllData
} from '../utils/DataClearUtils';
import { localeString } from '../utils/LocaleUtils';
import { restartApp } from '../utils/RestartUtils';
import {
    verifySecret,
    hasVerifier,
    VerifierRecord
} from '../utils/LockVerifierUtils';
import { themeColor } from '../utils/ThemeUtils';

interface LockscreenProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<
        'Lockscreen',
        {
            modifySecurityScreen: string;
            deletePin: boolean;
            deleteDuressPin: boolean;
            deletePassword: boolean;
            deleteDuressPassword: boolean;
            pendingNavigation?: { screen: string; params?: any };
            shareIntentData?: { qrData?: string; base64Image?: string };
        }
    >;
}

interface LockscreenState {
    authMethod: 'pin' | 'passphrase' | null;
    passphraseVerifier?: VerifierRecord;
    passphraseAttempt: string;
    duressPassphraseVerifier?: VerifierRecord;
    pinVerifier?: VerifierRecord;
    pinAttempt: string;
    duressPinVerifier?: VerifierRecord;
    hidden: boolean;
    error: boolean;
    verifying: boolean;
    modifySecurityScreen: string;
    deletePin: boolean;
    deleteDuressPin: boolean;
    deletePassword: boolean;
    deleteDuressPassword: boolean;
    authenticationAttempts: number;
    wiping: boolean;
}

const maxAuthenticationAttempts = 5;

@inject('SettingsStore')
@observer
export default class Lockscreen extends React.Component<
    LockscreenProps,
    LockscreenState
> {
    private subscription: NativeEventSubscription;
    private releaseWipeGuard: (() => void) | null = null;

    constructor(props: any) {
        super(props);
        this.state = {
            authMethod: null,
            passphraseAttempt: '',
            passphraseVerifier: undefined,
            duressPassphraseVerifier: undefined,
            pinVerifier: undefined,
            pinAttempt: '',
            duressPinVerifier: undefined,
            hidden: true,
            error: false,
            verifying: false,
            modifySecurityScreen: '',
            deletePin: false,
            deleteDuressPin: false,
            deletePassword: false,
            deleteDuressPassword: false,
            authenticationAttempts: 0,
            wiping: false
        };
    }

    get isSecurityManagementFlow(): boolean {
        const {
            modifySecurityScreen,
            deletePin,
            deleteDuressPin,
            deletePassword,
            deleteDuressPassword
        } = this.state;

        return (
            !!modifySecurityScreen ||
            deletePin ||
            deleteDuressPin ||
            deletePassword ||
            deleteDuressPassword
        );
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
            navigation.pop();
        }
    };

    async componentDidMount() {
        const { SettingsStore, navigation, route } = this.props;
        const { settings } = SettingsStore;
        const {
            modifySecurityScreen,
            deletePin,
            deleteDuressPin,
            deletePassword,
            deleteDuressPassword,
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
            !deleteDuressPin &&
            !deletePassword &&
            !deleteDuressPassword
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
            !deletePassword &&
            !deleteDuressPassword &&
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
        } else if (deletePassword) {
            this.setState({
                deletePassword
            });
        } else if (deleteDuressPassword) {
            this.setState({
                deleteDuressPassword
            });
        }

        if (settings && hasVerifier(settings.passphraseVerifier)) {
            this.setState({
                authMethod: 'passphrase',
                passphraseVerifier: settings.passphraseVerifier,
                duressPassphraseVerifier: settings.duressPassphraseVerifier
            });
        } else if (settings && hasVerifier(settings.pinVerifier)) {
            this.setState({
                authMethod: 'pin',
                pinVerifier: settings.pinVerifier,
                duressPinVerifier: settings.duressPinVerifier
            });
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
        this.releaseWipeGuard?.();
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
            authMethod,
            passphraseVerifier,
            duressPassphraseVerifier,
            passphraseAttempt,
            pinVerifier,
            pinAttempt,
            duressPinVerifier,
            modifySecurityScreen,
            deletePin,
            deleteDuressPin,
            deletePassword,
            deleteDuressPassword
        } = this.state;
        const { updateSettings, getSettings, setPosStatus } = SettingsStore;

        // a wipe is already running; a second submit must not start another
        // wipe or mutate settings mid-wipe
        if (this.state.wiping) return;

        // Guard against re-entrancy: scrypt verification is asynchronous
        // (~1s), so a double tap on the login button or a second submit could
        // otherwise start a second attempt and double-count the failure
        // counter. The `verifying` flag also drives the spinner overlay.
        if (this.state.verifying) return;

        this.setState({
            error: false,
            verifying: true
        });

        // Verify against the salted verifier for the active method. The normal
        // and duress checks are both computed (equal cost) before branching so
        // response time never reveals which credential matched - keeping the
        // duress credential indistinguishable from a normal login attempt.
        const attempt =
            authMethod === 'passphrase' ? passphraseAttempt : pinAttempt;
        const primaryVerifier =
            authMethod === 'passphrase' ? passphraseVerifier : pinVerifier;
        const duressVerifier =
            authMethod === 'passphrase'
                ? duressPassphraseVerifier
                : duressPinVerifier;

        const [primaryMatch, duressMatch] = await Promise.all([
            verifySecret(attempt, primaryVerifier),
            verifySecret(attempt, duressVerifier)
        ]);

        if (primaryMatch) {
            SettingsStore.setLoginStatus(true);

            // Check if we're modifying security settings first
            if (modifySecurityScreen) {
                this.resetAuthenticationAttempts();
                navigation.popTo(modifySecurityScreen);
                return;
            } else if (deletePassword) {
                this.deletePassword();
                return;
            } else if (deletePin) {
                this.deletePin();
                return;
            } else if (deleteDuressPassword) {
                this.deleteDuressPassword();
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
            // duress creds only trigger the wipe on a genuine login attempt -
            // in security management flows they count as an incorrect entry
            !this.isSecurityManagementFlow &&
            duressMatch
        ) {
            // never mark the session logged in here: the wipe takes long
            // enough that an unlocked app would expose the wallet UI (and
            // the configs being wiped) before the restart lands. Keeping
            // loggedIn false holds every auth gate shut for the duration,
            // and the wipe guard pins the user to the wiping screen.
            this.setState({ wiping: true });
            await this.deleteNodes();
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
                // see the duress branch: loggedIn must stay false so the
                // wallet UI stays gated while the wipe runs
                this.setState({ wiping: true });
                // wipe node configs, passwords, and pins
                await this.authenticationFailure();
            } else {
                await updateSettings({ authenticationAttempts }).then(() => {
                    this.setState({
                        error: true,
                        pinAttempt: '',
                        verifying: false
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

    deletePassword = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        // duress passphrase is also deleted when passphrase is deleted
        // biometry is also disabled when passphrase is deleted
        updateSettings({
            passphraseVerifier: undefined,
            duressPassphraseVerifier: undefined,
            authenticationAttempts: 0,
            isBiometryEnabled: false
        }).then(() => {
            navigation.popTo('Security');
        });
    };

    deleteDuressPassword = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({
            duressPassphraseVerifier: undefined,
            authenticationAttempts: 0
        }).then(() => {
            navigation.popTo('Security');
        });
    };

    deletePin = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        // duress pin is also deleted when pin is deleted
        // biometry is also disabled when pin is deleted
        updateSettings({
            pinVerifier: undefined,
            duressPinVerifier: undefined,
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
            duressPinVerifier: undefined,
            authenticationAttempts: 0
        }).then(() => {
            navigation.popTo('Security');
        });
    };

    deleteNodes = async () => {
        // Fully wipe wallet data (node data dirs, Cashu seeds + CDK db, swap
        // rescue key, keychain) so the duress action leaves no recoverable key
        // material behind - not just the settings `nodes` pointer. Restart
        // instead of writing settings: updateSettings() would merge into the
        // pre-wipe in-memory blob and re-persist it (pins, passphrases and
        // all), and a restart is also the only way to drop node credentials
        // still held in memory by the stores.
        this.releaseWipeGuard = blockNavigationDuringWipe(
            this.props.navigation
        );
        try {
            await clearAllData();
        } catch (e) {
            // never surface an error here: it would disclose the duress
            // mechanism and there is no meaningful recovery mid-wipe
            console.warn('[Lockscreen] wipe failed part-way', e);
        } finally {
            // the restart must run even after a partial wipe: the settings
            // blob is cleared early, so a restart still lands on a fresh
            // install state rather than stranding the user on a dead
            // lockscreen
            restartApp();
        }
    };

    authenticationFailure = async () => {
        // Fully wipe wallet data on repeated failed logins. clearAllData()
        // removes the node data dirs, Cashu seeds + CDK db, swap rescue key
        // and the settings blob itself (including pins and passphrases).
        // Restart instead of writing settings back - see deleteNodes above.
        this.releaseWipeGuard = blockNavigationDuringWipe(
            this.props.navigation
        );
        try {
            await clearAllData();
        } catch (e) {
            // see deleteNodes: log only, never surface, always restart
            console.warn('[Lockscreen] wipe failed part-way', e);
        } finally {
            restartApp();
        }
    };

    resetAuthenticationAttempts = () => {
        const { SettingsStore } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({ authenticationAttempts: 0 });
    };

    generateErrorMessage = (): string => {
        const { authMethod, authenticationAttempts } = this.state;
        let incorrect = '';

        if (authMethod === 'passphrase') {
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
            authMethod,
            passphraseAttempt,
            hidden,
            error,
            verifying,
            modifySecurityScreen,
            deletePin,
            deleteDuressPin,
            deletePassword,
            deleteDuressPassword,
            wiping
        } = this.state;

        // neutral cover while the wipe runs, for both the duress and the
        // failed-attempts paths: an indistinct loading state discloses
        // nothing about the wipe and leaves nothing interactive until the
        // restart lands
        if (wiping) {
            return (
                <Screen>
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <LoadingIndicator />
                    </View>
                </Screen>
            );
        }

        return (
            <Screen>
                {(this.isSecurityManagementFlow || pendingNavigation) && (
                    <Header leftComponent="Back" navigation={navigation} />
                )}
                {authMethod === 'passphrase' && (
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
                                {modifySecurityScreen === 'SetDuressPassword'
                                    ? localeString(
                                          'views.Lockscreen.enterExistingPassword'
                                      )
                                    : deleteDuressPassword
                                    ? localeString(
                                          'views.Lockscreen.enterLoginPassword'
                                      )
                                    : localeString(
                                          'views.Lockscreen.enterPassword'
                                      )}
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
                                title={localeString(
                                    deletePassword
                                        ? 'views.Settings.SetPassword.deletePassword'
                                        : deleteDuressPassword
                                        ? 'views.Settings.SetDuressPassword.deletePassword'
                                        : 'views.Lockscreen.login'
                                )}
                                onPress={() => this.onAttemptLogIn()}
                                containerStyle={{ width: 300 }}
                                adaptiveWidth
                                warning={deletePassword || deleteDuressPassword}
                            />
                        </View>
                    </View>
                )}
                {authMethod === 'pin' && (
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
                                    {modifySecurityScreen === 'SetDuressPin'
                                        ? localeString(
                                              'views.Lockscreen.existingPin'
                                          )
                                        : deleteDuressPin
                                        ? localeString(
                                              'views.Lockscreen.enterLoginPin'
                                          )
                                        : localeString('views.Lockscreen.pin')}
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
                                        shuffle={settings.scramblePin}
                                    />
                                </View>
                            </>
                        </View>
                    </View>
                )}
                {verifying && (
                    <View style={styles.verifyingOverlay}>
                        <LoadingIndicator />
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    verifyingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        // dim + swallow taps so a second submit can't land while scrypt runs
        backgroundColor: 'rgba(0, 0, 0, 0.4)'
    },
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
