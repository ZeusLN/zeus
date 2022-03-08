import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from './../components/Button';
import { ErrorMessage } from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';

import LinkingUtils from './../utils/LinkingUtils';
import { localeString } from './../utils/LocaleUtils';

import SettingsStore from './../stores/SettingsStore';
import Pin from './../components/Pin';
import { themeColor } from './../utils/ThemeUtils';
import { Header, Icon } from 'react-native-elements';

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
}

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
            modifySecurityScreen: ''
        };
    }

    UNSAFE_componentWillMount() {
        const { SettingsStore, navigation } = this.props;
        const { getSettings } = SettingsStore;

        const modifySecurityScreen: string = navigation.getParam(
            'modifySecurityScreen'
        );
        if (modifySecurityScreen) {
            this.setState({
                modifySecurityScreen
            });
        }

        getSettings().then((settings: any) => {
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
            } else if (
                settings &&
                settings.nodes &&
                settings.nodes.length > 0
            ) {
                navigation.navigate('Wallet');
            } else {
                navigation.navigate('IntroSplash');
            }
        });
    }

    onInputLabelPressed = () => {
        this.setState({ hidden: !this.state.hidden });
    };

    onAttemptLogIn = () => {
        const { SettingsStore, navigation } = this.props;
        const {
            passphrase,
            duressPassphrase,
            passphraseAttempt,
            pin,
            pinAttempt,
            duressPin,
            modifySecurityScreen
        } = this.state;

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
                navigation.navigate(modifySecurityScreen);
            } else {
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
            this.setState({
                error: true,
                pinAttempt: ''
            });
        }
    };

    onSubmitPin = (value: string) => {
        this.setState({ pinAttempt: value }, () => {
            this.onAttemptLogIn();
        });
    };

    deleteNodes = () => {
        const { SettingsStore, navigation } = this.props;
        const { setSettings, settings } = SettingsStore;

        setSettings(
            JSON.stringify({
                nodes: undefined,
                selectedNode: undefined,
                theme: settings.theme,
                passphrase: settings.passphrase,
                duressPassphrase: settings.duressPassphrase,
                pin: settings.pin,
                duressPin: settings.duressPin,
                fiat: settings.fiat,
                locale: settings.locale,
                privacy: settings.privacy
            })
        ).then(() => {
            navigation.navigate('Wallet');
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            passphrase,
            passphraseAttempt,
            pin,
            pinAttempt,
            hidden,
            error,
            modifySecurityScreen
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
            <View style={styles.container}>
                {!!modifySecurityScreen && (
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
                                    message={localeString(
                                        'views.Lockscreen.incorrect'
                                    )}
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
                                {!!modifySecurityScreen && (
                                    <View
                                        style={{
                                            flex: 2,
                                            marginTop: 50,
                                            marginBottom: 25
                                        }}
                                    >
                                        {error && (
                                            <ErrorMessage
                                                message={localeString(
                                                    'views.Lockscreen.incorrectPin'
                                                )}
                                            />
                                        )}
                                    </View>
                                )}
                                {!modifySecurityScreen && (
                                    <View
                                        style={{
                                            flex: 2,
                                            marginTop: 125,
                                            marginBottom: 25
                                        }}
                                    >
                                        {error && (
                                            <ErrorMessage
                                                message={localeString(
                                                    'views.Lockscreen.incorrectPin'
                                                )}
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
                                        pinCreate={false}
                                        pinLength={pin.length}
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
        flex: 1,
        backgroundColor: '#1f2328'
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
