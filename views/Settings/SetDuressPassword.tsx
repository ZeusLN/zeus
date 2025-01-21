import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

interface SetDuressPassphraseProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface SetDuressPassphraseState {
    duressPassphrase: string;
    duressPassphraseConfirm: string;
    savedDuressPassphrase: string;
    duressPassphraseMismatchError: boolean;
    duressPassphraseInvalidError: boolean;
    duressPassphraseEmptyError: boolean;
    confirmDelete: boolean;
}

@inject('SettingsStore')
@observer
export default class SetDuressPassphrase extends React.Component<
    SetDuressPassphraseProps,
    SetDuressPassphraseState
> {
    state = {
        duressPassphrase: '',
        duressPassphraseConfirm: '',
        savedDuressPassphrase: '',
        duressPassphraseMismatchError: false,
        duressPassphraseInvalidError: false,
        duressPassphraseEmptyError: false,
        confirmDelete: false
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        if (settings.duressPassphrase) {
            this.setState({ savedDuressPassphrase: settings.duressPassphrase });
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

    saveSettings = async () => {
        const { SettingsStore, navigation } = this.props;
        const { duressPassphrase, duressPassphraseConfirm } = this.state;
        const { getSettings, updateSettings } = SettingsStore;

        if (duressPassphrase !== duressPassphraseConfirm) {
            this.setState({
                duressPassphraseMismatchError: true
            });

            return;
        }

        const settings = await getSettings();

        if (
            duressPassphrase !== '' &&
            duressPassphrase === settings.passphrase
        ) {
            this.setState({
                duressPassphraseInvalidError: true
            });

            return;
        }

        if (duressPassphrase === '') {
            this.setState({
                duressPassphraseEmptyError: true
            });
            return;
        }

        await updateSettings({ duressPassphrase }).then(() => {
            getSettings();
            navigation.popTo('Settings');
        });
    };

    deleteDuressPassword = async () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings } = SettingsStore;

        await updateSettings({ duressPassphrase: '' }).then(() => {
            navigation.popTo('Settings');
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            duressPassphrase,
            duressPassphraseConfirm,
            savedDuressPassphrase,
            duressPassphraseMismatchError,
            duressPassphraseInvalidError,
            duressPassphraseEmptyError
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.SetDuressPassword.title'
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
                    {duressPassphraseMismatchError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Settings.SetPassword.noMatch'
                            )}
                        />
                    )}
                    {duressPassphraseInvalidError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Settings.SetPassword.invalid'
                            )}
                        />
                    )}
                    {duressPassphraseEmptyError && (
                        <ErrorMessage
                            message={localeString(
                                'views.Settings.SetPassword.empty'
                            )}
                        />
                    )}
                    <Text style={{ ...styles.text, color: themeColor('text') }}>
                        {localeString('views.Settings.newDuressPassword')}
                    </Text>
                    <TextInput
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={duressPassphrase}
                        onChangeText={(text: string) =>
                            this.setState({
                                duressPassphrase: text,
                                duressPassphraseMismatchError: false,
                                duressPassphraseInvalidError: false,
                                duressPassphraseEmptyError: false
                            })
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            paddingLeft: 10,
                            paddingTop:
                                this.state.duressPassphrase === ''
                                    ? Platform.OS === 'android'
                                        ? 6
                                        : 8
                                    : 2
                        }}
                    />
                    <Text style={{ ...styles.text, color: themeColor('text') }}>
                        {localeString('views.Settings.confirmDuressPassword')}
                    </Text>
                    <TextInput
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={duressPassphraseConfirm}
                        onChangeText={(text: string) =>
                            this.setState({
                                duressPassphraseConfirm: text,
                                duressPassphraseMismatchError: false,
                                duressPassphraseInvalidError: false,
                                duressPassphraseEmptyError: false
                            })
                        }
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            paddingLeft: 10,
                            paddingTop:
                                this.state.duressPassphraseConfirm === ''
                                    ? Platform.OS === 'android'
                                        ? 6
                                        : 8
                                    : 0
                        }}
                    />
                    <Text
                        style={{
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString(
                            'views.Settings.SetDuressPassword.duressPasswordExplanation'
                        )}
                    </Text>
                    <View style={{ paddingTop: 10, margin: 10 }}>
                        <Button
                            title={localeString(
                                'views.Settings.SetPassword.save'
                            )}
                            onPress={() => this.saveSettings()}
                        />
                    </View>
                    {!!savedDuressPassphrase && (
                        <View style={{ paddingTop: 10, margin: 10 }}>
                            <Button
                                title={
                                    this.state.confirmDelete
                                        ? localeString(
                                              'views.Settings.AddEditNode.tapToConfirm'
                                          )
                                        : localeString(
                                              'views.Settings.SetDuressPassword.deletePassword'
                                          )
                                }
                                onPress={() => {
                                    if (!this.state.confirmDelete) {
                                        this.setState({
                                            confirmDelete: true
                                        });
                                    } else {
                                        this.deleteDuressPassword();
                                    }
                                }}
                                titleStyle={{
                                    color: themeColor('delete')
                                }}
                                secondary
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
