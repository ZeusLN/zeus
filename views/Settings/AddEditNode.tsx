import * as React from 'react';
import {
    ActivityIndicator,
    ActionSheetIOS,
    Modal,
    Platform,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity
} from 'react-native';
import Clipboard from '@react-native-community/clipboard';
import { Picker } from '@react-native-picker/picker';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import AddressUtils, { DEFAULT_LNDHUB } from './../../utils/AddressUtils';
import LndConnectUtils from './../../utils/LndConnectUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import CollapsedQR from './../../components/CollapsedQR';
import SettingsStore from './../../stores/SettingsStore';

interface AddEditNodeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface AddEditNodeState {
    host: string; // lnd
    port: string | number; // lnd
    macaroonHex: string; // lnd
    url: string; // spark, eclair
    accessKey: string; // spark
    lndhubUrl: string; // lndhub
    username: string | undefined; // lndhub
    password: string | undefined; // lndhub, eclair
    existingAccount: boolean; // lndhub
    implementation: string;
    certVerification: boolean;
    saved: boolean;
    active: boolean;
    index: number;
    newEntry: boolean;
    suggestImport: string;
    showLndHubModal: boolean;
    showCertModal: boolean;
    enableTor: boolean;
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
        implementation: 'lnd',
        certVerification: false,
        enableTor: false,
        existingAccount: false,
        suggestImport: '',
        url: '',
        lndhubUrl: DEFAULT_LNDHUB,
        showLndHubModal: false,
        showCertModal: false,
        username: '',
        password: '',
        accessKey: ''
    };

    async UNSAFE_componentWillMount() {
        const clipboard = await Clipboard.getString();

        if (
            clipboard.includes('lndconnect://') ||
            clipboard.includes('lndhub://') ||
            clipboard.includes('bluewallet:')
        ) {
            this.setState({
                suggestImport: clipboard
            });
        }
    }

    importClipboard = () => {
        const { suggestImport } = this.state;

        if (suggestImport.includes('lndconnect://')) {
            const {
                host,
                port,
                macaroonHex
            } = LndConnectUtils.processLndConnectUrl(suggestImport);

            this.setState({
                host,
                port,
                macaroonHex,
                suggestImport: '',
                enableTor: host.includes('.onion')
            });
        } else if (
            suggestImport.includes('lndhub://') ||
            suggestImport.includes('bluewallet:')
        ) {
            const {
                username,
                password,
                host
            } = AddressUtils.processLNDHubAddress(suggestImport);

            const existingAccount: boolean = !!username;

            if (host) {
                this.setState({
                    username,
                    password,
                    lndhubUrl: host,
                    implementation: 'lndhub',
                    suggestImport: '',
                    enableTor: host.includes('.onion'),
                    existingAccount
                });
            } else {
                this.setState({
                    username,
                    password,
                    implementation: 'lndhub',
                    suggestImport: '',
                    existingAccount
                });
            }
        }

        Clipboard.setString('');
    };

    clearImportSuggestion = () => {
        this.setState({
            suggestImport: ''
        });
    };

    async componentDidMount() {
        this.isComponentMounted = true;
        this.initFromProps(this.props);
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.initFromProps(nextProps);
    }

    initFromProps(props: any) {
        const { navigation } = props;

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
                certVerification,
                enableTor
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
                certVerification,
                index,
                active,
                saved,
                newEntry,
                enableTor
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
            enableTor,
            lndhubUrl,
            existingAccount,
            macaroonHex,
            accessKey,
            username,
            password,
            implementation,
            certVerification,
            index
        } = this.state;
        const { setSettings, settings } = SettingsStore;
        const { lurkerMode, passphrase, fiat, locale } = settings;

        if (
            implementation === 'lndhub' &&
            (!lndhubUrl || !username || !password)
        ) {
            throw new Error('lndhub settings missing.');
        }

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
            certVerification,
            enableTor
        };

        let nodes: any;
        if (settings.nodes) {
            nodes = settings.nodes;
            nodes[index] = node;
        } else {
            nodes = [node];
        }

        setSettings(
            JSON.stringify({
                nodes,
                theme: settings.theme,
                selectedNode: settings.selectedNode,
                onChainAddress: settings.onChainAddress,
                fiat,
                locale,
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
        const { nodes, lurkerMode, passphrase, fiat, locale } = settings;

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
                locale,
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
        const { nodes, lurkerMode, passphrase, fiat, locale } = settings;

        setSettings(
            JSON.stringify({
                nodes,
                theme: settings.theme,
                selectedNode: index,
                onChainAddress: settings.onChainAddress,
                fiat,
                locale,
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
            certVerification,
            enableTor,
            existingAccount,
            suggestImport,
            showLndHubModal,
            showCertModal
        } = this.state;
        const {
            loading,
            createAccountError,
            createAccountSuccess,
            settings,
            createAccount
        } = SettingsStore;

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

        const CertInstallInstructions = () => (
            <View style={styles.button}>
                <Button
                    title={localeString(
                        'views.Settings.AddEditNode.certificateButton'
                    )}
                    icon={{
                        name: 'lock',
                        size: 25,
                        color: 'white'
                    }}
                    onPress={() => {
                        this.setState({
                            showCertModal: false
                        });
                        navigation.navigate('CertInstallInstructions');
                    }}
                    buttonStyle={{
                        backgroundColor: 'purple',
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: 'white'
                    }}
                />
            </View>
        );

        const NodeInterface = () => (
            <>
                {Platform.OS !== 'ios' && (
                    <View>
                        <Text style={styles.text}>
                            {localeString(
                                'views.Settings.AddEditNode.nodeInterface'
                            )}
                        </Text>
                        <Picker
                            selectedValue={implementation}
                            onValueChange={(itemValue: string) => {
                                if (itemValue === 'lndhub') {
                                    this.setState({
                                        implementation: itemValue,
                                        saved: false,
                                        certVerification: true
                                    });
                                } else {
                                    this.setState({
                                        implementation: itemValue,
                                        saved: false,
                                        certVerification: false
                                    });
                                }
                            }}
                            style={styles.picker}
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
                            <Picker.Item label="Eclair" value="eclair" />
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
                        <Text style={styles.text}>
                            {localeString(
                                'views.Settings.AddEditNode.nodeInterface'
                            )}
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
                                            'LNDHub',
                                            'Eclair'
                                        ],
                                        cancelButtonIndex: 0
                                    },
                                    buttonIndex => {
                                        if (buttonIndex === 1) {
                                            this.setState({
                                                implementation: 'lnd',
                                                saved: false,
                                                certVerification: false
                                            });
                                        } else if (buttonIndex === 2) {
                                            this.setState({
                                                implementation:
                                                    'c-lightning-REST',
                                                saved: false,
                                                certVerification: false
                                            });
                                        } else if (buttonIndex === 3) {
                                            this.setState({
                                                implementation: 'spark',
                                                saved: false,
                                                certVerification: false
                                            });
                                        } else if (buttonIndex === 4) {
                                            this.setState({
                                                implementation: 'lndhub',
                                                saved: false,
                                                certVerification: true
                                            });
                                        } else if (buttonIndex === 5) {
                                            this.setState({
                                                implementation: 'eclair',
                                                saved: false,
                                                certVerification: false
                                            });
                                        }
                                    }
                                )
                            }
                        >
                            <Text style={styles.text}>{implementation}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </>
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString(
                            'views.Settings.AddEditNode.nodeConfig'
                        ),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />
                {!!suggestImport && (
                    <View style={styles.clipboardImport}>
                        <Text style={{ color: 'white' }}>
                            {localeString(
                                'views.Settings.AddEditNode.connectionStringClipboard'
                            )}
                        </Text>
                        <Text style={{ color: 'white', padding: 15 }}>
                            {suggestImport.length > 100
                                ? `${suggestImport.substring(0, 100)}...`
                                : suggestImport}
                        </Text>
                        <Text style={{ color: 'white' }}>
                            {localeString(
                                'views.Settings.AddEditNode.importPrompt'
                            )}
                        </Text>
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.AddEditNode.import'
                                )}
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
                                title={localeString('general.cancel')}
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
                    visible={showLndHubModal || showCertModal}
                >
                    <View style={styles.centeredView}>
                        <View style={styles.modal}>
                            {showLndHubModal && (
                                <>
                                    <Text style={{ fontSize: 40 }}>
                                        {localeString('general.warning')}
                                    </Text>
                                    <Text style={{ paddingTop: 20 }}>
                                        {localeString(
                                            'views.Settings.AddEditNode.lndhubWarning'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            paddingTop: 20,
                                            paddingBottom: 20
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.AddEditNode.lndhubFriend'
                                        )}
                                    </Text>
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'views.Settings.AddEditNode.lndhubUnderstand'
                                            )}
                                            onPress={() => {
                                                createAccount(
                                                    lndhubUrl,
                                                    certVerification
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
                                            buttonStyle={{
                                                borderRadius: 30
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'general.cancel'
                                            )}
                                            onPress={() =>
                                                this.setState({
                                                    showLndHubModal: false
                                                })
                                            }
                                            buttonStyle={{
                                                borderRadius: 30,
                                                backgroundColor: 'grey'
                                            }}
                                        />
                                    </View>
                                </>
                            )}
                            {showCertModal && (
                                <>
                                    <Text style={{ fontSize: 40 }}>
                                        {localeString('general.warning')}
                                    </Text>
                                    <Text style={{ paddingTop: 20 }}>
                                        {localeString(
                                            'views.Settings.AddEditNode.certificateWarning1'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            paddingTop: 20,
                                            paddingBottom: 20
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.AddEditNode.certificateWarning2'
                                        )}
                                    </Text>
                                    <CertInstallInstructions />
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'views.Settings.AddEditNode.certificateUnderstand'
                                            )}
                                            onPress={() => {
                                                this.saveNodeConfiguration();
                                                this.setState({
                                                    showCertModal: false
                                                });
                                            }}
                                            buttonStyle={{
                                                borderRadius: 30
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'general.cancel'
                                            )}
                                            onPress={() =>
                                                this.setState({
                                                    showCertModal: false
                                                })
                                            }
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
                    {!!createAccountError &&
                        implementation === 'lndhub' &&
                        !loading && (
                            <Text style={{ color: 'red', marginBottom: 5 }}>
                                {createAccountError}
                            </Text>
                        )}

                    {!!createAccountSuccess &&
                        implementation === 'lndhub' &&
                        !loading && (
                            <Text style={{ color: 'green', marginBottom: 5 }}>
                                {createAccountSuccess}
                            </Text>
                        )}

                    <NodeInterface />

                    {(implementation === 'spark' ||
                        implementation == 'eclair') && (
                        <>
                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.AddEditNode.host'
                                )}
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
                                style={styles.textInput}
                                editable={!loading}
                                placeholderTextColor="gray"
                            />

                            {implementation === 'spark' && (
                                <>
                                    <Text style={styles.text}>
                                        {localeString(
                                            'views.Settings.AddEditNode.accessKey'
                                        )}
                                    </Text>
                                    <TextInput
                                        placeholder={'...'}
                                        value={accessKey}
                                        onChangeText={(text: string) => {
                                            this.setState({
                                                accessKey: text.trim(),
                                                saved: false
                                            });
                                        }}
                                        numberOfLines={1}
                                        style={styles.textInput}
                                        editable={!loading}
                                        placeholderTextColor="gray"
                                    />
                                </>
                            )}
                            {implementation === 'eclair' && (
                                <>
                                    <Text style={styles.text}>
                                        {localeString(
                                            'views.Settings.AddEditNode.password'
                                        )}
                                    </Text>
                                    <TextInput
                                        placeholder={'...'}
                                        value={password}
                                        onChangeText={(text: string) => {
                                            this.setState({
                                                password: text.trim(),
                                                saved: false
                                            });
                                        }}
                                        numberOfLines={1}
                                        style={styles.textInput}
                                        editable={!loading}
                                        placeholderTextColor="gray"
                                    />
                                </>
                            )}
                        </>
                    )}
                    {implementation === 'lndhub' && (
                        <>
                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.AddEditNode.host'
                                )}
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
                                style={styles.textInput}
                                editable={!loading}
                                placeholderTextColor="gray"
                            />

                            <View
                                style={{
                                    marginTop: 5
                                }}
                            >
                                <CheckBox
                                    title={localeString(
                                        'views.Settings.AddEditNode.existingAccount'
                                    )}
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
                                    <Text style={styles.text}>
                                        {localeString(
                                            'views.Settings.AddEditNode.username'
                                        )}
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
                                        style={styles.textInput}
                                        editable={!loading}
                                        placeholderTextColor="gray"
                                    />

                                    <Text style={styles.text}>
                                        {localeString(
                                            'views.Settings.AddEditNode.password'
                                        )}
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
                                        style={styles.textInput}
                                        editable={!loading}
                                        secureTextEntry={saved}
                                        placeholderTextColor="gray"
                                    />
                                    {saved && (
                                        <CollapsedQR
                                            showText={localeString(
                                                'views.Settings.AddEditNode.showAccountQR'
                                            )}
                                            collapseText={localeString(
                                                'views.Settings.AddEditNode.hideAccountQR'
                                            )}
                                            value={
                                                `lndhub://${username}:${password}` +
                                                (lndhubUrl === DEFAULT_LNDHUB
                                                    ? ''
                                                    : `@${lndhubUrl}`)
                                            }
                                            hideText
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {(implementation === 'lnd' ||
                        implementation === 'c-lightning-REST') && (
                        <>
                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.AddEditNode.host'
                                )}
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
                                style={styles.textInput}
                                editable={!loading}
                                placeholderTextColor="gray"
                            />

                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.AddEditNode.restPort'
                                )}
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
                                style={styles.textInput}
                                editable={!loading}
                                placeholderTextColor="gray"
                            />

                            <Text style={styles.text}>
                                {localeString(
                                    'views.Settings.AddEditNode.macaroon'
                                )}
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
                                style={styles.textInput}
                                editable={!loading}
                                placeholderTextColor="gray"
                            />
                        </>
                    )}

                    <View
                        style={{
                            marginTop: 5
                        }}
                    >
                        <CheckBox
                            title={'Use Tor'}
                            checked={enableTor}
                            onPress={() =>
                                this.setState({
                                    enableTor: !enableTor,
                                    saved: false
                                })
                            }
                        />
                    </View>
                    {!enableTor && (
                        <View
                            style={{
                                marginTop: 5
                            }}
                        >
                            <CheckBox
                                title={localeString(
                                    'views.Settings.AddEditNode.certificateVerification'
                                )}
                                checked={certVerification}
                                onPress={() =>
                                    this.setState({
                                        certVerification: !certVerification,
                                        saved: false
                                    })
                                }
                            />
                        </View>
                    )}
                </View>

                {!existingAccount && implementation === 'lndhub' && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddEditNode.createLndhub'
                            )}
                            onPress={() => {
                                if (lndhubUrl === DEFAULT_LNDHUB) {
                                    this.setState({ showLndHubModal: true });
                                } else {
                                    createAccount(
                                        lndhubUrl,
                                        certVerification,
                                        enableTor
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
                        title={
                            saved
                                ? localeString(
                                      'views.Settings.AddEditNode.nodeSaved'
                                  )
                                : localeString(
                                      'views.Settings.AddEditNode.saveNode'
                                  )
                        }
                        icon={{
                            name: 'save',
                            size: 25,
                            color: saved ? 'black' : 'white'
                        }}
                        onPress={() => {
                            if (!saved && !certVerification) {
                                this.setState({ showCertModal: true });
                            } else {
                                this.saveNodeConfiguration();
                            }
                        }}
                        buttonStyle={{
                            backgroundColor: saved ? '#fff' : '#261339',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: saved ? 'black' : 'white'
                        }}
                    />
                </View>

                {!saved && certVerification && !enableTor && (
                    <CertInstallInstructions />
                )}

                {saved && !newEntry && (
                    <View style={styles.button}>
                        <Button
                            title={
                                active
                                    ? localeString(
                                          'views.Settings.AddEditNode.nodeActive'
                                      )
                                    : localeString(
                                          'views.Settings.AddEditNode.setNodeActive'
                                      )
                            }
                            icon={{
                                name: 'blur-circular',
                                size: 25,
                                color: active ? 'white' : 'purple'
                            }}
                            onPress={() => this.setNodeConfigurationAsActive()}
                            buttonStyle={{
                                backgroundColor: active ? 'purple' : 'white',
                                borderRadius: 30
                            }}
                            titleStyle={{
                                color: active ? 'white' : 'purple'
                            }}
                        />
                    </View>
                )}

                {(implementation === 'lnd' ||
                    implementation === 'c-lightning-REST') && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddEditNode.scanLndconnect'
                            )}
                            icon={{
                                name: 'crop-free',
                                size: 25,
                                color: themeColor('background')
                            }}
                            onPress={() =>
                                navigation.navigate(
                                    'LNDConnectConfigQRScanner',
                                    {
                                        index
                                    }
                                )
                            }
                            buttonStyle={{
                                backgroundColor: themeColor('text'),
                                borderRadius: 30
                            }}
                            titleStyle={{
                                color: themeColor('background')
                            }}
                        />
                    </View>
                )}

                {(implementation === 'lnd' ||
                    implementation === 'c-lightning-REST') && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddEditNode.scanBtcpay'
                            )}
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
                )}

                {implementation === 'lndhub' && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddEditNode.scanLndhub'
                            )}
                            icon={{
                                name: 'crop-free',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() =>
                                navigation.navigate('LNDHubQRScanner', {
                                    index
                                })
                            }
                            buttonStyle={{
                                borderRadius: 30
                            }}
                        />
                    </View>
                )}

                {saved && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.AddEditNode.deleteNode'
                            )}
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
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    text: {
        color: themeColor('text')
    },
    textInput: {
        fontSize: 20,
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
    pickerWrapper: {
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        height: 50,
        width: 100,
        color: themeColor('text')
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
