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
import UpgradeIcon from '../assets/images/SVG/Upgrade.svg';
import NetworkIcon from '../assets/images/SVG/Network.svg';
import ReceiveIcon from '../assets/images/SVG/Receive.svg';
import RoutingIcon from '../assets/images/SVG/Routing.svg';
import SwapsIcon from '../assets/images/SVG/Swap.svg';
import WrenchIcon from '../assets/images/SVG/Wrench.svg';
import ZeusPayIcon from '../assets/images/SVG/zeus-pay.svg';

import Header from '../components/Header';
import NodeIdenticon, { NodeTitle } from '../components/NodeIdenticon';
import Screen from '../components/Screen';

import { getPhoto } from '../utils/PhotoUtils';
import { localeString } from '../utils/LocaleUtils';
import {
    themeColor,
    getUpgradeBackgroundColor,
    getUpgradeIntensity
} from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';
import { settingsListStyleDefinitions } from '../utils/settingsListStyleDefinitions';

import CashuStore from '../stores/CashuStore';
import ChannelsStore from '../stores/ChannelsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import SettingsStore, { INTERFACE_KEYS } from '../stores/SettingsStore';

import { version } from '../package.json';
import { MENU_SEARCH_ITEMS, getMenuSearchItem } from './Menu/searchRegistry';
import {
    buildMenuSearchContext,
    doesMenuSearchItemMatch,
    handleMenuSearchItemPress
} from './Menu/searchUtils';

interface MenuProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
}

interface MenuState {
    showHiddenItems: boolean;
    easterEggCount: number;
    searchQuery: string;
}

interface MenuRowDefinition {
    itemId: string;
    icon: React.ReactNode;
    textColor?: string;
}

