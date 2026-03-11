import * as React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import { confirmAction } from '../../utils/ActionUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import SettingsStore from '../../stores/SettingsStore';
import ModalStore from '../../stores/ModalStore';

interface SetPassphraseProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    ModalStore: ModalStore;
    route: { params?: { forBiometrics?: boolean } };
}

interface SetPassphraseState {
    passphrase: string;
    passphraseConfirm: string;
    savedPassphrase: string;
    passphraseMismatchError: boolean;
    passphraseInvalidError: boolean;
    passphraseEmptyError: boolean;
    isBiometryEnabled: boolean;
}

@inject('SettingsStore', 'ModalStore')
@observer
export default class SetPassphrase extends React.Component<
    SetPassphraseProps,
    SetPassphraseState
> {
    state = {
        passphrase: '',
        passphraseConfirm: '',
        savedPassphrase: '',
        passphraseMismatchError: false,
        passphraseInvalidError: false,
        passphraseEmptyError: false,
        isBiometryEnabled: false
    };

    private firstInput = React.createRef<any>();
    private secondInput = React.createRef<any>();

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const settings = await SettingsStore.getSettings();

        this.setState({
            isBiometryEnabled: settings.isBiometryEnabled
        });
        if (settings.passphrase) {
            this.setState({ savedPassphrase: settings.passphrase });
        }

        this.firstInput.current?.focus();
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    saveSettings = async () => {
        const { SettingsStore, navigation, route } = this.props;
        const { passphrase, passphraseConfirm } = this.state;
        const { getSettings, updateSettings, setLoginStatus } = SettingsStore;

        if (passphrase !== passphraseConfirm) {
            this.setState({
                passphraseMismatchError: true
            });

            return;
        }

        const settings = await getSettings();

        if (passphrase !== '' && passphrase === settings.duressPassphrase) {
            this.setState({
                passphraseInvalidError: true
            });

            return;
        }

        if (passphrase === '') {
            this.setState({
                passphraseEmptyError: true
            });
            return;
        }

        await updateSettings({ passphrase }).then(() => {
            setLoginStatus(true);
            getSettings();
            navigation.popTo('Security', {
                enableBiometrics: route.params?.forBiometrics
            });
        });
    };

    deletePassword = async () => {
        // deletes passphrase and duress passphrase because duress
        // passphrase should not exist if passphrase does not exist
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        await updateSettings({
            duressPassphrase: '',
            passphrase: '',
            isBiometryEnabled: false
        });
        navigation.popTo('Security');
    };

    render() {
        const { navigation } = this.props;
        const {
            passphrase,
            passphraseConfirm,
            savedPassphrase,
            passphraseMismatchError,
            passphraseInvalidError,
            passphraseEmptyError
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            savedPassphrase
                                ? 'views.Settings.ChangePassword.title'
                                : 'views.Settings.SetPassword.title'
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
                        paddingLeft: 15,
                        paddingRight: 15,
                        paddingTop: 10
                    }}
                >
                    {passphraseMismatchError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Settings.SetPassword.noMatch'
                            )}
                        />
                    )}
                    {passphraseInvalidError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Settings.SetPassword.invalid'
                            )}
                        />
                    )}
                    {passphraseEmptyError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Settings.SetPassword.empty'
                            )}
                        />
                    )}
                    <Text style={{ ...styles.text, color: themeColor('text') }}>
                        {localeString('views.Settings.newPassword')}
                    </Text>
                    <TextInput
                        ref={this.firstInput}
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={passphrase}
                        onChangeText={(text: string) =>
                            this.setState({
                                passphrase: text,
                                passphraseMismatchError: false,
                                passphraseInvalidError: false,
                                passphraseEmptyError: false
                            })
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            paddingLeft: 10,
                            paddingTop:
                                this.state.passphrase === ''
                                    ? Platform.OS === 'android'
                                        ? 6
                                        : 8
                                    : 2
                        }}
                        onSubmitEditing={() => {
                            this.secondInput.current.focus();
                        }}
                    />
                    <Text style={{ ...styles.text, color: themeColor('text') }}>
                        {localeString('views.Settings.confirmPassword')}
                    </Text>
                    <TextInput
                        ref={this.secondInput}
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={passphraseConfirm}
                        onChangeText={(text: string) =>
                            this.setState({
                                passphraseConfirm: text,
                                passphraseMismatchError: false,
                                passphraseInvalidError: false,
                                passphraseEmptyError: false
                            })
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            paddingLeft: 10,
                            paddingTop:
                                this.state.passphraseConfirm === ''
                                    ? Platform.OS === 'android'
                                        ? 6
                                        : 8
                                    : 0
                        }}
                        onSubmitEditing={() => {
                            this.saveSettings();
                        }}
                    />
                    <View style={{ paddingTop: 10, margin: 10 }}>
                        <Button
                            title={localeString(
                                'views.Settings.SetPassword.save'
                            )}
                            onPress={() => this.saveSettings()}
                        />
                    </View>
                    {!!savedPassphrase && (
                        <View style={{ paddingTop: 10, margin: 10 }}>
                            <Button
                                title={localeString(
                                    'views.Settings.SetPassword.deletePassword'
                                )}
                                onPress={() => {
                                    confirmAction(
                                        localeString(
                                            'views.Settings.SetPassword.deletePassword'
                                        ),
                                        localeString(
                                            'views.Settings.SetPassword.deletePassword.confirm'
                                        ),
                                        {
                                            text: localeString(
                                                'views.Settings.SetPassword.deletePassword'
                                            ),
                                            style: 'destructive',
                                            onPress: () => {
                                                if (
                                                    this.state.isBiometryEnabled
                                                ) {
                                                    this.props.ModalStore.toggleInfoModal(
                                                        {
                                                            text: localeString(
                                                                'views.Settings.Security.biometricsWillBeDisabled'
                                                            ),
                                                            buttons: [
                                                                {
                                                                    title: localeString(
                                                                        'general.ok'
                                                                    ),
                                                                    callback:
                                                                        () =>
                                                                            this.deletePassword()
                                                                }
                                                            ]
                                                        }
                                                    );
                                                } else {
                                                    this.deletePassword();
                                                }
                                            }
                                        },
                                        {
                                            text: localeString(
                                                'general.cancel'
                                            ),
                                            onPress: () => void 0,
                                            isPreferred: true
                                        }
                                    );
                                }}
                                warning
                            />
                        </View>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});
