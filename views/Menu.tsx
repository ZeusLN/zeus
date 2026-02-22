import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    Image,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import AddIcon from '../assets/images/SVG/Add.svg';
import BlockIcon from '../assets/images/SVG/Block.svg';
import Bolt12Icon from '../assets/images/SVG/AtSign.svg';
import CoinsIcon from '../assets/images/SVG/Coins.svg';
import ForwardIcon from '../assets/images/SVG/Caret Right-3.svg';
import ContactIcon from '../assets/images/SVG/PeersContact.svg';
import GearIcon from '../assets/images/SVG/Gear.svg';
import MintIcon from '../assets/images/SVG/Mint.svg';
import NodeOn from '../assets/images/SVG/Node On.svg';
import Olympus from '../assets/images/SVG/Olympus.svg';
import KeyIcon from '../assets/images/SVG/Key.svg';
import NetworkIcon from '../assets/images/SVG/Network.svg';
import NostrichIcon from '../assets/images/SVG/Nostrich.svg';
import ReceiveIcon from '../assets/images/SVG/Receive.svg';
import RoutingIcon from '../assets/images/SVG/Routing.svg';
import SwapsIcon from '../assets/images/SVG/Swap.svg';
import WrenchIcon from '../assets/images/SVG/Wrench.svg';
import ZeusPayIcon from '../assets/images/SVG/zeus-pay.svg';

import Header from '../components/Header';
import NodeIdenticon, { NodeTitle } from '../components/NodeIdenticon';
import Screen from '../components/Screen';

import BackendUtils from '../utils/BackendUtils';
import { getPhoto } from '../utils/PhotoUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import SettingsStore, { INTERFACE_KEYS } from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import { version } from '../package.json';

interface MenuProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface MenuState {
    showHiddenItems: boolean;
    easterEggCount: number;
    searchQuery: string;
}

@inject('NodeInfoStore', 'LightningAddressStore', 'SettingsStore', 'UnitsStore')
@observer
export default class Menu extends React.Component<MenuProps, MenuState> {
    state = {
        showHiddenItems: false,
        easterEggCount: 0,
        searchQuery: ''
    };

    focusListener: any = null;

