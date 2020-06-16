import * as React from 'react';
import {
    ActivityIndicator,
    ActionSheetIOS,
    Clipboard,
    Modal,
    Picker,
    Platform,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity
} from 'react-native';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import LndConnectUtils from './../../utils/LndConnectUtils';

import SettingsStore from './../../stores/SettingsStore';

interface AddEditNodeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface AddEditNodeState {
    host: string; // lnd
    port: string | number; // lnd
    macaroonHex: string; // lnd
    url: string; // spark
    accessKey: string; // spark
    lndhubUrl: string; // lndhub
    username: string; // lndhub
    password: string; // lndhub
    existingAccount: boolean; // lndhub
    implementation: string;
    sslVerification: boolean;
    saved: boolean;
    active: boolean;
    index: number;
    newEntry: boolean;
    suggestImport: string;
    showLndHubModal: boolean;
    showSslModal: boolean;
}

const DEFAULT_LNDHUB = 'lndhub.herokuapp.com';

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
        implementation: 'lnd',
        sslVerification: false,
        existingAccount: false,
        suggestImport: '',
        lndhubUrl: DEFAULT_LNDHUB,
        showLndHubModal: false,
        showSslModal: false
    };

    async UNSAFE_componentWillMount() {
        const clipboard = await Clipboard.getString();

        if (clipboard.includes('lndconnect://')) {
            this.setState({
                suggestImport: clipboard
            });
        }
    }

    importClipboard = () => {
        const {
            host,
            port,
            macaroonHex
        } = LndConnectUtils.processLndConnectUrl(this.state.suggestImport);

        this.setState({
            host,
            port,
            macaroonHex,
            suggestImport: ''
        });

        Clipboard.setString('');
    };

    clearImportSuggestion = () => {
        this.setState({
            suggestImport: ''
        });
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
            const {
                host,
                port,
                macaroonHex,
                url,
                lndhubUrl,
                existingAccount,
                accessKey,
                username,
                password,
                implementation,
                sslVerification
            } = node;

            this.setState({
                host,
                port,
                macaroonHex,
                url,
                lndhubUrl,
                existingAccount,
                accessKey,
                username,
                password,
                implementation: implementation || 'lnd',
                sslVerification,
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
            const {
                host,
                port,
                macaroonHex,
                url,
                accessKey,
                username,
                password,
                implementation,
                sslVerification
            } = node;

            this.setState({
                host,
                port,
                macaroonHex,
                accessKey,
                username,
                password,
                implementation,
                sslVerification,
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
        const {
            host,
            port,
            url,
            lndhubUrl,
            existingAccount,
            macaroonHex,
            accessKey,
            username,
            password,
            implementation,
            sslVerification,
            index
        } = this.state;
        const { setSettings, settings } = SettingsStore;
        const { lurkerMode, passphrase, fiat } = settings;

        const node = {
            host,
            port,
            url,
            lndhubUrl,
            existingAccount,
            macaroonHex,
            accessKey,
            username,
            password,
            implementation,
            sslVerification
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
            url,
            lndhubUrl,
            macaroonHex,
            accessKey,
            username,
            password,
            saved,
            active,
            index,
            newEntry,
            implementation,
            sslVerification,
            existingAccount,
            suggestImport,
            showLndHubModal,
            showSslModal
        } = this.state;
        const {
            loading,
            createAccountError,
            createAccountSuccess,
            settings,
            createAccount
        } = SettingsStore;
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

        const NodeInterface = () => (
            <>
                {Platform.OS !== 'ios' && (
                    <View>
                        <Text
                            style={{
                                color: savedTheme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Node interface
                        </Text>
                        <Picker
                            selectedValue={implementation}
                            onValueChange={(itemValue: string) => {
                                if (itemValue === 'lndhub') {
                                    this.setState({
                                        implementation: itemValue,
                                        saved: false,
                                        sslVerification: true
                                    });
                                } else {
                                    this.setState({
                                        implementation: itemValue,
                                        saved: false,
                                        sslVerification: false
                                    });
                                }
                            }}
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
                            <Picker.Item
                                label="Spark (c-lightning)"
                                value="spark"
                            />
                            <Picker.Item label="LNDHub" value="lndhub" />
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
                            Node interface
                        </Text>
                        <TouchableOpacity
                            onPress={() =>
                                ActionSheetIOS.showActionSheetWithOptions(
                                    {
                                        options: [
                                            'Cancel',
                                            'lnd',
                                            'c-lightning-REST',
                                            'Spark (c-lightning)',
                                            'LNDHub'
                                        ],
                                        cancelButtonIndex: 0
                                    },
                                    buttonIndex => {
                                        if (buttonIndex === 1) {
                                            this.setState({
                                                implementation: 'lnd',
                                                saved: false,
                                                sslVerification: false
                                            });
                                        } else if (buttonIndex === 2) {
                                            this.setState({
                                                implementation:
                                                    'c-lightning-REST',
                                                saved: false,
                                                sslVerification: false
                                            });
                                        } else if (buttonIndex === 3) {
                                            this.setState({
                                                implementation: 'spark',
                                                saved: false,
                                                sslVerification: false
                                            });
                                        } else if (buttonIndex === 4) {
                                            this.setState({
                                                implementation: 'lndhub',
                                                saved: false,
                                                sslVerification: true
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
            </>
        );

        const SparkForm = () => (
            <>
                <Text
                    style={{
                        color: savedTheme === 'dark' ? 'white' : 'black'
                    }}
                >
                    Host
                </Text>
                <TextInput
                    placeholder={'http://192.168.1.2:9737'}
                    value={url}
                    onChangeText={(text: string) =>
                        this.setState({
                            url: text.trim(),
                            saved: false
                        })
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
                    Access Key
                </Text>
                <TextInput
                    placeholder={'...'}
                    value={accessKey}
                    onChangeText={(text: string) =>
                        this.setState({
                            accessKey: text.trim(),
                            saved: false
                        })
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
            </>
        );

        const LndHubForm = () => (
            <>
                <Text
                    style={{
                        color: savedTheme === 'dark' ? 'white' : 'black'
                    }}
                >
                    Host
                </Text>
                <TextInput
                    placeholder={DEFAULT_LNDHUB}
                    value={lndhubUrl}
                    onChangeText={(text: string) =>
                        this.setState({
                            lndhubUrl: text.trim(),
                            saved: false
                        })
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

                <View
                    style={{
                        marginTop: 5
                    }}
                >
                    <CheckBox
                        title="Existing Account"
                        checked={existingAccount}
                        onPress={() =>
                            this.setState({
                                existingAccount: !existingAccount
                            })
                        }
                    />
                </View>

                {existingAccount && (
                    <>
                        <Text
                            style={{
                                color: savedTheme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Username
                        </Text>
                        <TextInput
                            placeholder={'...'}
                            value={username}
                            onChangeText={(text: string) =>
                                this.setState({
                                    username: text.trim(),
                                    saved: false
                                })
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
                            Password
                        </Text>
                        <TextInput
                            placeholder={'...'}
                            value={password}
                            onChangeText={(text: string) =>
                                this.setState({
                                    password: text.trim(),
                                    saved: false
                                })
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
                    </>
                )}
            </>
        );

        const DefaultForm = () => (
            <>
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
                        this.setState({
                            host: text.trim(),
                            saved: false
                        })
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
                        this.setState({
                            port: text.trim(),
                            saved: false
                        })
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
                        this.setState({
                            macaroonHex: text.trim(),
                            saved: false
                        })
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
            </>
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
                {!!suggestImport && (
                    <View style={styles.clipboardImport}>
                        <Text style={{ color: 'white' }}>
                            Detected the following lndconnect string in your
                            clipboard:
                        </Text>
                        <Text style={{ color: 'white', padding: 15 }}>
                            {`${suggestImport.substring(0, 100)}...`}
                        </Text>
                        <Text style={{ color: 'white' }}>
                            Would you like to import it?
                        </Text>
                        <View style={styles.button}>
                            <Button
                                title="Import"
                                onPress={() => this.importClipboard()}
                                titleStyle={{
                                    color: 'rgba(92, 99,216, 1)'
                                }}
                                buttonStyle={{
                                    backgroundColor: 'white',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                        <View style={styles.button}>
                            <Button
                                title="Cancel"
                                onPress={() => this.clearImportSuggestion()}
                                titleStyle={{
                                    color: 'rgba(92, 99,216, 1)'
                                }}
                                buttonStyle={{
                                    backgroundColor: 'white',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    </View>
                )}

                {loading && (
                    <View style={{ padding: 10 }}>
                        <ActivityIndicator size="large" color="#0000ff" />
                    </View>
                )}

                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showLndHubModal || showSslModal}
                >
                    <View style={styles.centeredView}>
                        <View style={styles.modal}>
                            {showLndHubModal && (
                                <>
                                    <Text style={{ fontSize: 40 }}>
                                        Warning
                                    </Text>
                                    <Text style={{ paddingTop: 20 }}>
                                        With any instance of LNDHub the operator
                                        can track your balances, transactions,
                                        the IP addresses you connect with, and
                                        even run off with your funds.
                                    </Text>
                                    <Text
                                        style={{
                                            paddingTop: 20,
                                            paddingBottom: 20
                                        }}
                                    >
                                        If you have a friend who you trust and
                                        who runs an lnd node you may want to
                                        consider asking them to set up an LNDHub
                                        instance for you to connect to.
                                    </Text>
                                    <View style={styles.button}>
                                        <Button
                                            title="I understand, create my account"
                                            onPress={() => {
                                                createAccount(
                                                    lndhubUrl,
                                                    sslVerification
                                                ).then((data: any) => {
                                                    if (data) {
                                                        this.setState({
                                                            username:
                                                                data.login,
                                                            password:
                                                                data.password,
                                                            existingAccount: true
                                                        });
                                                    }

                                                    this.setState({
                                                        showLndHubModal: false
                                                    });
                                                });
                                            }}
                                            style={styles.button}
                                            buttonStyle={{
                                                borderRadius: 30
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title="Cancel"
                                            onPress={() =>
                                                this.setState({
                                                    showLndHubModal: false
                                                })
                                            }
                                            style={styles.button}
                                            buttonStyle={{
                                                borderRadius: 30,
                                                backgroundColor: 'grey'
                                            }}
                                        />
                                    </View>
                                </>
                            )}
                            {showSslModal && (
                                <>
                                    <Text style={{ fontSize: 40 }}>
                                        Warning
                                    </Text>
                                    <Text style={{ paddingTop: 20 }}>
                                        Opting not to use SSL Verification may
                                        leave you vulnerable to a
                                        man-in-the-middle attack. Do so at your
                                        own discretion.
                                    </Text>
                                    <Text
                                        style={{
                                            paddingTop: 20,
                                            paddingBottom: 20
                                        }}
                                    >
                                        If you're not verifying your connection
                                        with a VPN or Tor v3 hidden service
                                        configuration, we strongly advise you
                                        install your node's certificate on this
                                        device.
                                    </Text>
                                    <View style={styles.button}>
                                        <Button
                                            title="Certificate Install Instructions"
                                            icon={{
                                                name: 'lock',
                                                size: 25,
                                                color: 'white'
                                            }}
                                            onPress={() => {
                                                this.setState({
                                                    showSslModal: false
                                                });
                                                navigation.navigate(
                                                    'CertInstallInstructions'
                                                );
                                            }}
                                            style={styles.button}
                                            buttonStyle={{
                                                backgroundColor: 'purple',
                                                borderRadius: 30
                                            }}
                                            titleStyle={{
                                                color: 'white'
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title="I understand, save my node config"
                                            onPress={() =>
                                                this.saveNodeConfiguration()
                                            }
                                            style={styles.button}
                                            buttonStyle={{
                                                borderRadius: 30
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title="Cancel"
                                            onPress={() =>
                                                this.setState({
                                                    showSslModal: false
                                                })
                                            }
                                            style={styles.button}
                                            buttonStyle={{
                                                borderRadius: 30,
                                                backgroundColor: 'grey'
                                            }}
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>

                <View style={styles.form}>
                    {createAccountError !== '' &&
                        implementation === 'lndhub' &&
                        !loading && (
                            <Text style={{ color: 'red', marginBottom: 5 }}>
                                {createAccountError}
                            </Text>
                        )}

                    {createAccountSuccess !== '' &&
                        implementation === 'lndhub' &&
                        !loading && (
                            <Text style={{ color: 'green', marginBottom: 5 }}>
                                {createAccountSuccess}
                            </Text>
                        )}

                    <NodeInterface />

                    {implementation === 'spark' && <SparkForm />}
                    {implementation === 'lndhub' && <LndHubForm />}
                    {(implementation === 'lnd' ||
                        implementation === 'c-lightning-REST') && (
                        <DefaultForm />
                    )}

                    <View
                        style={{
                            marginTop: 5
                        }}
                    >
                        <CheckBox
                            title="SSL Verification"
                            checked={sslVerification}
                            onPress={() =>
                                this.setState({
                                    sslVerification: !sslVerification,
                                    saved: false
                                })
                            }
                        />
                    </View>
                </View>

                {!existingAccount && implementation === 'lndhub' && (
                    <View style={styles.button}>
                        <Button
                            title="Create LNDHub account"
                            onPress={() => {
                                if (lndhubUrl === DEFAULT_LNDHUB) {
                                    this.setState({ showLndHubModal: true });
                                } else {
                                    createAccount(
                                        lndhubUrl,
                                        sslVerification
                                    ).then((data: any) => {
                                        if (data) {
                                            this.setState({
                                                username: data.login,
                                                password: data.password,
                                                existingAccount: true
                                            });
                                        }
                                    });
                                }
                            }}
                            buttonStyle={{
                                backgroundColor: 'lightblue',
                                borderRadius: 30
                            }}
                        />
                    </View>
                )}

                <View style={styles.button}>
                    <Button
                        title={saved ? 'Node Config Saved' : 'Save Node Config'}
                        icon={{
                            name: 'save',
                            size: 25,
                            color: saved ? 'black' : 'white'
                        }}
                        onPress={() => {
                            if (!saved && !sslVerification) {
                                this.setState({ showSslModal: true });
                            } else {
                                this.saveNodeConfiguration();
                            }
                        }}
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
    },
    clipboardImport: {
        padding: 10,
        backgroundColor: 'rgba(92, 99,216, 1)',
        color: 'white'
    },
    modal: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22
    }
});
