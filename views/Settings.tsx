import * as React from 'react';
import { ActionSheetIOS, Picker, Platform, StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import SettingsStore from './../stores/SettingsStore';

interface SettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SettingsState {
    host: string;
    port: string | number;
    macaroonHex: string;
    theme: string;
    saved: boolean;
}

const themes: any = {
    light: 'Light Theme',
    dark: 'Dark Theme'
};

@inject('SettingsStore')
@observer
export default class Settings extends React.Component<SettingsProps, SettingsState> {
    isComponentMounted: boolean = false;

    state = {
          host: '',
          port: '',
          macaroonHex: '',
          theme: 'light',
          saved: false
    }

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings, settings } = SettingsStore;
        await getSettings();

        this.isComponentMounted = true;

        if (settings) {
            this.setState({
                host: settings.host || '',
                port: settings.port || '',
                macaroonHex: settings.macaroonHex || '',
                theme: settings.theme || ''
            });
        }
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
    }

    componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const host = navigation.getParam('host', null);
        const port = navigation.getParam('port', null);
        const macaroonHex = navigation.getParam('macaroonHex', null);

        this.setState({
            host,
            port,
            macaroonHex
        });
    }

    saveSettings = () => {
        const { SettingsStore } = this.props;
        const { host, port, macaroonHex, theme } = this.state;
        const { setSettings, settings } = SettingsStore;

        setSettings(JSON.stringify({
            host,
            port,
            macaroonHex,
            theme,
            onChainAndress: settings.onChainAndress
        }));

        this.setState({
            saved: true
        });

        setTimeout(() => {
            if (this.isComponentMounted) {
                this.setState({
                    saved: false
                });
            }
        }, 5000);
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { host, port, macaroonHex, saved, theme } = this.state;
        const { loading, btcPayError, settings } = SettingsStore;
        const savedTheme = settings.theme;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet', { refresh: true })}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={savedTheme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Settings', style: { color: '#fff' } }}
                    backgroundColor={savedTheme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)'}
                />

                <View style={styles.form}>
                    {btcPayError && <Text style={styles.error}>{btcPayError}</Text>}
                    <Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>LND Host</Text>
                    <TextInput
                        placeholder={'localhost'}
                        value={host}
                        onChangeText={(text: string) => this.setState({ host: text })}
                        numberOfLines={1}
                        style={savedTheme === 'dark' ? styles.textInputDark : styles.textInput}
                        editable={!loading}
                        placeholderTextColor='gray'
                    />

                    <Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>LND Port</Text>
                    <TextInput
                        placeholder={'443/8080'}
                        value={port}
                        onChangeText={(text: string) => this.setState({ port: text })}
                        numberOfLines={1}
                        style={savedTheme === 'dark' ? styles.textInputDark : styles.textInput}
                        editable={!loading}
                        placeholderTextColor='gray'
                    />

                    <Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>LND Macaroon (Hex format)</Text>
                    <TextInput
                        placeholder={'0A...'}
                        value={macaroonHex}
                        onChangeText={(text: string) => this.setState({ macaroonHex: text })}
                        numberOfLines={1}
                        style={savedTheme === 'dark' ? styles.textInputDark : styles.textInput}
                        editable={!loading}
                        placeholderTextColor='gray'
                    />
                </View>

                {Platform.OS !== 'ios' && <View style={styles.pickerWrapper}>
                    <Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>Theme</Text>
                    <Picker
                        selectedValue={theme}
                        onValueChange={(itemValue: string) => this.setState({ theme: itemValue })}
                        style={savedTheme === 'dark' ? styles.pickerDark : styles.picker}
                    >
                        <Picker.Item label='Light' value='light' />
                        <Picker.Item label='Dark' value='dark' />
                    </Picker>
                </View>}

                {Platform.OS === 'ios' && <View style={styles.pickerWrapper}>
                    <Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>Theme</Text>
                    <TouchableOpacity onPress={() => ActionSheetIOS.showActionSheetWithOptions(
                      {
                        options: ['Cancel', 'Light Theme', 'Dark Theme'],
                        cancelButtonIndex: 0,
                      },
                      (buttonIndex) => {
                        if (buttonIndex === 1) {
                            this.setState({ theme: 'light' })
                        } else if (buttonIndex === 2) {
                            this.setState({ theme: 'dark' })
                        }
                      },
                    )}><Text style={{ color: savedTheme === 'dark' ? 'white' : 'black' }}>{themes[theme]}</Text></TouchableOpacity>
                </View>}

                <View style={styles.button}>
                    <Button
                        title={saved ? "Settings Saved!" : "Save Settings"}
                        icon={{
                            name: "save",
                            size: 25,
                            color: saved ? "black" : "white"
                        }}
                        onPress={() => this.saveSettings()}
                        style={styles.button}
                        buttonStyle={{
                            backgroundColor: saved ? "#fff" : savedTheme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: saved ? "black" : "white"
                        }}
                    />
                </View>

                <View style={styles.button}>
                    <Button
                        title="Scan lndconnect config"
                        icon={{
                            name: "crop-free",
                            size: 25,
                            color: savedTheme === 'dark' ? 'black' : 'white'
                        }}
                        onPress={() => navigation.navigate('LNDConnectConfigQRScanner')}
                        buttonStyle={{
                            backgroundColor: savedTheme === 'dark' ? 'white' : 'black',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: savedTheme === 'dark' ? 'black' : 'white'
                        }}
                    />
                </View>

                <View style={styles.button}>
                    <Button
                        title="Scan BTCPay config"
                        icon={{
                            name: "crop-free",
                            size: 25,
                            color: "white"
                        }}
                        onPress={() => navigation.navigate('BTCPayConfigQRScanner')}
                        buttonStyle={{
                            backgroundColor: "rgba(5, 146, 35, 1)",
                            borderRadius: 30
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
    pickerWrapper: {
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
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
    }
});