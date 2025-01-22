import * as React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import SettingsStore from '../../stores/SettingsStore';
import ModalStore from '../../stores/ModalStore';

interface SetPassphraseProps {
    navigation: StackNavigationProp<any, any>;
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
    confirmDelete: boolean;
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
        confirmDelete: false,
        isBiometryEnabled: false
    };

    private firstInput = React.createRef<any>();

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
        navigation.popTo('Security', { refresh: true });
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
                        text: localeString('views.Settings.SetPassword.title'),
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
                    />
                    <Text style={{ ...styles.text, color: themeColor('text') }}>
                        {localeString('views.Settings.confirmPassword')}
                    </Text>
                    <TextInput
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
                                title={
                                    this.state.confirmDelete
                                        ? localeString(
                                              'views.Settings.AddEditNode.tapToConfirm'
                                          )
                                        : localeString(
                                              'views.Settings.SetPassword.deletePassword'
                                          )
                                }
                                onPress={() => {
                                    if (!this.state.confirmDelete) {
                                        this.setState({
                                            confirmDelete: true
                                        });
                                    } else if (this.state.isBiometryEnabled) {
                                        this.props.ModalStore.toggleInfoModal(
                                            localeString(
                                                'views.Settings.Security.biometricsWillBeDisabled'
                                            ),
                                            undefined,
                                            [
                                                {
                                                    title: localeString(
                                                        'general.ok'
                                                    ),
                                                    callback: () =>
                                                        this.deletePassword()
                                                }
                                            ]
                                        );
                                    } else {
                                        this.deletePassword();
                                    }
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
