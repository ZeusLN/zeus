import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from './../../components/Button';
import { ErrorMessage } from './../../components/SuccessErrorMessage';
import TextInput from './../../components/TextInput';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import SettingsStore from './../../stores/SettingsStore';

interface SetPINProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SetPINState {
    passphrase: string;
    passphraseConfirm: string;
    passphraseMismatchError: boolean;
    passphraseInvalidError: boolean;
}

@inject('SettingsStore')
@observer
export default class SetPIN extends React.Component<SetPINProps, SetPINState> {
    state = {
        passphrase: '',
        passphraseConfirm: '',
        passphraseMismatchError: false,
        passphraseInvalidError: false
    };

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    saveSettings = async () => {
        const { SettingsStore, navigation } = this.props;
        const { passphrase, passphraseConfirm } = this.state;
        const { getSettings, setSettings, setLoginStatus } = SettingsStore;

        if (passphrase !== passphraseConfirm) {
            this.setState({
                passphraseMismatchError: true
            });

            return;
        }

        const settings = await getSettings();

        if (passphrase === settings.duressPassphrase) {
            this.setState({
                passphraseInvalidError: true
            });

            return;
        }

        await setSettings(
            JSON.stringify(
                settings
                    ? {
                          nodes: settings.nodes,
                          theme: settings.theme,
                          selectedNode: settings.selectedNode,
                          fiat: settings.fiat,
                          locale: settings.locale,
                          privacy: settings.privacy,
                          duressPassphrase: settings.duressPassphrase,
                          passphrase
                      }
                    : { passphrase }
            )
        ).then(() => {
            setLoginStatus(false);
            getSettings();
            navigation.navigate('Settings', {
                refresh: true
            });
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            passphrase,
            passphraseConfirm,
            passphraseMismatchError,
            passphraseInvalidError
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
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.SetPassword.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
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
                    <Text style={{ ...styles.text, color: themeColor('text') }}>
                        {localeString('views.Settings.newPassword')}
                    </Text>
                    <TextInput
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={passphrase}
                        onChangeText={(text: string) =>
                            this.setState({
                                passphrase: text,
                                passphraseMismatchError: false,
                                passphraseInvalidError: false
                            })
                        }
                        numberOfLines={1}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            paddingLeft: 10
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
                                passphraseInvalidError: false
                            })
                        }
                        numberOfLines={1}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            paddingLeft: 10
                        }}
                    />
                    <View style={{ paddingTop: 10, margin: 10 }}>
                        <Button
                            title={localeString(
                                'views.Settings.SetPassword.save'
                            )}
                            icon={{
                                name: 'save',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => this.saveSettings()}
                        />
                    </View>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    }
});