@inject(
    'CashuStore',
    'ChannelsStore',
    'NodeInfoStore',
    'LightningAddressStore',
    'SettingsStore'
)
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
            CashuStore,
            ChannelsStore,
            NodeInfoStore,
            LightningAddressStore,
            SettingsStore
        } = this.props;
        const { showHiddenItems, easterEggCount, searchQuery } = this.state;
        const { implementation, settings, seedPhrase } = SettingsStore;

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
        const textColor = themeColor('text');
        const highlightColor = themeColor('highlight');
        const forwardArrowColor = themeColor('secondaryText');

        const hasSelectedNode = !!selectedNode;
        const searchContext = buildMenuSearchContext({
            hasSelectedNode,
            hasEmbeddedSeed: implementation === 'embedded-lnd' && !!seedPhrase,
            cashuEnabled: !!settings?.ecash?.enableCashu,
            isTestnet: !!NodeInfoStore.testnet,
            supportsOffers: !!NodeInfoStore.supportsOffers
        });

        const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
        const isSearching = normalizedSearchQuery.length > 0;

        const menuCards: MenuRowDefinition[][] = [
            [
                {
                    itemId: 'create-wallet',
                    icon: (
                        <AddIcon fill={highlightColor} width={18} height={18} />
                    ),
                    textColor: highlightColor
                }
            ],
            [
                {
                    itemId: 'settings',
                    icon: <GearIcon fill={textColor} width={25} height={25} />
                }
            ],
            [
                {
                    itemId: 'seed',
                    icon: <KeyIcon fill={textColor} width={27} height={27} />
                },
                {
                    itemId: 'embedded-node',
                    icon: <BlockIcon color={textColor} width={27} height={27} />
                }
            ],
            [
                {
                    itemId: 'node-info',
                    icon: <NodeOn color={textColor} />
                },
                {
                    itemId: 'network-info',
                    icon: (
                        <NetworkIcon fill={textColor} width={24} height={24} />
                    )
                }
            ],
            [
                {
                    itemId: 'mints',
                    icon: <MintIcon fill={textColor} width={24} height={24} />
                }
            ],
            [
                {
                    itemId: 'lightning-address',
                    icon: (
                        <ZeusPayIcon
                            height={19.25}
                            width={22}
                            fill={youveGotSats ? highlightColor : textColor}
                        />
                    )
                }
            ],
            [
                {
                    itemId: 'swaps',
                    icon: <SwapsIcon fill={textColor} height={25} width={25} />
                }
            ],
            [
                {
                    itemId: 'onchain-addresses',
                    icon: <CoinsIcon fill={textColor} height={30} width={30} />
                }
            ],
            [
                {
                    itemId: 'bolt12-address',
                    icon: <Bolt12Icon fill={textColor} width={48} height={30} />
                }
            ],
            [
                {
                    itemId: 'paycodes',
                    icon: (
                        <ReceiveIcon fill={textColor} width={48} height={30} />
                    )
                }
            ],
            [
                {
                    itemId: 'routing',
                    icon: (
                        <RoutingIcon
                            stroke={textColor}
                            fill={textColor}
                            width={27}
                            height={27}
                        />
                    )
                }
            ],
            [
                {
                    itemId: 'contacts',
                    icon: (
                        <ContactIcon fill={textColor} width={27} height={27} />
                    )
                }
            ],
            [
                {
                    itemId: 'tools',
                    icon: <WrenchIcon fill={textColor} width={25} height={25} />
                }
            ],
            [
                {
                    itemId: 'support',
                    icon: (
                        <Icon
                            name="favorite"
                            color={textColor}
                            underlayColor="transparent"
                            size={23}
                        />
                    )
                }
            ],
            [
                {
                    itemId: 'help',
                    icon: (
                        <Icon
                            name="support"
                            color={textColor}
                            underlayColor="transparent"
                            size={23}
                        />
                    )
                }
            ]
        ];

        const menuRowsById = menuCards.flat().reduce((a, x) => {
            a[x.itemId] = x;
            return a;
        }, {} as Record<string, MenuRowDefinition>);

        const searchResults = MENU_SEARCH_ITEMS.filter(
            (item) =>
                item.action !== 'clearStorage' &&
                item.isVisible(searchContext) &&
                doesMenuSearchItemMatch(item, normalizedSearchQuery)
        );

        const cardStyle = {
            backgroundColor: themeColor('secondary'),
            width: '90%' as const,
            borderRadius: 10,
            alignSelf: 'center' as const,
            marginVertical: 5
        };

        const onPressItem = (itemId: string) => {
            const item = getMenuSearchItem(itemId);
            if (!item) {
                return;
            }

            handleMenuSearchItemPress({
                item,
                navigation,
                skipLightningAddressStatus: youveGotSats
            });
        };

        const renderRows = (rows: MenuRowDefinition[]) => {
            const visibleRows = rows.filter((row) => {
                const item = getMenuSearchItem(row.itemId);
                if (!item || !item.isVisible(searchContext)) {
                    return false;
                }

                return !isSearching;
            });

            if (!visibleRows.length) {
                return null;
            }

            return (
                <View
                    key={visibleRows.map((row) => row.itemId).join('-')}
                    style={cardStyle}
                >
                    {visibleRows.map((row, index) => {
                        const item = getMenuSearchItem(row.itemId);
                        if (!item) {
                            return null;
                        }

                        return (
                            <React.Fragment key={row.itemId}>
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() => onPressItem(row.itemId)}
                                >
                                    <View style={styles.icon}>{row.icon}</View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: row.textColor || textColor
                                        }}
                                    >
                                        {localeString(item.labelKey)}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                                {index < visibleRows.length - 1 && (
                                    <View style={styles.separationLine} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </View>
            );
        };

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
                            style={[styles.searchInput, { color: textColor }]}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                        />
                    </View>

                    {!isSearching && hasSelectedNode && (
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
                                    themeColor('secondary'),
                                    balance
                                ) || themeColor('secondary');
                            const t = getUpgradeIntensity(balance);
                            return (
                                <View
                                    style={{
                                        width: '90%',
                                        alignSelf: 'center',
                                        marginVertical: 5,
                                        borderRadius: 10,
                                        backgroundColor: bgColor,
                                        shadowColor: themeColor('highlight'),
                                        shadowOpacity: 0.4 + t * 0.4,
                                        shadowRadius: 4 + t * 8,
                                        shadowOffset: {
                                            width: 0,
                                            height: 0
                                        },
                                        elevation: 4 + t * 8
                                    }}
                                >
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: -(1 + t * 1.5),
                                            left: -(1 + t * 1.5),
                                            right: -(1 + t * 1.5),
                                            bottom: -(1 + t * 1.5),
                                            borderRadius: 10 + 1 + t * 1.5,
                                            borderWidth: 1 + t * 1.5,
                                            borderColor: themeColor('highlight')
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
                                                stroke={themeColor('text')}
                                            />
                                        </View>
                                        <Text
                                            style={{
                                                ...styles.columnText,
                                                color: themeColor('text')
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

                    {isSearching
                        ? searchResults.map((item) => {
                              const mappedRow = menuRowsById[item.id];

                              return (
                                  <View key={item.id} style={cardStyle}>
                                      <TouchableOpacity
                                          style={styles.columnField}
                                          onPress={() => onPressItem(item.id)}
                                      >
                                          <View style={styles.icon}>
                                              {mappedRow ? (
                                                  mappedRow.icon
                                              ) : (
                                                  <Icon
                                                      name="search"
                                                      color={textColor}
                                                      underlayColor="transparent"
                                                      size={20}
                                                  />
                                              )}
                                          </View>
                                          <Text
                                              style={{
                                                  ...styles.columnText,
                                                  color: textColor
                                              }}
                                          >
                                              {localeString(item.labelKey)}
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
                        : menuCards.map((rows) => renderRows(rows))}

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
    ...settingsListStyleDefinitions,
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
    photo: {
        alignSelf: 'center',
        width: 60,
        height: 60,
        borderRadius: 68
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
