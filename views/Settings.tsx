import * as React from 'react';
import { StyleSheet, Text, View, TextInput } from 'react-native';
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
}

@inject('SettingsStore')
@observer
export default class Settings extends React.Component<SettingsProps, SettingsState> {
    state = {
          host: '',
          port: '',
          macaroonHex: ''
    }

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings, settings } = SettingsStore;
        await getSettings();

        if (settings) {
            this.setState({
                host: settings.host || '',
                port: settings.port || '',
                macaroonHex: settings.macaroonHex || ''
            });
        }
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

    render() {
        const { navigation, SettingsStore } = this.props;
        const { host, port, macaroonHex } = this.state;
        const { setSettings, loading, settings, btcPayError } = SettingsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet', { refresh: true })}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={styles.container}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Settings', style: { color: '#fff' } }}
                    backgroundColor="rgba(92, 99,216, 1)"
                />

                <View style={styles.form}>
                    {btcPayError && <Text style={styles.error}>{btcPayError}</Text>}
                    <Text>LND Host</Text>
                    <TextInput
                        placeholder={'localhost'}
                        value={host}
                        onChangeText={(text: string) => this.setState({ host: text })}
                        numberOfLines={1}
                        style={{ fontSize: 20 }}
                        editable={!loading}
                    />

                    <Text>LND Port</Text>
                    <TextInput
                        placeholder={'443/8080'}
                        value={port}
                        onChangeText={(text: string) => this.setState({ port: text })}
                        numberOfLines={1}
                        style={{ fontSize: 20 }}
                        editable={!loading}
                    />

                    <Text>LND Macaroon (Hex format)</Text>
                    <TextInput
                        placeholder={'0A...'}
                        value={macaroonHex}
                        onChangeText={(text: string) => this.setState({ macaroonHex: text })}
                        numberOfLines={1}
                        style={{ fontSize: 20, marginBottom: 30 }}
                        editable={!loading}
                    />
                </View>

                <View style={styles.button}>
                    <Button
                        title="Save Settings"
                        icon={{
                            name: "save",
                            size: 25,
                            color: "white"
                        }}
                        backgroundColor="rgba(92, 99,216, 1)"
                        onPress={() => setSettings(JSON.stringify({ ...this.state, onChainAndress: settings.onChainAndress }))}
                        style={styles.button}
                        borderRadius={30}
                    />
                </View>

                <View style={styles.button}>
                    <Button
                        title="Scan BTCPay Config"
                        icon={{
                            name: "crop-free",
                            size: 25,
                            color: "white"
                        }}
                        onPress={() => navigation.navigate('BTCPayConfigQRScanner')}
                        backgroundColor="rgba(5, 146, 35, 1)"
                        borderRadius={30}
                    />
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff'
    },
    error: {
        color: 'red'
    },
    form: {
        alignSelf: 'center',
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    }
});