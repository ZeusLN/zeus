import * as React from 'react';
import { StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Nodes from './Settings/Nodes';
import PrivacyUtils from './../utils/PrivacyUtils';
import DropdownSetting from './../components/DropdownSetting';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import SettingsStore, {
    LOCALE_KEYS,
    DEFAULT_THEME,
    DEFAULT_FIAT,
    DEFAULT_LOCALE
} from './../stores/SettingsStore';
import UnitsStore from './../stores/UnitsStore';

interface SettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface SettingsState {
    nodes: any[];
    theme: string;
    lurkerMode: boolean;
    saved: boolean;
    loading: boolean;
    passphrase: string;
    passphraseConfirm: string;
    passphraseError: boolean;
    showPassphraseForm: boolean;
    fiat: string;
    locale: string;
}

@inject('SettingsStore', 'UnitsStore')
@observer
export default class Settings extends React.Component<
    SettingsProps,
    SettingsState
> {
    isComponentMounted: boolean = false;

    state = {
        nodes: [],
        theme: DEFAULT_THEME,
        lurkerMode: false,
        saved: false,
        loading: false,
        passphrase: '',
        passphraseConfirm: '',
        passphraseError: false,
        showPassphraseForm: false,
        fiat: DEFAULT_FIAT,
        locale: DEFAULT_LOCALE
    };

    componentDidMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        this.refreshSettings();

        this.isComponentMounted = true;

        if (settings) {
            this.setState({
                nodes: settings.nodes || [],
                theme: settings.theme || DEFAULT_THEME,
                lurkerMode: settings.lurkerMode || false,
                passphrase: settings.passphrase || '',
                passphraseConfirm: settings.passphrase || '',
                fiat: settings.fiat || DEFAULT_FIAT,
                locale: settings.locale || DEFAULT_LOCALE
            });
        }
    }

    UNSAFE_componentWillReceiveProps = (newProps: any) => {
        const { SettingsStore } = newProps;
        const { settings } = SettingsStore;
        this.refreshSettings();

        if (settings) {
            this.setState({
                nodes: settings.nodes || [],
                theme: settings.theme || 'dark',
                lurkerMode: settings.lurkerMode || false,
                passphrase: settings.passphrase || '',
                passphraseConfirm: settings.passphrase || '',
                fiat: settings.fiat || DEFAULT_FIAT,
                locale: settings.locale || DEFAULT_LOCALE
            });
        }
    };

    componentWillUnmount() {
        this.isComponentMounted = false;
    }

    async refreshSettings() {
        this.setState({
            loading: true
        });
        await this.props.SettingsStore.getSettings().then(() => {
            this.setState({
                loading: false
            });
        });
    }

    saveSettings = () => {
        const { SettingsStore, UnitsStore } = this.props;
        const {
            nodes,
            theme,
            lurkerMode,
            passphrase,
            passphraseConfirm,
            fiat,
            locale
        } = this.state;
        const { setSettings, settings } = SettingsStore;

        if (passphrase !== passphraseConfirm) {
            this.setState({
                passphraseError: true
            });

            return;
        }

        UnitsStore.resetUnits();

        setSettings(
            JSON.stringify({
                nodes,
                theme,
                lurkerMode,
                passphrase,
                fiat,
                locale,
                onChainAddress: settings.onChainAddress
            })
        );

        this.setState({
            saved: true
        });

        this.refreshSettings();

        setTimeout(() => {
            if (this.isComponentMounted) {
                this.setState({
                    saved: false
                });
            }
        }, 5000);
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            saved,
            theme,
            lurkerMode,
            nodes,
            passphrase,
            passphraseConfirm,
            passphraseError,
            showPassphraseForm,
            fiat,
            locale
        } = this.state;
        const { loading, settings } = SettingsStore;
        const selectedNode = settings.selectedNode;

        const themes: any = {
            dark: 'Dark Theme',
            light: 'Light Theme'
        };

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet', { refresh: true })}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const lurkerLabel = `Lurking ${PrivacyUtils.getLover()} Mode: hides sensitive values`;

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.title'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('secondary')}
                />
                {passphraseError && (
                    <Text
                        style={{
                            color: 'red',
                            textAlign: 'center',
                            padding: 20
                        }}
                    >
                        Passphrases do not match
                    </Text>
                )}
                <View style={styles.form}>
                    <Nodes
                        nodes={nodes}
                        navigation={navigation}
                        loading={loading}
                        selectedNode={selectedNode}
                        SettingsStore={SettingsStore}
                    />
                </View>

                <DropdownSetting
                    title={localeString('views.Settings.locale')}
                    selectedValue={locale}
                    onValueChange={(value: string) =>
                        this.setState({ locale: value })
                    }
                    values={LOCALE_KEYS}
                />

                <DropdownSetting
                    title={localeString('views.Settings.fiatRate')}
                    selectedValue={fiat}
                    onValueChange={(value: string) =>
                        this.setState({ fiat: value })
                    }
                    values={[
                        { key: 'Disabled', value: 'Disabled' },
                        { key: 'USD', value: 'USD' },
                        { key: 'JPY', value: 'JPY' },
                        { key: 'CNY', value: 'CNY' },
                        { key: 'SGD', value: 'SGD' },
                        { key: 'HKD', value: 'HKD' },
                        { key: 'CAD', value: 'CAD' },
                        { key: 'NZD', value: 'NZD' },
                        { key: 'AUD', value: 'AUD' },
                        { key: 'CLP', value: 'CLP' },
                        { key: 'GBP', value: 'GBP' },
                        { key: 'DKK', value: 'DKK' },
                        { key: 'SEK', value: 'SEK' },
                        { key: 'ISK', value: 'ISK' },
                        { key: 'CHF', value: 'CHF' },
                        { key: 'BRL', value: 'BRL' },
                        { key: 'EUR', value: 'EUR' },
                        { key: 'RUB', value: 'RUB' },
                        { key: 'PLN', value: 'PLN' },
                        { key: 'THB', value: 'THB' },
                        { key: 'KRW', value: 'KRW' },
                        { key: 'TWD', value: 'TWD' }
                    ]}
                />

                <DropdownSetting
                    title={localeString('views.Settings.theme')}
                    selectedValue={theme}
                    displayValue={themes[theme]}
                    onValueChange={(value: string) =>
                        this.setState({ theme: value })
                    }
                    values={[
                        { key: 'Dark', value: 'dark' },
                        { key: 'Light', value: 'light' },
                        { key: 'Junkie', value: 'junkie' }
                    ]}
                />

                <DropdownSetting
                    title={lurkerLabel}
                    selectedValue={lurkerMode}
                    displayValue={
                        lurkerMode
                            ? localeString('views.Settings.enabled')
                            : localeString('views.Settings.disabled')
                    }
                    onValueChange={(value: boolean) =>
                        this.setState({ lurkerMode: value })
                    }
                    values={[
                        { key: 'Disabled', value: false },
                        { key: 'Enabled', value: true }
                    ]}
                />

                {showPassphraseForm && (
                    <Text
                        style={{
                            color: themeColor('text'),
                            paddingLeft: 10,
                            paddingTop: 10
                        }}
                    >
                        {localeString('views.Settings.newPassphrase')}
                    </Text>
                )}
                {showPassphraseForm && (
                    <TextInput
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={passphrase}
                        onChangeText={(text: string) =>
                            this.setState({
                                passphrase: text,
                                passphraseError: false
                            })
                        }
                        numberOfLines={1}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            fontSize: 20,
                            color: themeColor('text'),
                            paddingLeft: 10
                        }}
                    />
                )}
                {showPassphraseForm && (
                    <Text
                        style={{
                            color: themeColor('text'),
                            paddingLeft: 10
                        }}
                    >
                        {localeString('views.Settings.confirmPassphrase')}
                    </Text>
                )}
                {showPassphraseForm && (
                    <TextInput
                        placeholder={'********'}
                        placeholderTextColor="darkgray"
                        value={passphraseConfirm}
                        onChangeText={(text: string) =>
                            this.setState({
                                passphraseConfirm: text,
                                passphraseError: false
                            })
                        }
                        numberOfLines={1}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={true}
                        style={{
                            fontSize: 20,
                            color: themeColor('text'),
                            paddingLeft: 10
                        }}
                    />
                )}
                <View style={styles.button}>
                    <Button
                        title={
                            saved
                                ? localeString('views.Settings.settingsSaved')
                                : localeString('views.Settings.saveSettings')
                        }
                        icon={{
                            name: 'save',
                            size: 25,
                            color: saved ? 'black' : 'white'
                        }}
                        buttonStyle={{
                            backgroundColor: saved ? '#fff' : '#261339',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        titleStyle={{
                            color: saved ? 'black' : 'white'
                        }}
                        onPress={() => this.saveSettings()}
                        style={styles.button}
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title={
                            showPassphraseForm
                                ? localeString(
                                      'views.Settings.hidePassphraseForm'
                                  )
                                : localeString(
                                      'views.Settings.showPassphraseForm'
                                  )
                        }
                        icon={{
                            name: 'perm-identity',
                            size: 25,
                            color: 'white'
                        }}
                        onPress={() =>
                            this.setState({
                                showPassphraseForm: !showPassphraseForm
                            })
                        }
                        style={styles.button}
                        buttonStyle={{
                            backgroundColor: 'darkgray',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        titleStyle={{
                            color: 'white'
                        }}
                    />
                </View>
                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.about')}
                        buttonStyle={{
                            backgroundColor: 'black',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        onPress={() => navigation.navigate('About')}
                        style={styles.button}
                    />
                </View>

                <View style={styles.button}>
                    <Button
                        title={localeString(
                            'views.Settings.signMessage.button'
                        )}
                        buttonStyle={{
                            backgroundColor: 'green',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        onPress={() => navigation.navigate('SignMessage')}
                        style={styles.button}
                    />
                </View>

                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.intro')}
                        buttonStyle={{
                            backgroundColor: 'orange',
                            borderRadius: 30,
                            width: 350,
                            alignSelf: 'center'
                        }}
                        onPress={() =>
                            navigation.navigate('Onboarding', { reset: true })
                        }
                        style={styles.button}
                    />
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    error: {
        color: 'red'
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        height: 50,
        width: 100
    },
    pickerDark: {
        height: 50,
        width: 100,
        color: 'white'
    },
    button: {
        paddingTop: 10
    },
    lurkerField: {
        paddingTop: 15,
        paddingLeft: 10
    }
});
