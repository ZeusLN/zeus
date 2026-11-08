import * as React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
    Image,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Icon } from '@rneui/themed';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ForwardIcon from '../assets/images/SVG/Caret Right-3.svg';
import Olympus from '../assets/images/SVG/Olympus.svg';
import UpgradeIcon from '../assets/images/SVG/Upgrade.svg';

import Header from '../components/Header';
import ChannelBackupLoadingModal from '../components/Modals/ChannelBackupLoadingModal';
import NodeIdenticon, { NodeTitle } from '../components/NodeIdenticon';
import Screen from '../components/Screen';

import BackendUtils from '../utils/BackendUtils';
import {
    graphDataExists,
    handleExportChannels
} from '../utils/ChannelMigrationUtils';
import {
    blockNavigationDuringWipe,
    clearAllData
} from '../utils/DataClearUtils';
import { localeString } from '../utils/LocaleUtils';
import { getPhoto } from '../utils/PhotoUtils';
import { restartApp } from '../utils/RestartUtils';
import {
    getUpgradeBackgroundColor,
    getUpgradeIntensity,
    themeColor
} from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import CashuStore from '../stores/CashuStore';
import ChannelsStore from '../stores/ChannelsStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore, {
    INTERFACE_KEYS,
    Node as SettingsNode
} from '../stores/SettingsStore';
import SyncStore from '../stores/SyncStore';

import { version } from '../package.json';
import {
    getSettingsItemPlacements,
    MenuSearchItemDefinition,
    SettingsSurface
} from './Menu/searchRegistry';
import {
    buildMenuSearchContext,
    getMatchingSettingsItems,
    getMenuSearchItemLabel,
    getVisibleSettingsSurfaceGroups,
    handleMenuSearchItemPress
} from './Menu/searchUtils';
import { renderSettingsItemIcon } from './Menu/settingsIconUtils';

interface AppMenuProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: any;
    CashuStore: CashuStore;
    ChannelsStore: ChannelsStore;
    LightningAddressStore: LightningAddressStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    SyncStore: SyncStore;
}

interface AppMenuState {
    showHiddenItems: boolean;
    easterEggCount: number;
    searchQuery: string;
    isChannelExporting: boolean;
    channelExportMessage: string;
    isClearingData: boolean;
    graphDataOnDisk: boolean;
}

interface ImplementationDisplayValue {
    [key: string]: string;
}

@inject(
    'CashuStore',
    'ChannelsStore',
    'LightningAddressStore',
    'NodeInfoStore',
    'SettingsStore',
    'SyncStore'
)
@observer
export default class AppMenu extends React.Component<
    AppMenuProps,
    AppMenuState
