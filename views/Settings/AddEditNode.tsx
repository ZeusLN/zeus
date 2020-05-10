import * as React from 'react';
import {
    ActionSheetIOS,
    Picker,
    Platform,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity
} from 'react-native';
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
    implementation: string;
    saved: boolean;
    active: boolean;
    index: number;
    newEntry: boolean;
}

@inject('SettingsStore')
@observer
export default class AddEditNode extends React.Component<
    AddEditNodeProps,
    AddEditNodeState
> {
    isComponentMounted: boolean = false;

    state = {
        host: '',
        port: '',
        macaroonHex: '',
        saved: false,
        index: 0,
        active: false,
        newEntry: false,
        implementation: 'lnd'
    };

    async componentDidMount() {
        const { navigation } = this.props;

        this.isComponentMounted = true;

        const node = navigation.getParam('node', null);
        const index = navigation.getParam('index', null);
        const active = navigation.getParam('active', null);
        const saved = navigation.getParam('saved', null);
        const newEntry = navigation.getParam('newEntry', null);

        if (node) {
            const { host, port, macaroonHex, implementation } = node;

            this.setState({
                host,
                port,
                macaroonHex,
                implementation,
                index,
                active,
                saved,
                newEntry
            });
        } else {
            this.setState({
                index,
                active,
                newEntry
            });
        }
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const node = navigation.getParam('node', null);
        const index = navigation.getParam('index', null);
        const active = navigation.getParam('active', null);
        const newEntry = navigation.getParam('newEntry', null);

        if (node) {
            const { host, port, macaroonHex, implementation } = node;

            this.setState({
                host,
                port,
                macaroonHex,
                implementation,
                index,
                active:
                    index === this.props.SettingsStore.settings.selectedNode,
                newEntry
            });
        } else {
            this.setState({
                index,
                active,
                newEntry
            });
        }
    }

    saveNodeConfiguration = () => {
        const { SettingsStore, navigation } = this.props;
        const { host, port, macaroonHex, implementation, index } = this.state;
        const { setSettings, settings } = SettingsStore;
        const { lurkerMode, passphrase, fiat } = settings;

        const node = {
            host,
            port,
            macaroonHex,
            implementation
        };

        let nodes: any = settings.nodes || [];

        nodes[index] = node;

        setSettings(
            JSON.stringify({
                nodes,
                theme: settings.theme,
                selectedNode: settings.selectedNode,
                onChainAddress: settings.onChainAddress,
                fiat,
                lurkerMode,
                passphrase
            })
        ).then(() => {
            this.setState({
                saved: true
            });

            if (nodes.length === 1) {
                navigation.navigate('Wallet', { refresh: true });
            } else {
                navigation.navigate('Settings', { refresh: true });
            }
        });
    };

    deleteNodeConfig = () => {
        const { SettingsStore, navigation } = this.props;
        const { setSettings, settings } = SettingsStore;
        const { index } = this.state;
        const { nodes, lurkerMode, passphrase, fiat } = settings;

        let newNodes: any = [];
        for (let i = 0; nodes && i < nodes.length; i++) {
            if (index !== i) {
                newNodes.push(nodes[i]);
            }
        }

        setSettings(
            JSON.stringify({
                nodes: newNodes,
                theme: settings.theme,
                selectedNode:
                    index === settings.selectedNode ? 0 : settings.selectedNode,
                onChainAddress: settings.onChainAddress,
                fiat,
                lurkerMode,
                passphrase
            })
        ).then(() => {
            navigation.navigate('Wallet', { refresh: true });
        });
    };

    setNodeConfigurationAsActive = () => {
        const { SettingsStore, navigation } = this.props;
        const { setSettings, settings } = SettingsStore;
        const { index } = this.state;
        const { nodes, lurkerMode, passphrase, fiat } = settings;

        setSettings(
            JSON.stringify({
                nodes,
                theme: settings.theme,
                selectedNode: index,
                onChainAddress: settings.onChainAddress,
                fiat,
                lurkerMode,
                passphrase
            })
        );

        this.setState({
            active: true
        });

        navigation.navigate('Wallet', { refresh: true });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            host,
            port,
            macaroonHex,
            saved,
            active,
            index,
            newEntry,
            implementation
        } = this.state;
        const { loading, settings } = SettingsStore;
        const savedTheme = settings.theme;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', { refresh: true })
                }
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={
                    savedTheme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Node Configuration',
                        style: { color: '#fff' }
                    }}
                    backgroundColor={
                        savedTheme === 'dark'
                            ? '#261339'
                            : 'rgba(92, 99,216, 1)'
                    }
                />

                <View style={styles.form}>
                    <Text
                        style={{
                            color: savedTheme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        Host
                    </Text>
                    <TextInput
                        placeholder={'localhost'}
                        value={host}
                        onChangeText={(text: string) =>
                            this.setState({ host: text, saved: false })
                        }
                        numberOfLines={1}
                        style={
                            savedTheme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        editable={!loading}
                        placeholderTextColor="gray"
                    />

                    <Text
                        style={{
                            color: savedTheme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        REST Port
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder={'443/8080'}
                        value={port}
                        onChangeText={(text: string) =>
                            this.setState({ port: text, saved: false })
                        }
                        numberOfLines={1}
                        style={
                            savedTheme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        editable={!loading}
                        placeholderTextColor="gray"
                    />

                    <Text
                        style={{
                            color: savedTheme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        Macaroon (Hex format)
                    </Text>
                    <TextInput
                        placeholder={'0A...'}
                        value={macaroonHex}
                        onChangeText={(text: string) =>
                            this.setState({ macaroonHex: text, saved: false })
                        }
                        numberOfLines={1}
                        style={
                            savedTheme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        editable={!loading}
                        placeholderTextColor="gray"
                    />

                    {Platform.OS !== 'ios' && (
                        <View>
                            <Text
                                style={{
                                    color:
                                        savedTheme === 'dark'
                                            ? 'white'
                                            : 'black'
                                }}
                            >
                                Implementation
                            </Text>
                            <Picker
                                selectedValue={implementation || 'lnd'}
                                onValueChange={(itemValue: string) =>
                                    this.setState({
                                        implementation: itemValue,
                                        saved: false
                                    })
                                }
                                style={
                                    savedTheme === 'dark'
                                        ? styles.pickerDark
                                        : styles.picker
                                }
                            >
                                <Picker.Item label="lnd" value="lnd" />
                                <Picker.Item
                                    label="c-lightning-REST"
                                    value="c-lightning-REST"
                                />
                            </Picker>
                        </View>
                    )}

                    {Platform.OS === 'ios' && (
                        <View>
                            <Text
                                style={{
                                    color:
                                        savedTheme === 'dark'
                                            ? 'white'
                                            : 'black'
                                }}
                            >
                                Node implementation
                            </Text>
                            <TouchableOpacity
                                onPress={() =>
                                    ActionSheetIOS.showActionSheetWithOptions(
                                        {
                                            options: [
                                                'Cancel',
                                                'lnd',
                                                'c-lightning-REST'
                                            ],
                                            cancelButtonIndex: 0
                                        },
                                        buttonIndex => {
                                            if (buttonIndex === 1) {
                                                this.setState({
                                                    implementation: 'lnd',
                                                    saved: false
                                                });
                                            } else if (buttonIndex === 2) {
                                                this.setState({
                                                    implementation:
                                                        'c-lightning-REST',
                                                    saved: false
                                                });
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
                                    {implementation}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.button}>
                    <Button
                        title={saved ? 'Node Config Saved' : 'Save Node Config'}
                        icon={{
                            name: 'save',
                            size: 25,
                            color: saved ? 'black' : 'white'
                        }}
                        onPress={() => this.saveNodeConfiguration()}
                        style={styles.button}
                        buttonStyle={{
                            backgroundColor: saved
                                ? '#fff'
                                : savedTheme === 'dark'
                                ? '#261339'
                                : 'rgba(92, 99,216, 1)',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: saved ? 'black' : 'white'
                        }}
                    />
                </View>

                {saved && !newEntry && (
                    <View style={styles.button}>
                        <Button
                            title={
                                active
                                    ? 'Node Active'
                                    : 'Set Node Config as Active'
                            }
                            icon={{
                                name: 'blur-circular',
                                size: 25,
                                color: active ? 'white' : 'orange'
                            }}
                            onPress={() => this.setNodeConfigurationAsActive()}
                            style={styles.button}
                            buttonStyle={{
                                backgroundColor: active ? 'orange' : 'white',
                                borderRadius: 30
                            }}
                            titleStyle={{
                                color: active ? 'white' : 'orange'
                            }}
                        />
                    </View>
                )}

                <View style={styles.button}>
                    <Button
                        title="Scan lndconnect config"
                        icon={{
                            name: 'crop-free',
                            size: 25,
                            color: savedTheme === 'dark' ? 'black' : 'white'
                        }}
                        onPress={() =>
                            navigation.navigate('LNDConnectConfigQRScanner', {
                                index
                            })
                        }
                        buttonStyle={{
                            backgroundColor:
                                savedTheme === 'dark' ? 'white' : 'black',
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
                            name: 'crop-free',
                            size: 25,
                            color: 'white'
                        }}
                        onPress={() =>
                            navigation.navigate('BTCPayConfigQRScanner', {
                                index
                            })
                        }
                        buttonStyle={{
                            backgroundColor: 'rgba(5, 146, 35, 1)',
                            borderRadius: 30
                        }}
                    />
                </View>

                {saved && (
                    <View style={styles.button}>
                        <Button
                            title="Delete Node config"
                            icon={{
                                name: 'delete',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => this.deleteNodeConfig()}
                            buttonStyle={{
                                backgroundColor: 'red',
                                borderRadius: 30
                            }}
                        />
                    </View>
                )}
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
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