    componentDidMount() {
        const { navigation } = this.props;
        this.focusListener = navigation.addListener('focus', this.handleFocus);
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    handleFocus = () => this.props.SettingsStore.getSettings();

    render() {
        const {
            navigation,
            NodeInfoStore,
            LightningAddressStore,
            SettingsStore
        } = this.props;
        const { showHiddenItems, easterEggCount, searchQuery } = this.state;
        const { implementation, settings, seedPhrase } = SettingsStore;
        const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
        const isSearchMatch = (...terms: string[]) =>
            !normalizedSearchQuery ||
            terms.some((term) =>
                term.toLocaleLowerCase().includes(normalizedSearchQuery)
            );

        // Define the type for implementationDisplayValue
        interface ImplementationDisplayValue {
            [key: string]: string;
        }

        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const implementationDisplayValue: ImplementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const OlympusButton = () => (
            <TouchableOpacity
                onPress={() => UrlUtils.goToUrl('https://zeuslsp.com')}
                accessibilityLabel={localeString('views.Settings.olympus')}
            >
                <Olympus fill={themeColor('text')} />
            </TouchableOpacity>
        );

        let nodeSubtitle = '';

        if (selectedNode) {
            nodeSubtitle +=
                implementationDisplayValue[selectedNode.implementation];

            if (selectedNode.implementation === 'embedded-lnd') {
                if (selectedNode.embeddedLndNetwork) {
                    nodeSubtitle += ` (${selectedNode.embeddedLndNetwork})`;
                }
                if (!selectedNode.isSqlite) {
                    nodeSubtitle += ' [Bolt]';
                }
            }
        }

        const youveGotSats = LightningAddressStore.paid?.length > 0;
        const forwardArrowColor = themeColor('secondaryText');

        const createConnectWalletLabel = localeString(
            'views.Settings.createConnectWallet'
        );
        const walletsLabel = localeString('views.Settings.Wallets.title');
        const settingsLabel = localeString('views.Settings.title');
        const seedLabel = localeString('views.Settings.Seed.title');
        const embeddedNodeLabel = localeString(
            'views.Settings.EmbeddedNode.title'
        );
        const nodeInfoLabel = localeString('views.NodeInfo.title');
        const networkInfoLabel = localeString('views.NetworkInfo.title');
        const mintsLabel = localeString('cashu.cashuMints');
        const lightningAddressLabel = localeString('general.lightningAddress');
        const swapsLabel = localeString('views.Swaps.title');
        const onChainAddressesLabel = localeString(
            'views.OnChainAddresses.title'
        );
        const bolt12AddressLabel = localeString('views.Settings.Bolt12Address');
        const paycodesLabel = localeString('general.paycodes');
        const routingLabel = localeString('general.routing');
        const contactsLabel = localeString('views.Settings.Contacts.contacts');
        const toolsLabel = localeString('views.Tools.title');
        const supportLabel = localeString('views.Settings.Support.title');
        const helpLabel = localeString('general.help');
        const walletTerm = localeString('general.wallet');
        const nodeTerm = localeString('general.node');
        const connectTerm = localeString('views.LnurlChannel.connect');
        const backupTerm = localeString(
            'views.Wallet.BalancePane.backup.title'
        );
        const recoveryTerm = localeString(
            'views.Wallet.BalancePane.recovery.title'
        );
        const bitcoinTerm = localeString('general.bitcoin');
        const networkTerm = localeString('general.network');
        const peersTerm = localeString('general.peers');
        const cashuTerm = localeString('general.cashu');
        const ecashTerm = localeString('general.ecash');
        const swapTerm = localeString('general.swap');
        const addressTerm = localeString('general.address');
        const onChainTerm = localeString('general.onchain');
        const payCodeTerm = localeString('general.paycode');
        const receiveTerm = localeString('general.receive');
        const donateTerm = localeString('views.PaymentRequest.donate');

        const hasSelectedNode = !!selectedNode;
        const hasEmbeddedSeed =
            implementation === 'embedded-lnd' && !!seedPhrase;

        const showCreateConnectWallet =
            !hasSelectedNode &&
            isSearchMatch(
                createConnectWalletLabel,
                walletsLabel,
                walletTerm,
                connectTerm,
                nodeTerm
            );

        const showSettings = isSearchMatch(settingsLabel);

        const showSeed =
            hasEmbeddedSeed &&
            isSearchMatch(seedLabel, backupTerm, recoveryTerm);

        const showEmbeddedNode =
            hasEmbeddedSeed &&
            isSearchMatch(embeddedNodeLabel, nodeTerm, bitcoinTerm);

        const supportsNodeInfoSection =
            hasSelectedNode && BackendUtils.supportsNodeInfo();

        const showNodeInfo =
            supportsNodeInfoSection && isSearchMatch(nodeInfoLabel, nodeTerm);

        const showNetworkInfo =
            supportsNodeInfoSection &&
            BackendUtils.supportsNetworkInfo() &&
            isSearchMatch(networkInfoLabel, networkTerm, peersTerm);

        const showCashuMints =
            hasSelectedNode &&
            BackendUtils.supportsCashuWallet() &&
            !!SettingsStore.settings?.ecash?.enableCashu &&
            isSearchMatch(mintsLabel, cashuTerm, ecashTerm);

        const showLightningAddress =
            hasSelectedNode &&
            BackendUtils.supportsCustomPreimages() &&
            !NodeInfoStore.testnet &&
            isSearchMatch(
                lightningAddressLabel,
                localeString('general.lightningAddressCondensed')
            );

        const showSwaps =
            hasSelectedNode && isSearchMatch(swapsLabel, swapTerm);

        const showOnChainAddresses =
            BackendUtils.supportsAddressesWithDerivationPaths() &&
            isSearchMatch(onChainAddressesLabel, addressTerm, onChainTerm);

        const showBolt12Address =
            hasSelectedNode &&
            !!NodeInfoStore.supportsOffers &&
            isSearchMatch(bolt12AddressLabel);

        const showPaycodes =
            hasSelectedNode &&
            !!NodeInfoStore.supportsOffers &&
            isSearchMatch(paycodesLabel, payCodeTerm, receiveTerm);

        const showRouting =
            hasSelectedNode &&
            BackendUtils.supportsRouting() &&
            isSearchMatch(routingLabel);

        const showContacts =
            hasSelectedNode && isSearchMatch(contactsLabel, addressTerm);

        const showTools = isSearchMatch(toolsLabel);

        const showSupport = isSearchMatch(supportLabel, donateTerm);

        const showHelp = isSearchMatch(helpLabel);

        return (
            <Screen>
                <Header
                    leftComponent="Close"
                    rightComponent={<OlympusButton />}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        marginTop: 10
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View
                        style={[
                            styles.searchFieldContainer,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <Icon
                            name="search"
                            color={themeColor('secondaryText')}
                            underlayColor="transparent"
                            size={19}
                        />
                        <TextInput
                            value={searchQuery}
                            onChangeText={(value) =>
                                this.setState({ searchQuery: value })
                            }
                            placeholder={localeString('general.search')}
                            placeholderTextColor={themeColor('secondaryText')}
                            style={[
                                styles.searchInput,
                                { color: themeColor('text') }
                            ]}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                        />
                    </View>

                    {selectedNode ? (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Wallets')}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    gap: 12,
                                    marginBottom: 5,
                                    paddingLeft: 12,
                                    paddingVertical: 10,
                                    alignItems: 'center'
                                }}
                            >
                                {selectedNode.photo ? (
                                    <Image
                                        source={{
                                            uri: getPhoto(selectedNode.photo)
                                        }}
                                        style={styles.photo}
                                    />
                                ) : (
                                    <NodeIdenticon
                                        selectedNode={selectedNode}
                                        width={50}
                                        rounded
                                    />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={{
                                            fontSize: 20,
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {NodeTitle(selectedNode)}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 16,
                                            color: themeColor('text'),
                                            opacity: 0.6,
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {nodeSubtitle}
                                    </Text>
                                </View>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : showCreateConnectWallet ? (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('WalletConfiguration', {
                                        newEntry: true,
                                        index: 0
                                    })
                                }
                            >
                                <View style={styles.icon}>
                                    <AddIcon
                                        fill={themeColor('highlight')}
                                        width={18}
                                        height={18}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('highlight')
                                    }}
                                >
                                    {createConnectWalletLabel}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {showSettings && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => {
                                    navigation.navigate('Settings');
                                }}
                            >
                                <View style={styles.icon}>
                                    <GearIcon
                                        fill={themeColor('text')}
                                        width={25}
                                        height={25}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {settingsLabel}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {(showSeed || showEmbeddedNode) && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            {showSeed && (
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() => navigation.navigate('Seed')}
                                >
                                    <View style={styles.icon}>
                                        <KeyIcon
                                            fill={themeColor('text')}
                                            width={27}
                                            height={27}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {seedLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            )}

                            {showSeed && showEmbeddedNode && (
                                <View style={styles.separationLine} />
                            )}

                            {showEmbeddedNode && (
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate(
                                            'EmbeddedNodeSettings'
                                        )
                                    }
                                >
                                    <View style={styles.icon}>
                                        <BlockIcon
                                            color={themeColor('text')}
                                            width={27}
                                            height={27}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {embeddedNodeLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {(showNodeInfo || showNetworkInfo) && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            {showNodeInfo && (
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate('NodeInfo')
                                    }
                                >
                                    <View style={styles.icon}>
                                        <NodeOn color={themeColor('text')} />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {nodeInfoLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            )}

                            {showNodeInfo && showNetworkInfo && (
                                <View style={styles.separationLine} />
                            )}

                            {showNetworkInfo && (
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate('NetworkInfo')
                                    }
                                >
                                    <View style={styles.icon}>
                                        <NetworkIcon
                                            fill={themeColor('text')}
                                            width={24}
                                            height={24}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {networkInfoLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {showCashuMints && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Mints')}
                            >
                                <View style={styles.icon}>
                                    <MintIcon
                                        height={24}
                                        width={24}
                                        fill={themeColor('text')}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {mintsLabel}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showLightningAddress && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('LightningAddress', {
                                        skipStatus: youveGotSats
                                    })
                                }
                            >
                                <View style={styles.icon}>
                                    <ZeusPayIcon
                                        height={19.25}
                                        width={22}
                                        fill={
                                            youveGotSats
                                                ? themeColor('highlight')
                                                : themeColor('text')
                                        }
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {lightningAddressLabel}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                    {showSwaps && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Swaps')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <SwapsIcon
                                            fill={themeColor('text')}
                                            height={25}
                                            width={25}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {swapsLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showOnChainAddresses && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('OnChainAddresses')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <CoinsIcon
                                            fill={themeColor('text')}
                                            height={30}
                                            width={30}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {onChainAddressesLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showBolt12Address && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('Bolt12Address')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View>
                                        <Bolt12Icon
                                            fill={themeColor('text')}
                                            width={48}
                                            height={30}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {bolt12AddressLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showPaycodes && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginTop: 5,
                                marginBottom: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('PayCodes')}
                            >
                                <View style={styles.columnField}>
                                    <View>
                                        <ReceiveIcon
                                            fill={themeColor('text')}
                                            width={48}
                                            height={30}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {paycodesLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showRouting && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Routing')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <RoutingIcon
                                            stroke={themeColor('text')}
                                            fill={themeColor('text')}
                                            width={27}
                                            height={27}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {routingLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showContacts && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Contacts')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <ContactIcon
                                            fill={themeColor('text')}
                                            width={27}
                                            height={27}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {contactsLabel}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {false && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Nostr')}
                            >
                                <View style={styles.icon}>
                                    <NostrichIcon
                                        fill={themeColor('text')}
                                        width={23}
                                        height={23}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    Nostr
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showTools && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => {
                                    navigation.navigate('Tools');
                                }}
                            >
                                <View style={styles.icon}>
                                    <WrenchIcon
                                        fill={themeColor('text')}
                                        width={25}
                                        height={25}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {toolsLabel}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showSupport && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Support')}
                            >
                                <View style={styles.icon}>
                                    <Icon
                                        name="favorite"
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={23}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {supportLabel}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showHelp && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('Help')}
                            >
                                <View style={styles.icon}>
                                    <Icon
                                        name="support"
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={23}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {helpLabel}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                    <TouchableWithoutFeedback
                        onPress={() => {
                            if (!showHiddenItems) {
                                this.setState({
                                    easterEggCount: easterEggCount + 1,
                                    showHiddenItems: easterEggCount >= 4
                                });
                            }
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 16,
                                color: themeColor('secondaryText'),
                                alignSelf: 'center',
                                fontFamily: 'PPNeueMontreal-Book',
                                marginTop: 5,
                                marginBottom: 10
                            }}
                        >
                            {`ZEUS v${version}`}
                        </Text>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    searchFieldContainer: {
        width: '90%',
        alignSelf: 'center',
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginBottom: 6
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        marginLeft: 8,
        paddingVertical: 10
    },
    columnField: {
        flex: 1,
        flexDirection: 'row',
        marginVertical: 8,
        alignItems: 'center'
    },
    icon: {
        width: 50,
        alignItems: 'center'
    },
    photo: {
        alignSelf: 'center',
        width: 60,
        height: 60,
        borderRadius: 68
    },
    columnText: {
        fontSize: 16,
        flex: 1,
        fontFamily: 'PPNeueMontreal-Book'
    },
    separationLine: {
        borderColor: '#A7A9AC',
        opacity: 0.2,
        borderWidth: 0.5,
        marginLeft: 50,
        marginRight: 40
    },
    ForwardArrow: {
        alignItems: 'flex-end',
        padding: 6,
        marginRight: 6
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        width: 100
    },
    pickerDark: {
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
