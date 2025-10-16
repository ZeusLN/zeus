import React, { Component } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    I18nManager
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RectButton } from 'react-native-gesture-handler';
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

const Row = ({ item }: { item: DataRow }) => {
    const moreAccounts =
        item.layer === localeString('components.LayerBalances.moreAccounts');
    const collapseBalances =
        item.layer ===
        localeString('components.LayerBalances.collapseBalances');
    const miniRow = moreAccounts || collapseBalances;
    const ecashRowColors = getEcashRowColors();
    return (
        <RectButton>
            <LinearGradient
                colors={
                    collapseBalances
                        ? [themeColor('secondary'), themeColor('secondary')]
                        : item.layer === 'Ecash' && ecashRowColors
                        ? ecashRowColors
                        : themeColor('buttonGradient')
                        ? themeColor('buttonGradient')
                        : themeColor('buttonBackground')
                        ? [
                              themeColor('buttonBackground'),
                              themeColor('buttonBackground')
                          ]
                        : [themeColor('secondary'), themeColor('secondary')]
                }
                style={
                    miniRow
                        ? {
                              ...styles.rectButton,
                              height: 40
                          }
                        : styles.rectButton
                }
            >
                <View style={styles.left}>
                    {item.watchOnly ? (
                        <MatiSvg />
                    ) : item.layer === 'Ecash' ? (
                        <EcashSvg />
                    ) : item.layer === 'On-chain' ? (
                        <OnChainSvg />
                    ) : item.layer === 'Lightning' ? (
                        <LightningSvg />
                    ) : miniRow ? null : (
                        <OnChainSvg />
                    )}
                    <Spacer width={5} />
                    <View
                        style={{
                            flexDirection: 'column',
                            left: miniRow ? 5 : 0
                        }}
                    >
                        <Text
                            style={{
                                ...styles.layerText,
                                color: collapseBalances
                                    ? themeColor('text')
                                    : themeColor('buttonText') ||
                                      themeColor('text')
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
                                    color:
                                        themeColor('buttonTextSecondary') ||
                                        themeColor('secondaryText')
                                }}
                            >
                                {item.subtitle}
                            </Text>
                        )}
                        {item.custodial && !item.needsConfig && (
                            <View style={{ marginTop: 5 }}>
                                <Pill
                                    title={localeString(
                                        'general.custodialWallet'
                                    ).toUpperCase()}
                                    textColor={themeColor('highlight')}
                                    width={160}
                                    height={25}
                                />
                            </View>
                        )}
                        {item.needsConfig && (
                            <View style={{ marginTop: 5 }}>
                                <Pill
                                    title={localeString(
                                        'cashu.tapToConfigure'
                                    ).toUpperCase()}
                                    textColor={themeColor('highlight')}
                                    borderColor={themeColor('highlight')}
                                    width={'110%'}
                                    height={25}
                                />
                            </View>
                        )}
                    </View>
                </View>

                {collapseBalances ? null : !moreAccounts ? (
                    <>
                        {!item.needsConfig && (
                            <Amount
                                sats={item.balance}
                                sensitive
                                colorOverride={themeColor('buttonText')}
                            />
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
        </RectButton>
    );
};

const CollapsedItem = ({ item }: { item: DataRow }) => {
    if (Number(item.balance) === 0) return;

    const icon = item.watchOnly ? (
        <MatiSvg width={50} height={50} />
    ) : item.layer === 'Ecash' ? (
        <EcashSvg width={50} height={50} />
    ) : item.layer === 'On-chain' ? (
        <OnChainSvg width={50} height={50} />
    ) : item.layer === 'Lightning' ? (
        <LightningSvg width={50} height={50} />
    ) : (
        <OnChainSvg width={50} height={50} />
    );

    return <View style={{ flex: 1, flexDirection: 'row' }}>{icon}</View>;
};

const SwipeableRow = ({
    item,
    index,
    navigation,
    value,
    satAmount,
    lightning,
    offer,
    locked,
    editMode
}: {
    item: DataRow;
    index: number;
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: string;
    lightning?: string;
    offer?: string;
    locked?: boolean;
    editMode?: boolean;
}) => {
    if (index === 0) {
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

    if (index === 1) {
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
        const { totalBalanceSats, mintUrls } = CashuStore!;

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

        // Only show on-chain balance for non-Lnbank accounts
        if (
            BackendUtils.supportsCashuWallet() &&
            settings?.ecash?.enableCashu &&
            !(collapsed && totalBalanceSats === 0)
        ) {
            DATA.push({
                layer: 'Ecash',
                custodial: true,
                needsConfig: mintUrls?.length === 0,
                balance: Number(totalBalanceSats).toFixed(3),
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

        if (collapsed && DATA.length === 0) return;
        if (collapsed) {
            return (
                <View>
                    <View style={{ marginTop: 10 }}>
                        {lightningBalance === 0 &&
                            totalBlockchainBalance !== 0 && (
                                <Button
                                    title={localeString(
                                        'components.LayerBalances.moveFundsToLn'
                                    )}
                                    onPress={() =>
                                        navigation.navigate('OpenChannel')
                                    }
                                    secondary
                                />
                            )}
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
                                        `message ${index}`
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
                    </View>
                </View>
            );
        }

        return (
            <View style={{ flex: 1, flexDirection: 'row', width: '100%' }}>
                {lightningBalance === 0 && totalBlockchainBalance !== 0 && (
                    <Button
                        title={localeString(
                            'components.LayerBalances.moveFundsToLn'
                        )}
                        onPress={() => navigation.navigate('OpenChannel')}
                        secondary
                    />
                )}
                <FlatList
                    data={DATA}
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item, index }) => (
                        <SwipeableRow
                            item={item}
                            index={index}
                            navigation={navigation}
                            // select pay method vars
                            value={value}
                            satAmount={satAmount}
                            lightning={lightning}
                            offer={offer}
                            locked={locked || editMode}
                            editMode={editMode}
                        />
                    )}
                    keyExtractor={(_item, index) => `message ${index}`}
                    style={{ marginTop: 20 }}
                    onRefresh={() => onRefresh()}
                    refreshing={refreshing ? refreshing : false}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    rectButton: {
        flex: 1,
        height: 80,
        paddingVertical: 10,
        paddingLeft: 6,
        paddingRight: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        borderRadius: 50
    },
    moreButton: {
        height: 40,
        paddingVertical: 10,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        borderRadius: 15
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start'
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
    eyeIcon: { alignSelf: 'center', margin: 15, marginLeft: 25 }
});
