import * as React from 'react';
import {
    ActionSheetIOS,
    Picker,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity
} from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Nodes from './Settings/Nodes';

import SettingsStore from './../stores/SettingsStore';
import UnitsStore from './../stores/UnitsStore';

interface SettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface SettingsState {
    nodes: any[];
    theme: string;
    saved: boolean;
    loading: boolean;
    passphrase: string;
    passphraseConfirm: string;
    passphraseError: boolean;
    showPassphraseForm: boolean;
    fiat: string;
}

const themes: any = {
    light: 'Light Theme',
    dark: 'Dark Theme'
};

@inject('SettingsStore', 'UnitsStore')
@observer
export default class Settings extends React.Component<
    SettingsProps,
    SettingsState
> {
    isComponentMounted: boolean = false;

    state = {
        nodes: [],
        theme: 'light',
        saved: false,
        loading: false,
        passphrase: '',
        passphraseConfirm: '',
        passphraseError: false,
        showPassphraseForm: false,
        fiat: 'Disabled'
    };

    componentDidMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        this.refreshSettings();

        this.isComponentMounted = true;

        if (settings) {
            this.setState({
                nodes: settings.nodes || [],
                theme: settings.theme || '',
                passphrase: settings.passphrase || '',
                passphraseConfirm: settings.passphrase || '',
                fiat: settings.fiat || 'Disabled'
            });
        }
    }

    componentWillReceiveProps = (newProps: any) => {
        const { SettingsStore } = newProps;
        const { settings } = SettingsStore;
        this.refreshSettings();

        if (settings) {
            this.setState({
                nodes: settings.nodes || [],
                theme: settings.theme || '',
                passphrase: settings.passphrase || '',
                passphraseConfirm: settings.passphrase || '',
                fiat: settings.fiat || 'Disabled'
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
            passphrase,
            passphraseConfirm,
            fiat
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
                passphrase,
                fiat,
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
            nodes,
            passphrase,
            passphraseConfirm,
            passphraseError,
            showPassphraseForm,
            fiat
        } = this.state;
        const { loading, settings } = SettingsStore;
        const savedTheme = settings.theme;
        const selectedNode = settings.selectedNode;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet', { refresh: true })}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={
                    savedTheme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Settings',
                        style: { color: '#fff' }
                    }}
                    backgroundColor={
                        savedTheme === 'dark'
                            ? '#261339'
                            : 'rgba(92, 99,216, 1)'
                    }
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
                        theme={theme}
                        loading={loading}
                        selectedNode={selectedNode}
                    />
                </View>

                {Platform.OS !== 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: savedTheme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Theme
                        </Text>
                        <Picker
                            selectedValue={theme}
                            onValueChange={(itemValue: string) =>
                                this.setState({ theme: itemValue })
                            }
                            style={
                                savedTheme === 'dark'
                                    ? styles.pickerDark
                                    : styles.picker
                            }
                        >
                            <Picker.Item label="Light" value="light" />
                            <Picker.Item label="Dark" value="dark" />
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: savedTheme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Theme
                        </Text>
                        <TouchableOpacity
                            onPress={() =>
                                ActionSheetIOS.showActionSheetWithOptions(
                                    {
                                        options: [
                                            'Cancel',
                                            'Light Theme',
                                            'Dark Theme'
                                        ],
                                        cancelButtonIndex: 0
                                    },
                                    buttonIndex => {
                                        if (buttonIndex === 1) {
                                            this.setState({ theme: 'light' });
                                        } else if (buttonIndex === 2) {
                                            this.setState({ theme: 'dark' });
                                        }
                                    }
                                )
                            }
                        >
                            <Text
                                style={{
                                    color:
                                        savedTheme === 'dark'
                                            ? 'white'
                                            : 'black'
                                }}
                            >
                                {themes[theme]}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {Platform.OS !== 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: savedTheme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Fiat Currency Rate
                        </Text>
                        <Picker
                            selectedValue={fiat}
                            onValueChange={(itemValue: string) =>
                                this.setState({ fiat: itemValue })
                            }
                            style={
                                savedTheme === 'dark'
                                    ? styles.pickerDark
                                    : styles.picker
                            }
                        >
                            <Picker.Item label="Disabled" value="Disabled" />
                            <Picker.Item label="USD" value="USD" />
                            <Picker.Item label="JPY" value="JPY" />
                            <Picker.Item label="CNY" value="CNY" />
                            <Picker.Item label="SGD" value="SGD" />
                            <Picker.Item label="HKD" value="HKD" />
                            <Picker.Item label="CAD" value="CAD" />
                            <Picker.Item label="NZD" value="NZD" />
                            <Picker.Item label="AUD" value="AUD" />
                            <Picker.Item label="CLP" value="CLP" />
                            <Picker.Item label="GBP" value="GBP" />
                            <Picker.Item label="DKK" value="DKK" />
                            <Picker.Item label="SEK" value="SEK" />
                            <Picker.Item label="ISK" value="ISK" />
                            <Picker.Item label="CHF" value="CHF" />
                            <Picker.Item label="BRL" value="BRL" />
                            <Picker.Item label="EUR" value="EUR" />
                            <Picker.Item label="RUB" value="RUB" />
                            <Picker.Item label="PLN" value="PLN" />
                            <Picker.Item label="THB" value="THB" />
                            <Picker.Item label="KRW" value="KRW" />
                            <Picker.Item label="TWD" value="TWD" />
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: savedTheme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Fiat Currency Rate
                        </Text>
                        <TouchableOpacity
                            onPress={() =>
                                ActionSheetIOS.showActionSheetWithOptions(
                                    {
                                        options: [
                                            'Cancel',
                                            'Disabled',
                                            'USD',
                                            'JPY',
                                            'CNY',
                                            'SGD',
                                            'HKD',
                                            'CAD',
                                            'NZD',
                                            'AUD',
                                            'CLP',
                                            'GBP',
                                            'DKK',
                                            'SEK',
                                            'ISK',
                                            'CHF',
                                            'BRL',
                                            'EUR',
                                            'RUB',
                                            'PLN',
                                            'THB',
                                            'KRW',
                                            'TWD'
                                        ],
                                        cancelButtonIndex: 0
                                    },
                                    buttonIndex => {
                                        if (buttonIndex === 1) {
                                            this.setState({ fiat: 'Disabled' });
                                        } else if (buttonIndex === 2) {
                                            this.setState({ fiat: 'USD' });
                                        } else if (buttonIndex === 3) {
                                            this.setState({ fiat: 'JPY' });
                                        } else if (buttonIndex === 4) {
                                            this.setState({ fiat: 'CNY' });
                                        } else if (buttonIndex === 5) {
                                            this.setState({ fiat: 'SGD' });
                                        } else if (buttonIndex === 6) {
                                            this.setState({ fiat: 'HKD' });
                                        } else if (buttonIndex === 7) {
                                            this.setState({ fiat: 'CAD' });
                                        } else if (buttonIndex === 8) {
                                            this.setState({ fiat: 'NZD' });
                                        } else if (buttonIndex === 9) {
                                            this.setState({ fiat: 'AUD' });
                                        } else if (buttonIndex === 10) {
                                            this.setState({ fiat: 'CLP' });
                                        } else if (buttonIndex === 11) {
                                            this.setState({ fiat: 'GBP' });
                                        } else if (buttonIndex === 12) {
                                            this.setState({ fiat: 'DKK' });
                                        } else if (buttonIndex === 13) {
                                            this.setState({ fiat: 'SEK' });
                                        } else if (buttonIndex === 14) {
                                            this.setState({ fiat: 'ISK' });
                                        } else if (buttonIndex === 15) {
                                            this.setState({ fiat: 'CHF' });
                                        } else if (buttonIndex === 16) {
                                            this.setState({ fiat: 'BRL' });
                                        } else if (buttonIndex === 17) {
                                            this.setState({ fiat: 'EUR' });
                                        } else if (buttonIndex === 18) {
                                            this.setState({ fiat: 'RUB' });
                                        } else if (buttonIndex === 19) {
                                            this.setState({ fiat: 'PLN' });
                                        } else if (buttonIndex === 20) {
                                            this.setState({ fiat: 'THB' });
                                        } else if (buttonIndex === 21) {
                                            this.setState({ fiat: 'KRW' });
                                        } else if (buttonIndex === 22) {
                                            this.setState({ fiat: 'TWD' });
                                        }
                                    }
                                )
                            }
                        >
                            <Text
                                style={{
                                    color:
                                        savedTheme === 'dark'
                                            ? 'white'
                                            : 'black'
                                }}
                            >
                                {fiat}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {showPassphraseForm && (
                    <Text
                        style={{
                            color: savedTheme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        New Passphrase
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
                        style={
                            savedTheme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                    />
                )}

                {showPassphraseForm && (
                    <Text
                        style={{
                            color: savedTheme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        Confirm New Passphrase
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
                        style={
                            savedTheme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                    />
                )}

                <View style={styles.button}>
                    <Button
                        title={saved ? 'Settings Saved!' : 'Save Settings'}
                        icon={{
                            name: 'save',
                            size: 25,
                            color: saved ? 'black' : 'white'
                        }}
                        buttonStyle={{
                            backgroundColor: saved
                                ? '#fff'
                                : savedTheme === 'dark'
                                ? '#261339'
                                : 'rgba(92, 99,216, 1)',
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
                                ? 'Hide New Passphrase Form'
                                : 'Show New Passphrase Form'
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
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
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
        paddingTop: 10,
        paddingBottom: 10
    }
});
