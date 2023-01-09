import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Header, Icon } from 'react-native-elements';

import Button from './../components/Button';
import Pin from './../components/Pin';
import { ErrorMessage } from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';

import SettingsStore from './../stores/SettingsStore';

import LinkingUtils from './../utils/LinkingUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

interface LockscreenProps {
    navigation: any;
    SettingsStore: SettingsStore;
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

    UNSAFE_componentWillMount() {
        const { SettingsStore, navigation } = this.props;
        const { settings } = SettingsStore;
        const modifySecurityScreen: string = navigation.getParam(
            'modifySecurityScreen'
        );
        const deletePin: boolean = navigation.getParam('deletePin');
        const deleteDuressPin: boolean = navigation.getParam('deleteDuressPin');

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
        } else if (settings && settings.nodes && settings.nodes.length > 0) {
            navigation.navigate('Wallet');
        } else {
            navigation.navigate('IntroSplash');
        }
    }

    onInputLabelPressed = () => {
        this.setState({ hidden: !this.state.hidden });
    };

    onAttemptLogIn = async () => {
        const { SettingsStore, navigation } = this.props;
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
        const { updateSettings, getSettings } = SettingsStore;

        this.setState({
            error: false
        });

        if (
            (passphraseAttempt && passphraseAttempt === passphrase) ||
            (pinAttempt && pinAttempt === pin)
        ) {
            SettingsStore.setLoginStatus(true);
            LinkingUtils.handleInitialUrl(navigation);
            if (modifySecurityScreen) {
                this.resetAuthenticationAttempts();
                navigation.navigate(modifySecurityScreen);
            } else if (deletePin) {
                this.deletePin();
            } else if (deleteDuressPin) {
                this.deleteDuressPin();
            } else {
                this.resetAuthenticationAttempts();
                navigation.navigate('Wallet');
            }
        } else if (
            (duressPassphrase && passphraseAttempt === duressPassphrase) ||
            (duressPin && pinAttempt === duressPin)
        ) {
            SettingsStore.setLoginStatus(true);
            LinkingUtils.handleInitialUrl(navigation);
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
                LinkingUtils.handleInitialUrl(navigation);
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
        updateSettings({
            pin: '',
            duressPin: '',
            authenticationAttempts: 0
        }).then(() => {
            navigation.navigate('Settings');
        });
    };

    deleteDuressPin = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({
            duressPin: '',
            authenticationAttempts: 0
        }).then(() => {
            navigation.navigate('Settings');
        });
    };

    deleteNodes = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        updateSettings({
            nodes: undefined,
            selectedNode: undefined,
            authenticationAttempts: 0
        }).then(() => {
            navigation.navigate('Wallet');
        });
    };

    authenticationFailure = () => {
        const { SettingsStore, navigation } = this.props;
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
            navigation.navigate('Wallet');
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
            incorrect = localeString('views.Lockscreen.incorrect');
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

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    ...styles.container,
                    backgroundColor: themeColor('background')
                }}
            >
                {(!!modifySecurityScreen || deletePin || deleteDuressPin) && (
                    <Header
                        leftComponent={<BackButton />}
                        backgroundColor={themeColor('background')}
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
                )}
                {!!passphrase && (
                    <ScrollView style={styles.container}>
                        <View style={styles.content}>
                            {error && (
                                <ErrorMessage
                                    message={this.generateErrorMessage()}
                                />
                            )}
                            <Text
                                style={{
                                    color: '#A7A9AC',
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString('views.Lockscreen.passphrase')}
                            </Text>
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
                                numberOfLines={1}
                                autoCapitalize="none"
                                autoCorrect={false}
                                secureTextEntry={hidden}
                                autoFocus={true}
                                style={styles.textInput}
                            />
                            <View style={styles.button}>
                                <Button
                                    title={
                                        hidden
                                            ? localeString('general.show')
                                            : localeString('general.hide')
                                    }
                                    onPress={() => this.onInputLabelPressed()}
                                    containerStyle={{ width: 300 }}
                                    adaptiveWidth
                                    secondary
                                />
                            </View>
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Lockscreen.login'
                                    )}
                                    onPress={() => this.onAttemptLogIn()}
                                    containerStyle={{ width: 300 }}
                                    adaptiveWidth
                                />
                            </View>
                        </View>
                    </ScrollView>
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
            </View>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        marginTop: 100,
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
    textInput: {
        textAlign: 'center'
    },
    mainText: {
        fontFamily: 'Lato-Regular',
        fontSize: 20,
        textAlign: 'center'
    }
});
