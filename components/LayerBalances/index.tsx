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

import { inject, observer } from 'mobx-react';
import Amount from '../Amount';
import Button from '../Button';
import { Spacer } from '../layout/Spacer';
import LightningSwipeableRow from './LightningSwipeableRow';
import OnchainSwipeableRow from './OnchainSwipeableRow';
import EcashSwipeableRow from './EcashSwipeableRow';
import { Row as LayoutRow } from '../layout/Row';

import stores from '../../stores/Stores';

import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import UnitsStore from '../../stores/UnitsStore';
import UTXOsStore from '../../stores/UTXOsStore';
import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

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
    amount?: string;
    lightning?: string;
    offer?: string;
    locked?: boolean;
    consolidated?: boolean;
    editMode?: boolean;
    refreshing?: boolean;
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
    hidden?: boolean;
};

const Row = ({ item }: { item: DataRow }) => {
    const moreAccounts =
        item.layer === localeString('components.LayerBalances.moreAccounts');
    return (
        <RectButton>
            <LinearGradient
                colors={
                    themeColor('buttonGradient')
                        ? themeColor('buttonGradient')
                        : themeColor('buttonBackground')
                        ? [
                              themeColor('buttonBackground'),
                              themeColor('buttonBackground')
                          ]
                        : [themeColor('secondary'), themeColor('secondary')]
                }
                style={
                    moreAccounts
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
                    ) : moreAccounts ? null : (
                        <OnChainSvg />
                    )}
                    <Spacer width={5} />
                    <View
                        style={{
                            flexDirection: 'column',
                            left: moreAccounts ? 5 : 0
                        }}
                    >
                        <Text
                            style={{
                                ...styles.layerText,
                                color:
                                    themeColor('buttonText') ||
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
                    </View>
                </View>

                {!moreAccounts ? (
                    <Amount
                        sats={item.balance}
                        sensitive
                        colorOverride={themeColor('buttonText')}
                    />
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

const SwipeableRow = ({
    item,
    index,
    navigation,
    value,
    amount,
    lightning,
    offer,
    locked,
    editMode
}: {
    item: DataRow;
    index: number;
    navigation: StackNavigationProp<any, any>;
    value?: string;
    amount?: string;
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
                amount={amount}
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
                amount={amount}
                locked={locked}
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

    const HideButton = () => (
        <TouchableOpacity
            onPress={() => {
                item.hidden
                    ? stores.utxosStore.unhideAccount(item.layer)
                    : stores.utxosStore.hideAccount(item.layer);
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
                amount={amount}
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
            amount,
            lightning,
            offer,
            onRefresh,
            locked,
            consolidated,
            editMode,
            refreshing
        } = this.props;

        const { settings } = SettingsStore!;
        const { totalBlockchainBalance, lightningBalance } = BalanceStore!;
        const { totalBalanceSats } = CashuStore!;

        const otherAccounts = editMode
            ? this.props.UTXOsStore?.accounts
            : this.props.UTXOsStore?.accounts.filter(
                  (item: any) => !item.hidden
              );

        let DATA: DataRow[] = [
            {
                layer: 'Lightning',
                balance: Number(lightningBalance).toFixed(3)
            }
        ];

        // Only show on-chain balance for non-Lnbank accounts
        if (BackendUtils.supportsOnchainReceiving()) {
            DATA.push({
                layer: 'On-chain',
                balance: Number(totalBlockchainBalance).toFixed(3)
            });
        }

        // Only show on-chain balance for non-Lnbank accounts
        if (BackendUtils.supportsCashu() && settings?.ecash?.enableCashu) {
            DATA.push({
                layer: 'Ecash',
                subtitle: '⚠ Custodial',
                balance: Number(totalBalanceSats).toFixed(3)
            });
        }

        if (Object.keys(otherAccounts).length > 0 && !consolidated) {
            for (let i = 0; i < otherAccounts.length; i++) {
                if (!editMode && otherAccounts[i].hidden) i++;
                DATA.push({
                    layer: otherAccounts[i].name,
                    subtitle: otherAccounts[i].XFP,
                    balance: otherAccounts[i].balance || 0,
                    watchOnly: otherAccounts[i].watch_only || false,
                    hidden: otherAccounts[i].hidden || false
                });
            }
        }

        if (Object.keys(otherAccounts).length > 0 && consolidated) {
            let n = 0;
            for (let i = 0; i < otherAccounts.length; i++) {
                while (n < 1) {
                    DATA.push({
                        layer: otherAccounts[i].name,
                        subtitle: otherAccounts[i].XFP,
                        balance: otherAccounts[i].balance || 0,
                        watchOnly: otherAccounts[i].watch_only || false,
                        hidden: otherAccounts[i].hidden || false
                    });
                    n++;
                }
            }
        }

        if (Object.keys(otherAccounts).length > 1 && consolidated) {
            DATA.push({
                layer: localeString('components.LayerBalances.moreAccounts'),
                count: Object.keys(otherAccounts).length,
                balance: 0
            });
        }

        return (
            <View style={{ flex: 1 }}>
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
                            amount={amount}
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
