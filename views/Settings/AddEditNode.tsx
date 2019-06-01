import * as React from 'react';
import { StyleSheet, Text, View, TextInput } from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import SettingsStore from './../../stores/SettingsStore';

interface AddEditNodeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface AddEditNodeState {
    host: string;
    port: string | number;
    macaroonHex: string;
    saved: boolean;
    activated: boolean;
    index: number;
}

@inject('SettingsStore')
@observer
export default class AddEditNode extends React.Component<AddEditNodeProps, AddEditNodeState> {
    isComponentMounted: boolean = false;

    state = {
          host: '',
          port: '',
          macaroonHex: '',
          saved: false,
          index: 0,
          activated: false
    }

    async componentDidMount() {
        const { navigation } = this.props;

        console.log('mount AddEditNode');

        this.isComponentMounted = true;

        const node = navigation.getParam('node', null);
        const index = navigation.getParam('index', null);

        console.log('!!!');
        console.log(index);

        if (node) {
            const { host, port, macaroonHex } = node;

            console.log('node');
            console.log(node);

            this.setState({
                host,
                port,
                macaroonHex,
                index
            });
        } else {
          this.setState({
              index
          });
        }
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
    }

    componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const node = navigation.getParam('node', null);
        const index = navigation.getParam('index', null);
        if (node) {
          const { host, port, macaroonHex } = node;

          this.setState({
              host,
              port,
              macaroonHex,
              index,
              activated: index === this.props.SettingsStore.settings.selectedNode
          });
        } else {
          this.setState({
              index
          });
        }

    }

    saveNodeConfiguration = () => {
        const { SettingsStore } = this.props;
        const { host, port, macaroonHex, index } = this.state;
        const { setSettings, settings } = SettingsStore;

        const node = {
            host,
            port,
            macaroonHex
        };

        let nodes: any = settings.nodes || [];

        nodes[index] =  node;

        setSettings(JSON.stringify({
            nodes,
            theme: settings.theme,
            selectedNode: settings.selectedNode,
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

    setNodeConfigurationAsActive = () => {
        const { SettingsStore } = this.props;
        const { setSettings, settings } = SettingsStore;
        const { index } = this.state;
        const { nodes } = settings;

        setSettings(JSON.stringify({
            nodes,
            theme: settings.theme,
            selectedNode: index,
            onChainAndress: settings.onChainAndress
        }));

        this.setState({
            activated: true
        });

        setTimeout(() => {
            if (this.isComponentMounted) {
                this.setState({
                    activated: false
                });
            }
        }, 5000);
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { host, port, macaroonHex, saved, activated } = this.state;
        const { loading, settings } = SettingsStore;
        const savedTheme = settings.theme;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Settings', { refresh: true })}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={savedTheme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Node Configuration', style: { color: '#fff' } }}
                    backgroundColor={savedTheme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)'}
                />

                <View style={styles.form}>
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

                <View style={styles.button}>
                    <Button
                        title={saved ? "Node Config Saved!" : "Save Node Config"}
                        icon={{
                            name: "save",
                            size: 25,
                            color: saved ? "black" : "white"
                        }}
                        onPress={() => this.saveNodeConfiguration()}
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
                        title={activated ? "Activated" : "Set Node Config as Active"}
                        icon={{
                            name: "save",
                            size: 25,
                            color: "white"
                        }}
                        onPress={() => this.setNodeConfigurationAsActive()}
                        style={styles.button}
                        buttonStyle={{
                            backgroundColor: activated ? 'red' : 'white',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: activated ? 'white' : 'red'
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