import React, { Component } from 'react';
import { FlatList, StyleSheet, Text, View, I18nManager } from 'react-native';
import LinearGradient from '../LinearGradient';
import { RectButton } from 'react-native-gesture-handler';
import { StackNavigationProp } from '@react-navigation/stack';
import { LNURLWithdrawParams } from 'js-lnurl';

import { Spacer } from '../layout/Spacer';
import OnchainSwipeableRow from './OnchainSwipeableRow';
import LightningSwipeableRow from './LightningSwipeableRow';
import EcashSwipeableRow from './EcashSwipeableRow';
import Amount from '../Amount';

import Channel from '../../models/Channel';
import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import EcashSvg from '../../assets/images/SVG/DynamicSVG/EcashSvg';

import BigNumber from 'bignumber.js';

import {
    channelsStore,
    nodeInfoStore,
    settingsStore
} from '../../stores/Stores';

interface PaymentMethodListProps {
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: number | string;
    feeRate?: string;
    lightning?: string;
    lightningAddress?: string;
    ecash?: string;
    offer?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
    lightningBalance?: number | string;
    onchainBalance?: number | string;
    onchainReserve?: number;
    ecashBalance?: number | string;
    accounts?: Array<{
        name: string;
        balance: number;
        XFP?: string;
        watch_only?: boolean;
        hidden?: boolean;
    }>;
}

//  To toggle LTR/RTL change to `true`
I18nManager.allowRTL(false);

type DataRow = {
    layer: string;
    subtitle?: string;
    disabled?: boolean;
    balance?: number | string;
    reserve?: number;
    account?: string;
    hidden?: boolean;
    satAmount?: number;
};

const LAYER_LOCALE_MAP: Record<string, string> = {
    Lightning: 'general.lightning',
    'Lightning via ecash': 'components.LayerBalances.lightningViaEcash',
    'Lightning address': 'general.lightningAddress',
    Offer: 'views.Settings.Bolt12Offer',
    'On-chain': 'general.onchain'
};

const getGradientColors = (): [string, string] => {
    const gradient = themeColor('buttonGradient');
    if (gradient) return gradient;
    const bg = themeColor('buttonBackground') ?? themeColor('secondary');
    return [bg, bg];
};

const LayerIcon = ({ layer }: { layer: string }) => {
    if (layer === 'Lightning via ecash') return <EcashSvg />;
    if (layer === 'On-chain') return <OnChainSvg />;
    if (['Lightning', 'Lightning address', 'Offer'].includes(layer))
        return <LightningSvg />;
    return <OnChainSvg />;
};

const hasInsufficientBalance = (
    balance: number | string | undefined,
    satAmount: number | undefined,
    reserve: number = 0
) => {
    const spendable = Number(balance ?? 0) - reserve;
    return spendable <= 0 || (satAmount !== undefined && satAmount > spendable);
};

const Row = ({ item }: { item: DataRow }) => {
    const insufficient = hasInsufficientBalance(
        item.balance,
        item.satAmount,
        item.reserve
    );
    const layerLabel = LAYER_LOCALE_MAP[item.layer]
        ? localeString(LAYER_LOCALE_MAP[item.layer])
        : item.layer;
    return (
        <RectButton
            style={{
                opacity: item.disabled ? 0.5 : 1
            }}
        >
            <LinearGradient
                colors={getGradientColors()}
                style={styles.rectButton}
            >
                <View style={styles.left}>
                    <LayerIcon layer={item.layer} />
                    <Spacer width={5} />
                    <View
                        style={{
                            flexDirection: 'column',
                            flex: 1
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
                            {layerLabel}
                        </Text>
                        {item.subtitle && (
                            <Text
                                numberOfLines={1}
                                ellipsizeMode="middle"
                                style={[
                                    styles.layerText,
                                    styles.subtitle,
                                    {
                                        color:
                                            themeColor('buttonTextSecondary') ||
                                            themeColor('secondaryText')
                                    }
                                ]}
                            >
                                {item.subtitle}
                            </Text>
                        )}
                    </View>
                </View>
                {item.balance !== undefined && (
                    <View style={styles.balanceContainer}>
                        <Amount
                            sats={
                                item.reserve && item.reserve > 0
                                    ? new BigNumber(item.balance)
                                          .minus(item.reserve)
                                          .toNumber()
                                    : item.balance
                            }
                            sensitive
                            colorOverride={
                                insufficient
                                    ? themeColor('error')
                                    : themeColor('buttonText')
                            }
                        />
                        {item.reserve != null && item.reserve > 0 && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('buttonText'),
                                        fontSize: 10,
                                        fontFamily: 'PPNeueMontreal-Book',
                                        marginRight: 2
                                    }}
                                >
                                    {`${localeString('general.reserve')}:`}
                                </Text>
                                <Amount
                                    sats={item.reserve}
                                    sensitive
                                    colorOverride={themeColor('buttonText')}
                                    fontSize={10}
                                />
                            </View>
                        )}
                    </View>
                )}
            </LinearGradient>
        </RectButton>
    );
};