> {
    state = {
        showHiddenItems: false,
        easterEggCount: 0,
        searchQuery: '',
        isChannelExporting: false,
        channelExportMessage: '',
        isClearingData: false,
        graphDataOnDisk: false
    };

    focusListener: (() => void) | null = null;
    private releaseWipeGuard: (() => void) | null = null;

    getSurface = (): SettingsSurface => {
        const routeName = this.props.route?.name;

        if (routeName === 'Settings') {
            return 'settings';
        }

        if (routeName === 'Tools') {
            return 'tools';
        }

        return 'menu';
    };

    componentDidMount() {
        const { navigation, route } = this.props;
        const surface = this.getSurface();
        this.focusListener = navigation.addListener('focus', this.handleFocus);

        if (surface === 'tools' && route?.params?.showClearDataModal) {
            this.handleClearStorage();
        }

        this.checkGraphDataOnDisk();
    }

    // Fallback for offering channel export when the node isn't running
    // and channels can't be queried
    checkGraphDataOnDisk = async () => {
        const { SettingsStore } = this.props;
        if (SettingsStore.implementation !== 'embedded-lnd') return;

        const graphDataOnDisk = await graphDataExists(
            SettingsStore.lndDir || 'lnd',
            SettingsStore.embeddedLndNetwork === 'Testnet'
        );
        this.setState({ graphDataOnDisk });
    };

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
        this.releaseWipeGuard?.();
    }

    handleFocus = () => {
        this.props.SettingsStore.getSettings();
        this.checkGraphDataOnDisk();
    };

    handleExportChannels = () => {
        const { SettingsStore, NodeInfoStore, SyncStore } = this.props;
        const { isSyncing } = SyncStore;

        if (isSyncing) {
            Alert.alert(
                localeString('general.error'),
                localeString('views.Tools.migration.export.syncInProgress')
            );
            return;
        }

        handleExportChannels({
            // Configs saved before v0.12.3 have no isSqlite and run on
            // Bolt (see writeLndConfig)
            isSqlite: SettingsStore.isSqlite ?? false,
            lndDir: SettingsStore.lndDir || 'lnd',
            // nodeInfo is empty when the node isn't running, so read the
            // network from the persisted wallet config instead
            isTestnet: SettingsStore.embeddedLndNetwork === 'Testnet',
            pubkey: NodeInfoStore.nodeInfo.identity_pubkey,
            seedPhrase: (SettingsStore.seedPhrase || []).join(' '),
            canUploadToOlympus: !!NodeInfoStore.nodeInfo.identity_pubkey,
            setStatus: (msg: string | null) =>
                this.setState({
                    isChannelExporting: msg !== null,
                    channelExportMessage: msg ?? ''
                })
        });
    };

    handleClearStorage = () => {
        Alert.alert(
            localeString('views.Tools.clearStorage.title'),
            localeString('views.Tools.clearStorage.message'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('views.Tools.clearStorage.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        // clearAllData() latches Storage writes as its first
                        // step and nothing releases the latch, so restart
                        // unconditionally (matching Lockscreen's duress paths).
                        this.setState({ isClearingData: true });
                        this.releaseWipeGuard = blockNavigationDuringWipe(
                            this.props.navigation
                        );
                        try {
                            await clearAllData();
                        } catch (error) {
                            console.error('Failed to clear storage:', error);
                        } finally {
                            restartApp();
                        }
                    }
                }
            ]
        );
    };

    render() {
        const {
            navigation,
            CashuStore,
            ChannelsStore,
            LightningAddressStore,
            NodeInfoStore,
            SettingsStore
        } = this.props;
        const surface = this.getSurface();

        const { searchQuery, graphDataOnDisk } = this.state;
        const {
            implementation,
            settings,
            seedPhrase,
            ldkMnemonic,
            isChannelMigrating
        } = SettingsStore;

        const selectedNode: SettingsNode | null =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const implementationDisplayValue: ImplementationDisplayValue = {};
        INTERFACE_KEYS.filter((item) => !item.isHeader).forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        let nodeSubtitle = '';

        if (selectedNode) {
            const nodeImplementation = selectedNode.implementation || '';

            nodeSubtitle +=
                implementationDisplayValue[nodeImplementation] || '';

            if (nodeImplementation === 'embedded-lnd') {
                if (selectedNode.embeddedLndNetwork) {
                    nodeSubtitle += ` (${selectedNode.embeddedLndNetwork})`;
                }
                if (selectedNode.isSqlite) {
                    nodeSubtitle += ' [SQLite]';
                } else {
                    nodeSubtitle += ' [Bolt]';
                }
            }

            if (nodeImplementation === 'ldk-node' && selectedNode.ldkNetwork) {
                nodeSubtitle += ` (${
                    selectedNode.ldkNetwork.charAt(0).toUpperCase() +
                    selectedNode.ldkNetwork.slice(1)
                })`;
            }
        }

        const youveGotSats = LightningAddressStore.paid?.length > 0;
        const textColor = themeColor('text');
        const highlightColor = themeColor('highlight');
        const warningColor = themeColor('warning');
        const secondaryColor = themeColor('secondary');
        const forwardArrowColor = themeColor('secondaryText');

        const hasChannels =
            ChannelsStore.channels.length > 0 ||
            ChannelsStore.pendingChannels.length > 0 ||
            ChannelsStore.closedChannels.length > 0;
        const nodeConnected = !!NodeInfoStore.nodeInfo?.identity_pubkey;
        const canExportChannels = nodeConnected ? hasChannels : graphDataOnDisk;

        const hasLocalSeed =
            BackendUtils.isLocalWallet() && (!!seedPhrase || !!ldkMnemonic);

        const searchContext = buildMenuSearchContext({
            hasSelectedNode: !!selectedNode,
            hasLocalSeed,
            implementation,
            cashuEnabled: !!settings?.ecash?.enableCashu,
            isTestnet: !!NodeInfoStore.testnet,
            supportsOffers: !!NodeInfoStore.supportsOffers,
            supportsListingOffers: !!NodeInfoStore.supportsListingOffers,
            isChannelMigrating: !!isChannelMigrating,
            canExportChannels
        });

        const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
        const isSearching = normalizedSearchQuery.length > 0;

        const groups = getVisibleSettingsSurfaceGroups(searchContext, surface);
        const searchResults =
            surface === 'menu'
                ? getMatchingSettingsItems(searchContext, normalizedSearchQuery)
                : [];

        const cardStyle = {
            backgroundColor: secondaryColor,
            width: '90%' as const,
            borderRadius: 10,
            alignSelf: 'center' as const,
            marginVertical: 5
        };

        const getToneColor = (tone?: 'default' | 'highlight' | 'warning') => {
            if (tone === 'highlight') {
                return highlightColor;
            }

            if (tone === 'warning') {
                return warningColor;
            }

            return textColor;
        };

        const handleItemPress = (item: MenuSearchItemDefinition) =>
            handleMenuSearchItemPress({
                item,
                navigation,
                skipLightningAddressStatus: youveGotSats,
                onClearStorage:
                    item.action === 'clearStorage'
                        ? this.handleClearStorage
                        : undefined,
                onExportChannels: () => this.handleExportChannels()
            });

        const renderSurfaceGroups = () =>
            groups.map((group) => (
                <View key={group.groupId} style={cardStyle}>
                    {group.items.map(({ item, placement }, index) => (
                        <React.Fragment key={`${group.groupId}-${item.id}`}>
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => handleItemPress(item)}
                            >
                                <View style={styles.icon}>
                                    {renderSettingsItemIcon({
                                        iconKey: item.iconKey,
                                        textColor,
                                        highlightColor,
                                        warningColor,
                                        secondaryColor,
                                        youveGotSats
                                    })}
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: getToneColor(placement.tone)
                                    }}
                                >
                                    {getMenuSearchItemLabel(
                                        item,
                                        searchContext
                                    )}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                            {index < group.items.length - 1 && (
                                <View style={styles.separationLine} />
                            )}
                        </React.Fragment>
                    ))}
                </View>
            ));

        const renderMenuTopSection = () => (
            <>
                <View
                    style={[
                        styles.searchFieldContainer,
                        { backgroundColor: secondaryColor }
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
                        style={[styles.searchInput, { color: textColor }]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                    />
                </View>

                {!isSearching && selectedNode && (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Wallets')}
                    >
                        <View
                            style={[
                                styles.selectedNodeContainer,
                                { backgroundColor: secondaryColor }
                            ]}
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
                                        color: textColor,
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {NodeTitle(selectedNode)}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 16,
                                        color: textColor,
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
                )}

                {!isSearching &&
                    selectedNode &&
                    SettingsStore.settings?.ecash?.enableCashu &&
                    CashuStore.totalBalanceSats >= 10_000 &&
                    ChannelsStore.channels.length === 0 &&
                    (() => {
                        const balance = CashuStore.totalBalanceSats;
                        const bgColor =
                            getUpgradeBackgroundColor(
                                secondaryColor,
                                balance
                            ) || secondaryColor;
                        const intensity = getUpgradeIntensity(balance);

                        return (
                            <View
                                style={{
                                    width: '90%',
                                    alignSelf: 'center',
                                    marginVertical: 5,
                                    borderRadius: 10,
                                    backgroundColor: bgColor,
                                    shadowColor: highlightColor,
                                    shadowOpacity: 0.4 + intensity * 0.4,
                                    shadowRadius: 4 + intensity * 8,
                                    shadowOffset: {
                                        width: 0,
                                        height: 0
                                    },
                                    elevation: 4 + intensity * 8
                                }}
                            >
                                <View
                                    style={{
                                        position: 'absolute',
                                        /* eslint-disable zeus/no-negative-layout-offset -- intentional: ring drawn outside the card border */
                                        top: -(1 + intensity * 1.5),
                                        left: -(1 + intensity * 1.5),
                                        right: -(1 + intensity * 1.5),
                                        bottom: -(1 + intensity * 1.5),
                                        /* eslint-enable zeus/no-negative-layout-offset */
                                        borderRadius: 10 + 1 + intensity * 1.5,
                                        borderWidth: 1 + intensity * 1.5,
                                        borderColor: highlightColor
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        CashuStore.showUpgradeModal()
                                    }
                                >
                                    <View style={styles.icon}>
                                        <UpgradeIcon
                                            height={24}
                                            width={24}
                                            stroke={textColor}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: textColor
                                        }}
                                    >
                                        {localeString(
                                            'cashu.upgradePrompt.menuItem'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        );
                    })()}
            </>
        );

        const renderHeader = () => {
            if (surface === 'menu') {
                return (
                    <Header
                        leftComponent="Close"
                        rightComponent={
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToUrl('https://zeuslsp.com')
                                }
                                accessibilityLabel={localeString(
                                    'views.Settings.olympus'
                                )}
                            >
                                <Olympus fill={themeColor('text')} />
                            </TouchableOpacity>
                        }
                        navigation={navigation}
                    />
                );
            }

            return (
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            surface === 'settings'
                                ? 'views.Settings.title'
                                : 'views.Tools.title'
                        ),
                        style: {
                            color: textColor,
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
            );
        };

        return (
            <Screen>
                {renderHeader()}
                <ChannelBackupLoadingModal
                    isOpen={
                        this.state.isChannelExporting ||
                        this.state.isClearingData
                    }
                    message={
                        this.state.isClearingData
                            ? localeString('views.Tools.clearStorage.clearing')
                            : this.state.channelExportMessage
                    }
                />
                <ScrollView
                    style={{
                        flex: 1,
                        marginTop: 10
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {surface === 'menu' && renderMenuTopSection()}

                    {surface === 'menu' && isSearching
                        ? searchResults.map((item) => {
                              const preferredPlacement =
                                  getSettingsItemPlacements(item, 'menu')[0] ||
                                  item.placements?.[0];

                              return (
                                  <View key={item.id} style={cardStyle}>
                                      <TouchableOpacity
                                          style={styles.columnField}
                                          onPress={() => handleItemPress(item)}
                                      >
                                          <View style={styles.icon}>
                                              {renderSettingsItemIcon({
                                                  iconKey: item.iconKey,
                                                  textColor,
                                                  highlightColor,
                                                  warningColor,
                                                  secondaryColor,
                                                  youveGotSats
                                              })}
                                          </View>
                                          <Text
                                              style={{
                                                  ...styles.columnText,
                                                  color: getToneColor(
                                                      preferredPlacement?.tone
                                                  )
                                              }}
                                          >
                                              {getMenuSearchItemLabel(
                                                  item,
                                                  searchContext
                                              )}
                                          </Text>
                                          <View style={styles.ForwardArrow}>
                                              <ForwardIcon
                                                  stroke={forwardArrowColor}
                                              />
                                          </View>
                                      </TouchableOpacity>
                                  </View>
                              );
                          })
                        : renderSurfaceGroups()}

                    {surface === 'menu' && (
                        <TouchableWithoutFeedback
                            onPress={() => {
                                if (!this.state.showHiddenItems) {
                                    this.setState((prevState) => ({
                                        easterEggCount:
                                            prevState.easterEggCount + 1,
                                        showHiddenItems:
                                            prevState.easterEggCount >= 4
                                    }));
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
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    columnField: {
        flex: 1,
        flexDirection: 'row',
        marginVertical: 8,
        alignItems: 'center'
    },
    icon: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center'
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
    selectedNodeContainer: {
        flexDirection: 'row',
        width: '90%',
        borderRadius: 10,
        alignSelf: 'center',
        gap: 12,
        marginBottom: 5,
        paddingLeft: 12,
        paddingVertical: 10,
        alignItems: 'center'
    },
    photo: {
        alignSelf: 'center',
        width: 60,
        height: 60,
        borderRadius: 68
    }
});
