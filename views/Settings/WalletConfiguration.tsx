import * as React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    View,
    Image,
    ScrollView,
    TouchableOpacity
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import cloneDeep from 'lodash/cloneDeep';
import differenceBy from 'lodash/differenceBy';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { hash, LNC_STORAGE_KEY } from '../../backends/LNC/credentialStore';

import AddressUtils, { CUSTODIAL_LNDHUBS } from '../../utils/AddressUtils';
import ConnectionFormatUtils from '../../utils/ConnectionFormatUtils';
import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import Pill from '../../components/Pill';
import Screen from '../../components/Screen';
import {
    SuccessMessage,
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';
import { Row } from '../../components/layout/Row';
import ShowHideToggle from '../../components/ShowHideToggle';

import SettingsStore, {
    INTERFACE_KEYS,
    LNC_MAILBOX_KEYS,
    EMBEDDED_NODE_NETWORK_KEYS,
    Settings,
    Node,
    Implementations
} from '../../stores/SettingsStore';

import Scan from '../../assets/images/SVG/Scan.svg';
import AddIcon from '../../assets/images/SVG/Add.svg';

import { getPhoto } from '../../utils/PhotoUtils';
import {
    optimizeNeutrinoPeers,
    createLndWallet
} from '../../utils/LndMobileUtils';

interface WalletConfigurationProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<
        'WalletConfiguration',
        {
            node: Node;
            index: any;
            active: boolean;
            tor: boolean;
            saved: boolean;
            newEntry: boolean;
            photo: string;
        }
    >;
}

interface WalletConfigurationState {
    node: Node | null;
    nickname: string; //
    host: string; // lnd, c-lightning-REST
    port: string; // lnd, c-lightning-REST
    macaroonHex: string; // lnd, c-lightning-REST
    rune: string; // c-lightning-REST
    url: string; // spark, eclair
    accessKey: string; // spark
    lndhubUrl: string; // lndhub
    username: string | undefined; // lndhub
    password: string | undefined; // lndhub, eclair
    hidden: boolean;
    existingAccount: boolean; // lndhub
    dismissCustodialWarning: boolean;
    implementation: Implementations;
    certVerification: boolean;
    saved: boolean;
    active: boolean;
    index: number | null;
    newEntry: boolean;
    suggestImport: string;
    showLndHubModal: boolean;
    showCertModal: boolean;
    enableTor: boolean;
    interfaceKeys: Array<any>;
    photo?: string;
    // lnc
    pairingPhrase: string;
    mailboxServer: string;
    customMailboxServer: string;
    localKey: string;
    remoteKey: string;
    deletionAwaitingConfirmation: boolean;
    // embeded lnd
    seedPhrase: Array<string>;
    walletPassword: string;
    adminMacaroon: string;
    embeddedLndNetwork: string;
    recoveryCipherSeed: string;
    channelBackupsBase64: string;
    creatingWallet: boolean;
    errorCreatingWallet: boolean;
}

const ScanBadge = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}>
        <Scan fill={themeColor('text')} width={30} height={30} />
    </TouchableOpacity>
);

@inject('SettingsStore')
@observer
export default class WalletConfiguration extends React.Component<
    WalletConfigurationProps,
    WalletConfigurationState
