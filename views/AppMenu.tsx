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
import { StackNavigationProp } from '@react-navigation/stack';

import ForwardIcon from '../assets/images/SVG/Caret Right-3.svg';
import Olympus from '../assets/images/SVG/Olympus.svg';
import UpgradeIcon from '../assets/images/SVG/Upgrade.svg';

import Header from '../components/Header';
import NodeIdenticon, { NodeTitle } from '../components/NodeIdenticon';
import Screen from '../components/Screen';

import { clearAllData } from '../utils/DataClearUtils';
import { localeString } from '../utils/LocaleUtils';
import { getPhoto } from '../utils/PhotoUtils';
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
import SettingsStore, { INTERFACE_KEYS } from '../stores/SettingsStore';

import { version } from '../package.json';
import {
    getSettingsItemPlacements,
    MenuSearchItemDefinition,
    SettingsSurface
} from './Menu/searchRegistry';
import {
    buildMenuSearchContext,
    getMatchingSettingsItems,
    getVisibleSettingsSurfaceGroups,
    handleMenuSearchItemPress
} from './Menu/searchUtils';
import { renderSettingsItemIcon } from './Menu/settingsIconUtils';
import RNRestart from 'react-native-restart';

interface AppMenuProps {
    navigation: StackNavigationProp<any, any>;
    route?: any;
    surface: SettingsSurface;
    CashuStore?: CashuStore;
    ChannelsStore?: ChannelsStore;
    LightningAddressStore?: LightningAddressStore;
    NodeInfoStore?: NodeInfoStore;
    SettingsStore?: SettingsStore;
}

interface AppMenuState {
    showHiddenItems: boolean;
    easterEggCount: number;
    searchQuery: string;
}

@inject(
    'CashuStore',
    'ChannelsStore',
    'LightningAddressStore',
    'NodeInfoStore',
    'SettingsStore'
)
@observer
export default class AppMenu extends React.Component<
    AppMenuProps,
    AppMenuState
> {
    state = {
        showHiddenItems: false,
        easterEggCount: 0,
        searchQuery: ''
    };

    focusListener: any = null;

    componentDidMount() {
        const { navigation, surface, route } = this.props;
        this.focusListener = navigation.addListener('focus', this.handleFocus);

        if (surface === 'tools' && route?.params?.showClearDataModal) {
            this.handleClearStorage();
        }
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    handleFocus = () => this.props.SettingsStore?.getSettings();

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
                        try {
                            await clearAllData();
                            RNRestart.Restart();
                        } catch (error) {
                            console.error('Failed to clear storage:', error);
                            Alert.alert(
                                localeString('general.error'),
                                localeString('views.Tools.clearStorage.error')
                            );
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
            SettingsStore,
            surface
        } = this.props;

        if (
            !CashuStore ||
            !ChannelsStore ||
            !LightningAddressStore ||
            !NodeInfoStore ||
            !SettingsStore
        ) {
            return null;
        }

        const { showHiddenItems, easterEggCount, searchQuery } = this.state;
        const { implementation, settings, seedPhrase } = SettingsStore;

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
        const warningColor = themeColor('warning');
        const secondaryColor = themeColor('secondary');
        const forwardArrowColor = themeColor('secondaryText');

        const searchContext = buildMenuSearchContext({
            hasSelectedNode: !!selectedNode,
            hasEmbeddedSeed: implementation === 'embedded-lnd' && !!seedPhrase,
            implementation,
            cashuEnabled: !!settings?.ecash?.enableCashu,
            isTestnet: !!NodeInfoStore.testnet,
            supportsOffers: !!NodeInfoStore.supportsOffers
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
                        : undefined
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
                                    {localeString(item.labelKey)}
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

        const renderMenuHeader = () => (
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
                            style={{
                                flexDirection: 'row',
                                backgroundColor: secondaryColor,
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
                                        top: -(1 + intensity * 1.5),
                                        left: -(1 + intensity * 1.5),
                                        right: -(1 + intensity * 1.5),
                                        bottom: -(1 + intensity * 1.5),
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
                <ScrollView
                    style={{
                        flex: 1,
                        marginTop: 10
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {surface === 'menu' && renderMenuHeader()}

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
                        : renderSurfaceGroups()}

                    {surface === 'menu' && (
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
    photo: {
        alignSelf: 'center',
        width: 60,
        height: 60,
        borderRadius: 68
    }
});
