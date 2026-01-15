import React, { Component } from 'react';
import {
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    I18nManager
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    ZoomOut,
    SlideInDown,
    SlideOutUp,
    LinearTransition
} from 'react-native-reanimated';
import LinearGradient from '../LinearGradient';
import { StackNavigationProp } from '@react-navigation/stack';
import BigNumber from 'bignumber.js';

import { inject, observer } from 'mobx-react';
import Amount from '../Amount';
import Button from '../Button';
import { Spacer } from '../layout/Spacer';
import LightningSwipeableRow from './LightningSwipeableRow';
import OnchainSwipeableRow from './OnchainSwipeableRow';
import EcashSwipeableRow from './EcashSwipeableRow';
import { Row as LayoutRow } from '../layout/Row';
import Pill from '../Pill';

import { balanceStore, cashuStore, utxosStore } from '../../stores/Stores';

import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import UnitsStore from '../../stores/UnitsStore';
import UTXOsStore from '../../stores/UTXOsStore';
import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { blendHexColors, themeColor } from '../../utils/ThemeUtils';

import EyeClosed from '../../assets/images/SVG/eye_closed.svg';
import EyeOpened from '../../assets/images/SVG/eye_opened.svg';
import EcashSvg from '../../assets/images/SVG/DynamicSVG/EcashSvg';
import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import MatiSvg from '../../assets/images/SVG/DynamicSVG/MatiSvg';

interface LayerBalancesProps {
    BalanceStore?: BalanceStore;
    CashuStore?: CashuStore;
    SettingsStore?: SettingsStore;
    UTXOsStore?: UTXOsStore;
    UnitsStore?: UnitsStore;
    navigation: StackNavigationProp<any, any>;
    onRefresh?: any;
    value?: string;
    satAmount?: string;
    lightning?: string;
    offer?: string;
    locked?: boolean;
    consolidated?: boolean;
    editMode?: boolean;
    needsConfig?: boolean;
    refreshing?: boolean;
    collapsed?: boolean;
}

//  To toggle LTR/RTL change to `true`
I18nManager.allowRTL(false);

type MintInfo = {
    url: string;
    iconUrl?: string;
    name?: string;
};

type DataRow = {
    layer: string;
    subtitle?: string;
    balance: string | number;
    // TODO check if exists
    count?: number;
    watchOnly?: boolean;
    custodial?: boolean;
    needsConfig?: boolean;
    hidden?: boolean;
    mints?: MintInfo[];
    collapsed?: boolean;
};