> {
    state: WalletConfigurationState = {
        node: null,
        nickname: '',
        dismissCustodialWarning: false,
        host: '',
        port: '',
        macaroonHex: '',
        rune: '',
        saved: false,
        index: null as number | null,
        active: false,
        newEntry: false,
        implementation: 'embedded-lnd',
        certVerification: false,
        enableTor: false,
        existingAccount: false,
        suggestImport: '',
        url: '',
        lndhubUrl: '',
        showLndHubModal: false,
        showCertModal: false,
        username: '',
        password: '',
        hidden: true,
        accessKey: '',
        photo: undefined,
        // lnc
        pairingPhrase: '',
        mailboxServer: 'mailbox.terminal.lightning.today:443',
        customMailboxServer: '',
        localKey: '',
        remoteKey: '',
        deletionAwaitingConfirmation: false,
        // embedded lnd
        seedPhrase: [],
        walletPassword: '',
        adminMacaroon: '',
        embeddedLndNetwork: 'mainnet',
        interfaceKeys: [],
        recoveryCipherSeed: '',
        channelBackupsBase64: '',
        creatingWallet: false,
        errorCreatingWallet: false
    };

    scrollViewRef = React.createRef<ScrollView>();

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            if (
                clipboard.includes('lndconnect://') ||
                clipboard.includes('lndhub://') ||
                clipboard.includes('bluewallet:') ||
                clipboard.includes('clnrest://')
            ) {
                this.setState({
                    suggestImport: clipboard
                });
            }
        }
    }

    importClipboard = () => {
        const { suggestImport } = this.state;

        if (suggestImport.includes('lndconnect://')) {
            const { host, port, macaroonHex } =
                ConnectionFormatUtils.processLndConnectUrl(suggestImport);

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
            const { username, password, host } =
                AddressUtils.processLNDHubAddress(suggestImport);

            const existingAccount = !!username;

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
        } else if (suggestImport.includes('clnrest://')) {
            const {
                host,
                rune,
                port,
                enableTor,
                implementation
            }: {
                host: string;
                rune: string;
                port: string;
                enableTor: boolean;
                implementation: Implementations;
            } = ConnectionFormatUtils.processCLNRestConnectUrl(suggestImport);

            this.setState({
                host,
                rune,
                port,
                enableTor,
                implementation,
                suggestImport: ''
            });
        }

        Clipboard.setString('');
    };

    clearImportSuggestion = () => {
        this.setState({
            suggestImport: ''
        });
    };

    async componentDidMount() {
        await this.initFromProps(this.props);

        const { implementation, pairingPhrase } = this.state;
        if (implementation === 'lightning-node-connect') {
            const key = `${LNC_STORAGE_KEY}:${hash(pairingPhrase)}`;
            const json: any = await Storage.getItem(key);
            const parsed = JSON.parse(json);
            if (parsed) {
                if (parsed.localKey && parsed.remoteKey) {
                    this.setState({
                        localKey: parsed.localKey,
                        remoteKey: parsed.remoteKey
                    });
                }
            }
        }

        let interfaceKeys = cloneDeep(INTERFACE_KEYS);

        // remove option to add a new embedded node if initialized already
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { adminMacaroon, newEntry } = this.state;
        if (settings.nodes && newEntry) {
            const result = settings?.nodes?.filter(
                (node) => node.implementation === 'embedded-lnd'
            );
            if (result.length > 0) {
                interfaceKeys = interfaceKeys.filter(
                    (item) => item.value !== 'embedded-lnd'
                );
                if (!adminMacaroon) {
                    this.setState({
                        implementation: 'lnd'
                    });
                }
            }
        }

        this.setState({
            interfaceKeys
        });
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.initFromProps(nextProps);
    }

    async initFromProps(props: WalletConfigurationProps) {
        const { route } = props;

        const node = route.params.node ?? this.state.node;
        const index = route.params.index ?? this.state.index;
        const active = route.params.active ?? this.state.active;
        const tor = route.params.tor ?? this.state.enableTor;
        const saved = route.params.saved ?? this.state.saved;
        const newEntry = route.params.newEntry ?? this.state.newEntry;
        const newPhoto = route.params.photo ?? this.state.photo;

        if (node) {
            const {
                nickname,
                dismissCustodialWarning,
                host,
                port,
                macaroonHex,
                rune,
                url,
                lndhubUrl,
                existingAccount,
                accessKey,
                username,
                password,
                implementation,
                certVerification,
                enableTor,
                photo,
                // LNC
                pairingPhrase,
                mailboxServer,
                customMailboxServer,
                // embedded LND
                seedPhrase,
                walletPassword,
                adminMacaroon,
                embeddedLndNetwork
            } = node as any;

            this.setState({
                node,
                nickname,
                dismissCustodialWarning,
                host,
                port,
                macaroonHex,
                rune,
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
                enableTor: tor || enableTor,
                photo: newPhoto || photo || '',
                // LNC
                pairingPhrase,
                mailboxServer,
                customMailboxServer,
                // embedded LND
                seedPhrase,
                walletPassword,
                adminMacaroon,
                embeddedLndNetwork
            });
        } else {
            this.setState({
                index,
                active,
                newEntry,
                photo: newPhoto || ''
            });
        }
    }

    saveWalletConfiguration = (recoveryCipherSeed?: string) => {
        const { SettingsStore, navigation } = this.props;
        const {
            nickname,
            dismissCustodialWarning,
            host,
            port,
            url,
            enableTor,
            lndhubUrl,
            existingAccount,
            macaroonHex,
            rune,
            accessKey,
            username,
            password,
            implementation,
            certVerification,
            index,
            pairingPhrase,
            mailboxServer,
            customMailboxServer,
            seedPhrase,
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            photo
        } = this.state;
        const { setConnectingStatus, updateSettings, settings } = SettingsStore;

        if (
            implementation === 'lndhub' &&
            (!lndhubUrl || !username || !password)
        ) {
            throw new Error('lndhub settings missing.');
        }

        const node = {
            nickname,
            dismissCustodialWarning,
            host,
            port,
            url,
            lndhubUrl,
            existingAccount,
            macaroonHex,
            rune,
            accessKey,
            username,
            password,
            implementation,
            certVerification,
            enableTor,
            pairingPhrase,
            mailboxServer,
            customMailboxServer,
            seedPhrase,
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            photo
        };

        let nodes: Node[];
        let originalNode: Node;
        if (settings.nodes) {
            nodes = [...settings.nodes];
            if (index != null) {
                originalNode = nodes[index];
                nodes[index] = node;
            } else {
                nodes.push(node);
            }
        } else {
            nodes = [node];
        }

        updateSettings({ nodes }).then(async () => {
            if (recoveryCipherSeed) {
                await updateSettings({
                    recovery: true
                });
            }

            this.setState({
                saved: true
            });

            const activeNodeIndex = settings.selectedNode || 0;
            if (index === activeNodeIndex) {
                // updating active node
                if (originalNode != null) {
                    const diff = differenceBy(
                        Object.entries(originalNode),
                        Object.entries(node),
                        (entry) => entry[0] + entry[1]
                    ).filter(
                        (entry) =>
                            entry[0] !== 'nickname' && entry[0] !== 'photo'
                    );
                    if (diff.length === 0) {
                        // only nickname or photo was edited - no reconnect necessary
                        navigation.goBack();
                        return;
                    }
                }
                if (implementation === 'lightning-node-connect') {
                    BackendUtils.disconnect();
                }
                setConnectingStatus(true);
                navigation.popTo('Wallet', { refresh: true });
            } else {
                navigation.goBack();
            }
        });
    };

    copyNodeConfig = () => {
        const { SettingsStore, navigation } = this.props;
        const { settings } = SettingsStore;
        const {
            nickname,
            host,
            port,
            url,
            enableTor,
            lndhubUrl,
            existingAccount,
            macaroonHex,
            rune,
            accessKey,
            username,
            password,
            implementation,
            certVerification,
            pairingPhrase,
            mailboxServer,
            customMailboxServer,
            photo
        } = this.state;
        const { nodes } = settings;

        const node = {
            nickname: `${nickname} copy`,
            host,
            port,
            url,
            lndhubUrl,
            existingAccount,
            macaroonHex,
            rune,
            accessKey,
            username,
            password,
            implementation,
            certVerification,
            enableTor,
            pairingPhrase,
            mailboxServer,
            customMailboxServer,
            photo
        };

        navigation.navigate('WalletConfiguration', {
            node,
            newEntry: true,
            active: false,
            saved: false,
            index: nodes!.length
        });
    };

    deleteNodeConfig = () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings, settings } = SettingsStore;
        const { index } = this.state;
        const { nodes } = settings;

        const newNodes: any = [];
        for (let i = 0; nodes && i < nodes.length; i++) {
            if (index !== i) {
                newNodes.push(nodes[i]);
            }
        }

        updateSettings({
            nodes: newNodes,
            selectedNode: this.getNewSelectedNodeIndex(index, settings)
        }).then(() => {
            if (newNodes.length === 0) {
                navigation.navigate('IntroSplash');
            } else {
                navigation.popTo('Wallets', { refresh: true });
            }
        });
    };

    getNewSelectedNodeIndex(
        indexOfDeletedNode: number | null,
        settings: Settings
    ): number | undefined {
        if (
            settings.selectedNode == null ||
            indexOfDeletedNode == null ||
            indexOfDeletedNode > settings.selectedNode
        ) {
            return settings.selectedNode;
        }
        if (indexOfDeletedNode < settings.selectedNode) {
            return settings.selectedNode - 1;
        }
        return settings.nodes?.length != null && settings.nodes?.length > 0
            ? 0
            : undefined;
    }

    setWalletConfigurationAsActive = async () => {
        const { SettingsStore, navigation } = this.props;
        const { updateSettings, setConnectingStatus, setInitialStart } =
            SettingsStore;
        const { index } = this.state;

        await updateSettings({
            selectedNode: index
        });

        this.setState({
            active: true
        });

        setConnectingStatus(true);
        setInitialStart(false);

        navigation.popTo('Wallet', { refresh: true });
    };

    createNewWallet = async (network: string = 'Mainnet') => {
        const { recoveryCipherSeed, channelBackupsBase64 } = this.state;

        this.setState({
            creatingWallet: true
        });

        await optimizeNeutrinoPeers(network === 'Testnet');

        const response = await createLndWallet(
            recoveryCipherSeed,
            undefined,
            false,
            network === 'Testnet',
            channelBackupsBase64
        );

        const { wallet, seed, randomBase64 }: any = response;

        if (wallet && wallet.admin_macaroon) {
            this.setState({
                adminMacaroon: wallet.admin_macaroon,
                seedPhrase: seed.cipher_seed_mnemonic,
                walletPassword: randomBase64,
                embeddedLndNetwork: network,
                creatingWallet: false
            });

            this.saveWalletConfiguration(recoveryCipherSeed);
        } else {
            this.setState({
                creatingWallet: false,
                errorCreatingWallet: true
            });
        }
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            node,
            nickname,
            host,
            port,
            url,
            lndhubUrl,
            macaroonHex,
            rune,
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
            photo,
            interfaceKeys,
            existingAccount,
            suggestImport,
            showLndHubModal,
            showCertModal,
            pairingPhrase,
            mailboxServer,
            customMailboxServer,
            localKey,
            remoteKey,
            deletionAwaitingConfirmation,
            adminMacaroon,
            embeddedLndNetwork,
            recoveryCipherSeed,
            channelBackupsBase64,
            creatingWallet,
            errorCreatingWallet
        } = this.state;
        const {
            loading,
            createAccountError,
            createAccountSuccess,
            createAccount,
            seedPhrase
        } = SettingsStore;

        const supportsTor =
            implementation !== 'lightning-node-connect' &&
            implementation !== 'embedded-lnd';
        const supportsCertVerification =
            implementation !== 'lightning-node-connect' &&
            implementation !== 'embedded-lnd';

        const CertInstallInstructions = () => (
            <View style={styles.button}>
                <Button
                    title={localeString(
                        'views.Settings.AddEditNode.certificateButton'
                    )}
                    onPress={() => {
                        this.setState({
                            showCertModal: false
                        });
                        navigation.navigate('CertInstallInstructions');
                    }}
                    secondary
                />
            </View>
        );

        const WalletInterface = () => (
            <DropdownSetting
                title={localeString(
                    'views.Settings.WalletConfiguration.walletInterface'
                )}
                selectedValue={implementation}
                onValueChange={(value: Implementations) => {
                    this.setState({
                        implementation: value,
                        saved: false,
                        certVerification: value === 'lndhub' ? true : false,
                        host: '',
                        lndhubUrl: '',
                        url: ''
                    });
                }}
                values={interfaceKeys}
            />
        );

        const Mailbox = () => {
            return (
                <DropdownSetting
                    title={localeString(
                        'views.Settings.AddEditNode.mailboxServer'
                    )}
                    selectedValue={mailboxServer}
                    onValueChange={(value: string) => {
                        this.setState({
                            mailboxServer: value,
                            saved: false
                        });
                    }}
                    values={LNC_MAILBOX_KEYS}
                />
            );
        };

        const AddPhotos = () => (
            <AddIcon
                fill={themeColor('background')}
                width="14"
                height="14"
                style={{ alignSelf: 'center' }}
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.WalletConfiguration.title'
                        ),
                        style: { ...styles.text, color: themeColor('text') }
                    }}
                    rightComponent={
                        implementation === 'eclair' ? undefined : (
                            <Row>
                                {loading && (
                                    <View style={{ paddingRight: 15 }}>
                                        <LoadingIndicator size={30} />
                                    </View>
                                )}
                                <ScanBadge
                                    onPress={() =>
                                        implementation === 'spark'
                                            ? navigation.navigate(
                                                  'SparkQRScanner',
                                                  {
                                                      index
                                                  }
                                              )
                                            : navigation.navigate(
                                                  'HandleAnythingQRScanner'
                                              )
                                    }
                                />
                            </Row>
                        )
                    }
                    navigation={navigation}
                />
                {!!suggestImport && (
                    <View
                        style={{
                            padding: 10,
                            backgroundColor: themeColor('disabled')
                        }}
                    >
                        <Text style={styles.whiteText}>
                            {localeString(
                                'views.Settings.AddEditNode.connectionStringClipboard'
                            )}
                            :
                        </Text>
                        <Text
                            style={{
                                ...styles.whiteText,
                                padding: 15
                            }}
                        >
                            {suggestImport.length > 100
                                ? `${suggestImport.substring(0, 100)}...`
                                : suggestImport}
                        </Text>
                        <Text style={{ ...styles.whiteText, marginBottom: 10 }}>
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
                                tertiary
                            />
                        </View>
                        <View style={styles.button}>
                            <Button
                                title={localeString('general.cancel')}
                                onPress={() => this.clearImportSuggestion()}
                                tertiary
                            />
                        </View>
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
                                    <Text
                                        style={{
                                            ...styles.blackText,
                                            fontSize: 40
                                        }}
                                    >
                                        {localeString('general.warning')}
                                    </Text>
                                    <Text
                                        style={{
                                            paddingTop: 20,
                                            color: 'black'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.AddEditNode.lndhubWarning'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.blackText,
                                            paddingTop: 20,
                                            paddingBottom: 20,
                                            color: 'black'
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
                                                    if (
                                                        data.login &&
                                                        data.password
                                                    ) {
                                                        this.setState({
                                                            username:
                                                                data.login,
                                                            password:
                                                                data.password,
                                                            existingAccount:
                                                                true
                                                        });
                                                    }

                                                    this.setState({
                                                        showLndHubModal: false
                                                    });
                                                });
                                            }}
                                            secondary
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
                                        />
                                    </View>
                                </>
                            )}
                            {showCertModal && (
                                <>
                                    <Text
                                        style={{
                                            ...styles.blackText,
                                            fontSize: 40
                                        }}
                                    >
                                        {localeString('general.warning')}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.blackText,
                                            paddingTop: 20
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.AddEditNode.certificateWarning1'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.blackText,
                                            paddingTop: 20,
                                            paddingBottom: 20,
                                            color: 'black'
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
                                                'views.Settings.WalletConfiguration.certificateUnderstand'
                                            )}
                                            onPress={() => {
                                                this.saveWalletConfiguration();
                                                this.setState({
                                                    showCertModal: false
                                                });
                                            }}
                                            tertiary
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
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>

                <ScrollView
                    ref={this.scrollViewRef}
                    style={{ flex: 1, paddingLeft: 15, paddingRight: 15 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.form}>
                        {!!createAccountError &&
                            implementation === 'lndhub' &&
                            !loading && (
                                <ErrorMessage message={createAccountError} />
                            )}

                        {!!createAccountSuccess &&
                            implementation === 'lndhub' &&
                            !loading && (
                                <SuccessMessage
                                    message={createAccountSuccess}
                                />
                            )}
                        <View style={styles.container}>
                            <TouchableOpacity
                                onPress={
                                    (!node || !node.photo) && !photo
                                        ? () =>
                                              navigation.navigate(
                                                  'SetWalletPicture',
                                                  { implementation }
                                              )
                                        : () => {
                                              if (node) {
                                                  this.setState({
                                                      node: {
                                                          ...node,
                                                          photo: undefined
                                                      }
                                                  });
                                              }
                                              this.setState(
                                                  {
                                                      photo: undefined,
                                                      saved: false
                                                  },
                                                  () => {
                                                      node
                                                          ? (node.photo = '')
                                                          : null;
                                                  }
                                              );
                                          }
                                }
                            >
                                <View
                                    style={{
                                        ...styles.imageBackground,
                                        backgroundColor:
                                            themeColor('secondaryText')
                                    }}
                                >
                                    {node?.photo || photo ? (
                                        <Image
                                            source={{
                                                uri: getPhoto(
                                                    node?.photo || photo
                                                )
                                            }}
                                            style={styles.imageBackground}
                                        />
                                    ) : (
                                        <AddPhotos />
                                    )}
                                </View>
                            </TouchableOpacity>

                            <View
                                style={{
                                    flex: 1,
                                    marginLeft: 14,
                                    marginTop: -16
                                }}
                            >
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.nickname'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={localeString(
                                        'general.defaultNodeNickname'
                                    )}
                                    value={nickname}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            nickname: text,
                                            saved: false
                                        })
                                    }
                                    locked={loading}
                                />
                            </View>
                        </View>

                        {!adminMacaroon && <WalletInterface />}

                        {!adminMacaroon && implementation === 'embedded-lnd' && (
                            <View>
                                {!adminMacaroon && (
                                    <DropdownSetting
                                        title={localeString('general.network')}
                                        selectedValue={embeddedLndNetwork}
                                        onValueChange={(value: string) => {
                                            this.setState({
                                                embeddedLndNetwork: value
                                            });
                                        }}
                                        values={EMBEDDED_NODE_NETWORK_KEYS}
                                    />
                                )}
                                {false && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {`${localeString(
                                                'views.Settings.AddEditNode.recoveryCipherSeed'
                                            )} (${localeString(
                                                'general.optional'
                                            )})`}
                                        </Text>
                                        <TextInput
                                            placeholder="ship yellow box resource scan pelican..."
                                            value={recoveryCipherSeed}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    recoveryCipherSeed: text
                                                })
                                            }
                                            locked={loading}
                                        />
                                    </>
                                )}
                            </View>
                        )}

                        {!adminMacaroon &&
                            implementation === 'embedded-lnd' &&
                            recoveryCipherSeed && (
                                <View>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {`${localeString(
                                            'views.Settings.AddEditNode.disasterRecoveryBase64'
                                        )} (${localeString(
                                            'general.optional'
                                        )})`}
                                    </Text>
                                    <TextInput
                                        value={channelBackupsBase64}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                channelBackupsBase64: text
                                            })
                                        }
                                        locked={loading}
                                    />
                                </View>
                            )}

                        {(implementation === 'spark' ||
                            implementation == 'eclair') && (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
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
                                    locked={loading}
                                    autoCorrect={false}
                                />

                                {implementation === 'spark' && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
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
                                            locked={loading}
                                        />
                                    </>
                                )}
                                {implementation === 'eclair' && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.AddEditNode.password'
                                            )}
                                        </Text>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <TextInput
                                                placeholder={'...'}
                                                value={password}
                                                onChangeText={(
                                                    text: string
                                                ) => {
                                                    this.setState({
                                                        password: text.trim(),
                                                        saved: false
                                                    });
                                                }}
                                                locked={loading}
                                                secureTextEntry={
                                                    this.state.hidden
                                                }
                                                autoCapitalize="none"
                                                style={{
                                                    flex: 1,
                                                    marginRight: 15
                                                }}
                                            />
                                            <ShowHideToggle
                                                onPress={() =>
                                                    this.setState({
                                                        hidden: !this.state
                                                            .hidden
                                                    })
                                                }
                                            />
                                        </View>
                                    </>
                                )}
                            </>
                        )}
                        {implementation === 'lndhub' && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.host'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'https://'}
                                    value={lndhubUrl}
                                    autoCapitalize="none"
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            lndhubUrl: text.trim(),
                                            saved: false
                                        })
                                    }
                                    locked={loading}
                                    autoCorrect={false}
                                />

                                <>
                                    <Text
                                        style={{
                                            top: 20,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.AddEditNode.existingAccount'
                                        )}
                                    </Text>
                                    <Switch
                                        value={existingAccount}
                                        onValueChange={() =>
                                            this.setState({
                                                existingAccount:
                                                    !existingAccount
                                            })
                                        }
                                    />
                                </>

                                {existingAccount && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
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
                                            locked={loading}
                                            autoCapitalize="none"
                                        />

                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.AddEditNode.password'
                                            )}
                                        </Text>
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <TextInput
                                                placeholder={'...'}
                                                value={password}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        password: text.trim(),
                                                        saved: false
                                                    })
                                                }
                                                locked={loading}
                                                secureTextEntry={
                                                    this.state.hidden
                                                }
                                                autoCapitalize="none"
                                                style={{
                                                    flex: 1,
                                                    marginRight: 15
                                                }}
                                            />
                                            <ShowHideToggle
                                                onPress={() =>
                                                    this.setState({
                                                        hidden: !this.state
                                                            .hidden
                                                    })
                                                }
                                            />
                                        </View>

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
                                                    `@${lndhubUrl}`
                                                }
                                                hideText
                                            />
                                        )}
                                    </>
                                )}
                            </>
                        )}
                        {implementation === 'cln-rest' && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.host'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'localhost'}
                                    autoCapitalize="none"
                                    value={host}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            host: text.trim(),
                                            saved: false
                                        })
                                    }
                                    locked={loading}
                                />

                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.rune'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'Lt1c...'}
                                    value={rune}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            rune: text.trim(),
                                            saved: false
                                        })
                                    }
                                    locked={loading}
                                />

                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
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
                                    locked={loading}
                                />
                            </>
                        )}

                        {(implementation === 'lnd' ||
                            implementation === 'c-lightning-REST') && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.host'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'localhost'}
                                    autoCapitalize="none"
                                    value={host}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            host: text.trim(),
                                            saved: false
                                        })
                                    }
                                    locked={loading}
                                />

                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.macaroon'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'0A...'}
                                    value={macaroonHex}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            macaroonHex: text.replace(
                                                /\s+/g,
                                                ''
                                            ),
                                            saved: false
                                        })
                                    }
                                    locked={loading}
                                />

                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
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
                                    locked={loading}
                                />
                            </>
                        )}

                        {implementation === 'lightning-node-connect' && (
                            <>
                                <Mailbox />
                                {mailboxServer === 'custom-defined' && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.AddEditNode.customMailboxServer'
                                            )}
                                        </Text>
                                        <TextInput
                                            placeholder={
                                                'my-custom.lnc.server:443'
                                            }
                                            value={customMailboxServer}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    customMailboxServer:
                                                        text.trim(),
                                                    saved: false
                                                })
                                            }
                                            locked={loading}
                                        />
                                    </>
                                )}
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.pairingPhrase'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={
                                        'cherry truth mask employ box silver mass bunker fiscal vote'
                                    }
                                    value={pairingPhrase}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            pairingPhrase: text,
                                            saved: false
                                        })
                                    }
                                    locked={loading}
                                />
                                {!!localKey && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            🔒{' '}
                                            {localeString(
                                                'views.Settings.AddEditNode.localKey'
                                            )}
                                        </Text>
                                        <TextInput
                                            value={localKey}
                                            locked={true}
                                        />
                                    </>
                                )}

                                {!!remoteKey && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            🔒{' '}
                                            {localeString(
                                                'views.Settings.AddEditNode.remoteKey'
                                            )}
                                        </Text>
                                        <TextInput
                                            value={remoteKey}
                                            locked={true}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {supportsTor && (
                            <>
                                <Text
                                    style={{
                                        top: 20,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.useTor'
                                    )}
                                </Text>
                                <Switch
                                    value={enableTor}
                                    onValueChange={() =>
                                        this.setState({
                                            enableTor: !enableTor,
                                            saved: false
                                        })
                                    }
                                />
                            </>
                        )}

                        {supportsCertVerification && !enableTor && (
                            <>
                                <Text
                                    style={{
                                        top: 20,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.AddEditNode.certificateVerification'
                                    )}
                                </Text>
                                <Switch
                                    value={certVerification}
                                    onValueChange={() =>
                                        this.setState({
                                            certVerification: !certVerification,
                                            saved: false
                                        })
                                    }
                                />
                            </>
                        )}
                    </View>

                    {!existingAccount && implementation === 'lndhub' && (
                        <View style={{ ...styles.button, marginTop: 20 }}>
                            <Button
                                title={localeString(
                                    'views.Settings.AddEditNode.createLndhub'
                                )}
                                onPress={() => {
                                    if (CUSTODIAL_LNDHUBS.includes(lndhubUrl)) {
                                        this.setState({
                                            showLndHubModal: true
                                        });
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
                                disabled={loading}
                            />
                        </View>
                    )}

                    {implementation === 'embedded-lnd' && adminMacaroon && (
                        <KeyValue
                            keyValue={localeString('general.network')}
                            value={embeddedLndNetwork}
                        />
                    )}

                    {implementation === 'embedded-lnd' &&
                        recoveryCipherSeed && (
                            <WarningMessage
                                message={localeString(
                                    'views.Settings.NodeConfiguration.restoreWarning'
                                )}
                            />
                        )}

                    {active && (
                        <View style={{ alignItems: 'center' }}>
                            <Pill
                                title={localeString(
                                    'views.Settings.WalletConfiguration.walletActive'
                                )}
                                backgroundColor="transparent"
                            />
                        </View>
                    )}

                    {implementation === 'embedded-lnd' && (
                        <View style={{ ...styles.button, marginTop: 20 }}>
                            {!adminMacaroon && !creatingWallet && (
                                <>
                                    <View style={styles.button}>
                                        <Button
                                            title={
                                                embeddedLndNetwork === 'mainnet'
                                                    ? localeString(
                                                          'views.Settings.NodeConfiguration.createMainnetWallet'
                                                      )
                                                    : localeString(
                                                          'views.Settings.NodeConfiguration.createTestnetWallet'
                                                      )
                                            }
                                            onPress={async () => {
                                                await this.createNewWallet(
                                                    embeddedLndNetwork ===
                                                        'mainnet'
                                                        ? undefined
                                                        : 'Testnet'
                                                );
                                            }}
                                            tertiary
                                            disabled={loading}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title={
                                                embeddedLndNetwork === 'mainnet'
                                                    ? localeString(
                                                          'views.Settings.NodeConfiguration.restoreMainnetWallet'
                                                      )
                                                    : localeString(
                                                          'views.Settings.NodeConfiguration.restoreTestnetWallet'
                                                      )
                                            }
                                            onPress={() =>
                                                navigation.navigate(
                                                    'SeedRecovery',
                                                    {
                                                        network:
                                                            embeddedLndNetwork
                                                    }
                                                )
                                            }
                                            secondary
                                            disabled={loading}
                                        />
                                    </View>
                                </>
                            )}
                            {adminMacaroon && seedPhrase && (
                                <Button
                                    title={localeString(
                                        'views.Settings.NodeConfiguration.backUpWallet'
                                    )}
                                    onPress={() => navigation.navigate('Seed')}
                                    secondary
                                    disabled={loading}
                                />
                            )}
                        </View>
                    )}

                    {!creatingWallet &&
                        !(
                            implementation === 'embedded-lnd' && !adminMacaroon
                        ) &&
                        !saved && (
                            <View style={{ ...styles.button }}>
                                <Button
                                    title={localeString(
                                        'views.Settings.WalletConfiguration.saveWallet'
                                    )}
                                    onPress={() => {
                                        if (
                                            !saved &&
                                            !certVerification &&
                                            !enableTor &&
                                            implementation !==
                                                'lightning-node-connect' &&
                                            implementation !== 'embedded-lnd'
                                        ) {
                                            this.setState({
                                                showCertModal: true
                                            });
                                        } else {
                                            this.saveWalletConfiguration();
                                        }
                                    }}
                                    // disable save button if no creds passed
                                    disabled={
                                        loading ||
                                        (implementation === 'lndhub' &&
                                            !(username && password))
                                    }
                                />
                            </View>
                        )}

                    {creatingWallet && <LoadingIndicator />}

                    {errorCreatingWallet && (
                        <ErrorMessage
                            message={localeString(
                                'views.Intro.errorCreatingWallet'
                            )}
                        />
                    )}

                    {!saved && certVerification && !enableTor && (
                        <CertInstallInstructions />
                    )}

                    {saved && !active && !newEntry && (
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.WalletConfiguration.setWalletActive'
                                )}
                                onPress={() =>
                                    this.setWalletConfigurationAsActive()
                                }
                                disabled={loading}
                            />
                        </View>
                    )}

                    {saved && implementation !== 'embedded-lnd' && (
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.WalletConfiguration.duplicateWallet'
                                )}
                                onPress={() => {
                                    /**
                                     * Scrolls to the top of the screen when going to the node config
                                     * page for the copied node. Without this, the user would have to
                                     * manually scroll to the top to edit the copied node properties.
                                     */
                                    this.scrollViewRef.current?.scrollTo({
                                        x: 0,
                                        y: 0,
                                        animated: true
                                    });
                                    this.copyNodeConfig();
                                }}
                                secondary
                                disabled={loading}
                            />
                        </View>
                    )}

                    {implementation !== 'embedded-lnd' && saved && (
                        <View style={styles.button}>
                            <Button
                                title={
                                    deletionAwaitingConfirmation
                                        ? localeString(
                                              'views.Settings.AddEditNode.tapToConfirm'
                                          )
                                        : localeString(
                                              'views.Settings.WalletConfiguration.deleteWallet'
                                          )
                                }
                                onPress={() => {
                                    if (!deletionAwaitingConfirmation) {
                                        this.setState({
                                            deletionAwaitingConfirmation: true
                                        });
                                    } else {
                                        this.deleteNodeConfig();
                                    }
                                }}
                                warning
                                disabled={loading}
                            />
                        </View>
                    )}

                    {implementation === 'embedded-lnd' && !newEntry && (
                        <>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    textAlign: 'center',
                                    marginTop: 20
                                }}
                            >
                                {localeString(
                                    'views.Settings.NodeConfiguration.embeddedDelete'
                                )}
                            </Text>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    textAlign: 'center',
                                    marginTop: 20
                                }}
                            >
                                {localeString(
                                    'views.Settings.NodeConfiguration.embeddedDelete2'
                                )}
                            </Text>
                        </>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    whiteText: {
        color: 'white',
        fontFamily: 'PPNeueMontreal-Book'
    },
    blackText: {
        color: 'black',
        fontFamily: 'PPNeueMontreal-Book'
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5,
        width: '100%'
    },
    pickerWrapper: {
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        height: 50
    },
    button: {
        paddingVertical: 10,
        width: 350,
        alignSelf: 'center'
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
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    imageBackground: {
        width: 50,
        height: 50,
        borderRadius: 24,
        justifyContent: 'center'
    },
    photo: {
        alignSelf: 'center',
        width: 128,
        height: 128,
        borderRadius: 68
    }
});