const SwipeableRow = ({
    item,
    navigation,
    value,
    satAmount,
    feeRate,
    lightning,
    lightningAddress,
    offer,
    lnurlParams
}: {
    item: DataRow;
    index: number;
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: number;
    feeRate?: string;
    lightning?: string;
    lightningAddress?: string;
    offer?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
}) => {
    const insufficient = hasInsufficientBalance(
        item.balance,
        item.satAmount,
        item.reserve
    );
    const rowDisabled = item.disabled || insufficient;
    if (item.layer === 'Lightning') {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                lightning={lightning}
                locked={true}
                lnurlParams={lnurlParams}
                disabled={rowDisabled}
            >
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (item.layer === 'Lightning address') {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                lightningAddress={lightningAddress}
                locked={true}
                disabled={rowDisabled}
            >
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (item.layer === 'Lightning via ecash') {
        return (
            <EcashSwipeableRow
                navigation={navigation}
                lightning={lightning}
                locked={true}
                lnurlParams={lnurlParams}
                disabled={rowDisabled}
            >
                <Row item={item} />
            </EcashSwipeableRow>
        );
    }

    if (item.layer === 'Offer') {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                offer={offer}
                locked={true}
                disabled={rowDisabled}
            >
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (item.layer === 'On-chain' || item.account) {
        return (
            <OnchainSwipeableRow
                navigation={navigation}
                value={value}
                satAmount={satAmount}
                feeRate={feeRate}
                locked={true}
                hidden={item.hidden}
                disabled={rowDisabled}
                account={item.account}
            >
                <Row item={item} />
            </OnchainSwipeableRow>
        );
    }
};

export default class PaymentMethodList extends Component<
    PaymentMethodListProps,
    {}
> {
    private buildData = (satAmount: number | undefined): DataRow[] => {
        const {
            value,
            lightning,
            lightningAddress,
            offer,
            lnurlParams,
            lightningBalance,
            onchainBalance,
            onchainReserve,
            ecashBalance,
            accounts
        } = this.props;
        let DATA: DataRow[] = [];

        const lightningChannelReserve = channelsStore.channels.reduce(
            (sum: number, channel: Channel) =>
                sum + Number(channel.localReserveBalance || 0),
            0
        );

        if (lightning || lnurlParams) {
            DATA.push({
                layer: 'Lightning',
                subtitle: lightning ?? lnurlParams?.tag,
                balance: lightningBalance,
                reserve: lightningChannelReserve,
                disabled: false,
                satAmount
            });

            if (
                BackendUtils.supportsCashuWallet() &&
                settingsStore?.settings?.ecash?.enableCashu
            ) {
                DATA.push({
                    layer: 'Lightning via ecash',
                    subtitle: lightning ?? lnurlParams?.tag,
                    balance: ecashBalance,
                    disabled: false,
                    satAmount
                });
            }
        }

        if (lightningAddress) {
            DATA.push({
                layer: 'Lightning address',
                subtitle: lightningAddress,
                balance: lightningBalance,
                reserve: lightningChannelReserve,
                disabled: false,
                satAmount
            });
        }

        if (offer) {
            DATA.push({
                layer: 'Offer',
                subtitle: offer,
                disabled: !nodeInfoStore.supportsOffers,
                balance: lightningBalance,
                reserve: lightningChannelReserve,
                satAmount
            });
        }

        // Only show on-chain balance for non-Lnbank accounts
        if (value && BackendUtils.supportsOnchainReceiving()) {
            DATA.push({
                layer: 'On-chain',
                subtitle: value,
                disabled: !BackendUtils.supportsOnchainSends(),
                balance: onchainBalance,
                reserve: onchainReserve,
                account: 'default',
                satAmount
            });

            if (accounts && accounts.length > 0) {
                accounts.forEach((account) => {
                    if (!account.hidden && !account.watch_only) {
                        DATA.push({
                            layer: account.name,
                            subtitle: value ?? account.XFP,
                            disabled: false,
                            balance: account.balance,
                            account: account.name,
                            hidden: account.hidden,
                            satAmount
                        });
                    }
                });
            }
        }
        return DATA;
    };

    render() {
        const {
            navigation,
            value,
            satAmount,
            feeRate,
            lightning,
            lightningAddress,
            offer,
            lnurlParams
        } = this.props;
        const satAmountNum =
            satAmount !== undefined && !isNaN(Number(satAmount))
                ? Number(satAmount)
                : undefined;
        const DATA = this.buildData(satAmountNum);
        return (
            <View style={{ flex: 1 }}>
                <FlatList
                    data={DATA}
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item, index }) => (
                        // @ts-ignore:next-line
                        <SwipeableRow
                            item={item}
                            index={index}
                            navigation={navigation}
                            // select pay method vars
                            value={value}
                            satAmount={satAmountNum}
                            feeRate={feeRate}
                            lightning={lightning}
                            lightningAddress={lightningAddress}
                            offer={offer}
                            lnurlParams={lnurlParams}
                        />
                    )}
                    keyExtractor={(item) =>
                        item.account
                            ? `account-${item.account}`
                            : `layer-${item.layer}`
                    }
                    style={{ marginTop: 20 }}
                    refreshing={false}
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
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flex: 1
    },
    balanceContainer: {
        flexShrink: 0,
        marginLeft: 10,
        maxWidth: '40%'
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
    subtitle: {
        marginTop: 2
    }
});