const getEcashRowColors = () => {
    try {
        // Ensure cashuStore and totalBalanceSats are available
        if (
            !cashuStore ||
            cashuStore.totalBalanceSats === undefined ||
            cashuStore.totalBalanceSats === null
        ) {
            console.warn(
                'getEcashRowColors: Cashu store or totalBalanceSats not available.'
            );
            return false;
        }

        const balanceSats = new BigNumber(cashuStore.totalBalanceSats);

        // Check if balanceSats is a valid number
        if (balanceSats.isNaN()) {
            console.warn(
                'getEcashRowColors: Invalid balanceSats value:',
                cashuStore.totalBalanceSats
            );
            return false;
        }

        const ratio = balanceSats.div(100_000).toNumber();
        const buttonBg =
            themeColor('buttonBackground') ||
            themeColor('buttonGradient') ||
            themeColor('secondary');
        const warningColor = themeColor('warning');
        const errorColor = themeColor('error');

        // Ensure theme colors are valid
        if (!buttonBg || !warningColor || !errorColor) {
            console.warn('getEcashRowColors: Theme color missing.');
            return false;
        }

        const blend = blendHexColors(buttonBg, warningColor, ratio);

        if (balanceSats.gte(10_000)) {
            return [blend, errorColor];
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error calculating Ecash row colors:', error);
        return false; // Return default value in case of any error
    }
};

const MintIcons = ({ mints }: { mints?: MintInfo[] }) => {
    if (!mints || mints.length === 0) return null;

    const displayMints = mints.slice(0, 3);
    const remainingCount = mints.length - 3;

    return (
        <View style={styles.mintIconsContainer}>
            {displayMints.map((mint, index) => (
                <View
                    key={mint.url}
                    style={[
                        styles.mintIconWrapper,
                        { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index }
                    ]}
                >
                    {mint.iconUrl ? (
                        <Image
                            source={{ uri: mint.iconUrl }}
                            style={styles.mintIcon}
                        />
                    ) : (
                        <View style={styles.mintIconPlaceholder}>
                            <Text style={styles.mintIconPlaceholderText}>
                                {mint.name?.[0]?.toUpperCase() || 'M'}
                            </Text>
                        </View>
                    )}
                </View>
            ))}
            {remainingCount > 0 && (
                <Text
                    style={{
                        ...styles.layerText,
                        color: themeColor('buttonText'),
                        marginLeft: 4
                    }}
                >
                    +{remainingCount}
                </Text>
            )}
        </View>
    );
};

const Row = ({ item }: { item: DataRow }) => {
    const moreAccounts =
        item.layer === localeString('components.LayerBalances.moreAccounts');
    const collapseBalances =
        item.layer ===
        localeString('components.LayerBalances.collapseBalances');
    const miniRow = moreAccounts || collapseBalances;
    const ecashRowColors = getEcashRowColors();
    const isEcash = item.layer === 'Ecash';

    const gradientColors =
        isEcash && ecashRowColors
            ? ecashRowColors
            : themeColor('buttonGradient')
            ? themeColor('buttonGradient')
            : themeColor('buttonBackground')
            ? [themeColor('buttonBackground'), themeColor('buttonBackground')]
            : [themeColor('secondary'), themeColor('secondary')];

    const finalGradientColors = collapseBalances
        ? [themeColor('secondary'), themeColor('secondary')]
        : gradientColors;

    return (
        <LinearGradient
            colors={finalGradientColors}
            style={[styles.rectButton, miniRow && { height: 40 }]}
        >
            <View style={styles.left}>
                {!miniRow && (
                    <LayerIcon
                        layer={item.layer}
                        watchOnly={item.watchOnly}
                        size={70}
                    />
                )}
                <Spacer width={5} />
                <View
                    style={{
                        flexDirection: 'column',
                        left: miniRow ? 5 : 0,
                        flex: 1
                    }}
                >
                    <Text
                        style={{
                            ...styles.layerText,
                            color: collapseBalances
                                ? themeColor('text')
                                : themeColor('buttonText') || themeColor('text')
                        }}
                    >
                        {item.layer === 'Lightning'
                            ? localeString('general.lightning')
                            : item.layer === 'On-chain'
                            ? localeString('general.onchain')
                            : item.layer}
                    </Text>
                    {item.subtitle && (
                        <Text
                            style={{
                                ...styles.layerText,
                                color: collapseBalances
                                    ? themeColor('text')
                                    : themeColor('buttonTextSecondary') ||
                                      themeColor('secondaryText')
                            }}
                        >
                            {item.subtitle}
                        </Text>
                    )}
                    {/* Show mint icons for Ecash row */}
                    {isEcash && !item.needsConfig && item.mints && (
                        <MintIcons mints={item.mints} />
                    )}
                    {/* Show custodial pill for non-Ecash custodial rows */}
                    {item.custodial && !isEcash && !item.needsConfig && (
                        <View style={styles.pill}>
                            <Pill
                                title={localeString(
                                    'general.custodialWallet'
                                ).toUpperCase()}
                                textColor={themeColor('highlight')}
                                height={25}
                                scrollOnOverflow={true}
                            />
                        </View>
                    )}
                    {item.needsConfig && (
                        <View style={styles.pill}>
                            <Pill
                                title={localeString(
                                    'cashu.tapToConfigure'
                                ).toUpperCase()}
                                textColor={themeColor('highlight')}
                                borderColor={themeColor('highlight')}
                                scrollOnOverflow={true}
                                height={25}
                            />
                        </View>
                    )}
                </View>
            </View>

            {collapseBalances ? null : !moreAccounts ? (
                <>
                    {!item.needsConfig && (
                        <View style={styles.rightContent}>
                            <Amount
                                sats={item.balance}
                                sensitive
                                colorOverride={themeColor('buttonText')}
                            />
                            {/* Show custodial pill below balance for Ecash */}
                            {isEcash && item.custodial && (
                                <View style={styles.pillRight}>
                                    <Pill
                                        title={localeString(
                                            'general.custodialWallet'
                                        ).toUpperCase()}
                                        textColor={themeColor('highlight')}
                                        height={25}
                                        scrollOnOverflow={true}
                                    />
                                </View>
                            )}
                        </View>
                    )}
                </>
            ) : (
                <Text
                    style={{
                        ...styles.layerText,
                        color: themeColor('buttonText')
                    }}
                >
                    {item.count && `+${item.count - 1}`}
                </Text>
            )}
        </LinearGradient>
    );
};

const LayerIcon = ({
    layer,
    watchOnly,
    size = 50
}: {
    layer: string;
    watchOnly?: boolean;
    size?: number;
}) => {
    if (watchOnly) return <MatiSvg width={size} height={size} />;
    if (layer === 'Ecash') return <EcashSvg width={size} height={size} />;
    if (layer === 'On-chain') return <OnChainSvg width={size} height={size} />;
    if (layer === 'Lightning')
        return <LightningSvg width={size} height={size} />;
    return <OnChainSvg width={size} height={size} />;
};

const CollapsedItem = ({ item }: { item: DataRow }) => {
    if (Number(item.balance) === 0) return null;

    return (
        <View style={{ flex: 1, flexDirection: 'row' }}>
            <LayerIcon
                layer={item.layer}
                watchOnly={item.watchOnly}
                size={50}
            />
        </View>
    );
};

const SwipeableRow = ({
    item,
    navigation,
    value,
    satAmount,
    lightning,
    offer,
    locked,
    editMode
}: {
    item: DataRow;
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: string;
    lightning?: string;
    offer?: string;
    locked?: boolean;
    editMode?: boolean;
}) => {
    if (item.layer === 'Ecash') {
        return (
            <EcashSwipeableRow
                navigation={navigation}
                value={value}
                locked={locked}
                needsConfig={cashuStore.mintUrls.length === 0}
            >
                <Row item={item} />
            </EcashSwipeableRow>
        );
    }

    if (item.layer === 'Lightning') {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                lightning={lightning}
                offer={offer}
                locked={locked}
            >
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (item.layer === 'On-chain') {
        return (
            <OnchainSwipeableRow
                navigation={navigation}
                value={value}
                satAmount={satAmount}
                locked={locked}
            >
                <Row item={item} />
            </OnchainSwipeableRow>
        );
    }

    if (item.layer === localeString('components.LayerBalances.moreAccounts')) {
        return (
            <TouchableOpacity onPress={() => navigation.navigate('Accounts')}>
                <Row item={item} />
            </TouchableOpacity>
        );
    }

    if (
        item.layer === localeString('components.LayerBalances.collapseBalances')
    ) {
        return (
            <TouchableOpacity onPress={() => balanceStore?.toggleCollapse()}>
                <Row item={item} />
            </TouchableOpacity>
        );
    }

    const HideButton = () => (
        <TouchableOpacity
            onPress={() => {
                item.hidden
                    ? utxosStore.unhideAccount(item.layer)
                    : utxosStore.hideAccount(item.layer);
            }}
        >
            {item.hidden ? (
                <EyeClosed
                    style={styles.eyeIcon}
                    fill={themeColor('text')}
                    height={30}
                    width={30}
                />
            ) : (
                <EyeOpened
                    style={styles.eyeIcon}
                    fill={themeColor('text')}
                    height={30}
                    width={30}
                />
            )}
        </TouchableOpacity>
    );

    return (
        <LayoutRow>
            {editMode && <HideButton />}
            <OnchainSwipeableRow
                navigation={navigation}
                value={value}
                satAmount={satAmount}
                locked={locked}
                account={item.layer}
                hidden={item.hidden}
            >
                <Row item={item} />
            </OnchainSwipeableRow>
        </LayoutRow>
    );
};

@inject('BalanceStore', 'CashuStore', 'UTXOsStore', 'SettingsStore')
@observer
export default class LayerBalances extends Component<LayerBalancesProps, {}> {
    render() {
        const {
            BalanceStore,
            CashuStore,
            SettingsStore,
            navigation,
            value,
            satAmount,
            lightning,
            offer,
            onRefresh,
            locked,
            consolidated,
            collapsed,
            editMode,
            refreshing
        } = this.props;

        const { settings } = SettingsStore!;
        const { totalBlockchainBalance, lightningBalance, toggleCollapse } =
            BalanceStore!;
        const { totalBalanceSats, mintUrls, cashuWallets } = CashuStore!;

        const otherAccounts = editMode
            ? this.props.UTXOsStore?.accounts
            : this.props.UTXOsStore?.accounts.filter(
                  (item: any) => !item.hidden
              );

        let DATA: DataRow[] = [];

        if (!(collapsed && lightningBalance === 0)) {
            DATA.push({
                layer: 'Lightning',
                balance: Number(lightningBalance).toFixed(3),
                collapsed
            });
        }

        // Only show on-chain balance for non-Lnbank accounts
        if (
            BackendUtils.supportsOnchainReceiving() &&
            !(collapsed && totalBlockchainBalance === 0)
        ) {
            DATA.push({
                layer: 'On-chain',
                balance: Number(totalBlockchainBalance).toFixed(3),
                collapsed
            });
        }

        if (
            BackendUtils.supportsCashuWallet() &&
            settings?.ecash?.enableCashu &&
            !(collapsed && totalBalanceSats === 0)
        ) {
            // Build mints info for display
            const mints: MintInfo[] =
                mintUrls?.map((mintUrl: string) => {
                    const wallet = cashuWallets?.[mintUrl];
                    const mintInfo = wallet?.mintInfo;
                    return {
                        url: mintUrl,
                        iconUrl: mintInfo?.icon_url,
                        name: mintInfo?.name
                    };
                }) || [];

            DATA.push({
                layer: 'Ecash',
                custodial: true,
                needsConfig: mintUrls?.length === 0,
                balance: Number(totalBalanceSats).toFixed(3),
                mints,
                collapsed
            });
        }

        if (
            Object.keys(otherAccounts).length > 0 &&
            !consolidated &&
            !collapsed
        ) {
            for (let i = 0; i < otherAccounts.length; i++) {
                if (!editMode && otherAccounts[i].hidden) i++;
                DATA.push({
                    layer: otherAccounts[i].name,
                    subtitle: otherAccounts[i].XFP,
                    balance: otherAccounts[i].balance || 0,
                    watchOnly: otherAccounts[i].watch_only || false,
                    hidden: otherAccounts[i].hidden || false,
                    collapsed
                });
            }
        }

        if (
            Object.keys(otherAccounts).length > 0 &&
            consolidated &&
            !collapsed
        ) {
            let n = 0;
            for (let i = 0; i < otherAccounts.length; i++) {
                while (n < 1) {
                    DATA.push({
                        layer: otherAccounts[i].name,
                        subtitle: otherAccounts[i].XFP,
                        balance: otherAccounts[i].balance || 0,
                        watchOnly: otherAccounts[i].watch_only || false,
                        hidden: otherAccounts[i].hidden || false,
                        collapsed
                    });
                    n++;
                }
            }
        }

        if (Object.keys(otherAccounts).length > 0 && collapsed) {
            let filled = false;
            for (let i = 0; i < otherAccounts.length; i++) {
                while (!filled && otherAccounts[i].balance > 0) {
                    filled = true;
                    DATA.push({
                        layer: otherAccounts[i].name,
                        subtitle: otherAccounts[i].XFP,
                        balance: otherAccounts[i].balance || 0,
                        watchOnly: otherAccounts[i].watch_only || false,
                        hidden: otherAccounts[i].hidden || false,
                        collapsed
                    });
                }
            }
        }

        if (
            Object.keys(otherAccounts).length > 1 &&
            consolidated &&
            !collapsed
        ) {
            DATA.push({
                layer: localeString('components.LayerBalances.moreAccounts'),
                count: Object.keys(otherAccounts).length,
                balance: 0,
                collapsed
            });
        }

        if (!collapsed) {
            DATA.push({
                layer: localeString(
                    'components.LayerBalances.collapseBalances'
                ),
                balance: 0,
                collapsed
            });
        }

        if (collapsed && DATA.length === 0) return null;

        return (
            <Animated.View
                layout={LinearTransition.duration(300)}
                style={{
                    flex: 1,
                    width: '100%',
                    alignItems: collapsed ? 'center' : undefined
                }}
            >
                {lightningBalance === 0 && totalBlockchainBalance !== 0 && (
                    <Button
                        title={localeString(
                            'components.LayerBalances.moveFundsToLn'
                        )}
                        onPress={() => navigation.navigate('OpenChannel')}
                        secondary
                    />
                )}

                {collapsed ? (
                    <Animated.View
                        key="collapsed"
                        entering={ZoomIn.duration(300).springify()}
                        exiting={ZoomOut.duration(200)}
                        style={{
                            marginTop: 10,
                            alignItems: 'center',
                            width: '100%'
                        }}
                    >
                        <TouchableOpacity
                            style={{
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                            onPress={() => toggleCollapse()}
                        >
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 60,
                                    paddingVertical: 4,
                                    paddingHorizontal: 4,
                                    alignItems: 'center',
                                    height: 58
                                }}
                            >
                                <FlatList
                                    data={DATA}
                                    horizontal={true}
                                    showsHorizontalScrollIndicator={false}
                                    scrollEnabled={false}
                                    renderItem={({ item }) => (
                                        <CollapsedItem item={item} />
                                    )}
                                    keyExtractor={(_item, index) =>
                                        `collapsed-${index}`
                                    }
                                    refreshing={refreshing ? refreshing : false}
                                />
                            </View>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 14,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    marginTop: 6
                                }}
                            >
                                {localeString('general.tapToExpand')}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <Animated.View
                        key="expanded"
                        entering={SlideInDown.duration(300).springify()}
                        exiting={SlideOutUp.duration(200)}
                        style={{ flex: 1, width: '100%' }}
                    >
                        <FlatList
                            data={DATA}
                            ItemSeparatorComponent={() => (
                                <View style={styles.separator} />
                            )}
                            renderItem={({ item }) => (
                                <SwipeableRow
                                    item={item}
                                    navigation={navigation}
                                    value={value}
                                    satAmount={satAmount}
                                    lightning={lightning}
                                    offer={offer}
                                    locked={locked || editMode}
                                    editMode={editMode}
                                />
                            )}
                            keyExtractor={(_item, index) => `expanded-${index}`}
                            style={{ marginTop: 20 }}
                            onRefresh={() => onRefresh()}
                            refreshing={refreshing ? refreshing : false}
                        />
                    </Animated.View>
                )}
            </Animated.View>
        );
    }
}

const styles = StyleSheet.create({
    rectButton: {
        height: 80,
        marginHorizontal: 15,
        borderRadius: 50,
        paddingVertical: 10,
        paddingLeft: 6,
        paddingRight: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row'
    },
    pill: {
        marginTop: 5,
        alignSelf: 'flex-start'
    },
    pillRight: {
        marginTop: 4,
        alignSelf: 'flex-end'
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flex: 1,
        marginRight: 16
    },
    rightContent: {
        alignItems: 'flex-end',
        justifyContent: 'center'
    },
    separator: {
        backgroundColor: 'transparent',
        height: 20
    },
    layerText: {
        backgroundColor: 'transparent',
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    eyeIcon: { alignSelf: 'center', margin: 15, marginLeft: 25 },
    mintIconsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5
    },
    mintIconWrapper: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    mintIcon: {
        width: 24,
        height: 24,
        borderRadius: 12
    },
    mintIconPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    mintIconPlaceholderText: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Medium',
        color: '#fff'
    }
});
