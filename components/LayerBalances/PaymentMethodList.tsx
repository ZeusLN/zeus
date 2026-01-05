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

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import EcashSvg from '../../assets/images/SVG/DynamicSVG/EcashSvg';

import { nodeInfoStore, settingsStore } from '../../stores/Stores';

interface PaymentMethodListProps {
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: number;
    lightning?: string;
    lightningAddress?: string;
    ecash?: string;
    offer?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
    lightningBalance?: number | string;
    onchainBalance?: number | string;
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
    account?: string;
    hidden?: boolean;
    satAmount?: number;
};

const Row = ({ item }: { item: DataRow }) => {
    const hasInsufficientBalance =
        item.satAmount !== undefined &&
        item.balance !== undefined &&
        Number(item.balance) < item.satAmount;

    return (
        <RectButton style={{ opacity: item.disabled ? 0.5 : 1 }}>
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
                style={styles.rectButton}
            >
                <View style={styles.left}>
                    {item.layer === 'On-chain' ? (
                        <OnChainSvg />
                    ) : item.layer === 'Lightning' ||
                      item.layer === 'Lightning address' ||
                      item.layer === 'Offer' ? (
                        <LightningSvg />
                    ) : item.layer === 'Lightning via ecash' ? (
                        <EcashSvg />
                    ) : (
                        <OnChainSvg />
                    )}
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
                            {item.layer === 'Lightning'
                                ? localeString('general.lightning')
                                : item.layer === 'Lightning via ecash'
                                ? localeString(
                                      'components.LayerBalances.lightningViaEcash'
                                  )
                                : item.layer === 'Lightning address'
                                ? localeString('general.lightningAddress')
                                : item.layer === 'Offer'
                                ? localeString('views.Settings.Bolt12Offer')
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
                {item.balance !== undefined && (
                    <View style={styles.balanceContainer}>
                        <Amount
                            sats={item.balance}
                            sensitive
                            colorOverride={
                                hasInsufficientBalance
                                    ? themeColor('error')
                                    : themeColor('buttonText')
                            }
                        />
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
    lightning,
    lightningAddress,
    offer,
    lnurlParams
}: {
    item: DataRow;
    index: number;
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: string;
    lightning?: string;
    lightningAddress?: string;
    offer?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
}) => {
    if (item.layer === 'Lightning') {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                lightning={lightning}
                locked={true}
                lnurlParams={lnurlParams}
                disabled={item.disabled}
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
                disabled={item.disabled}
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
                disabled={item.disabled}
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
                disabled={item.disabled}
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
                locked={true}
                hidden={item.hidden}
                disabled={item.disabled}
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
    render() {
        const {
            navigation,
            value,
            satAmount,
            lightning,
            lightningAddress,
            offer,
            lnurlParams,
            lightningBalance,
            onchainBalance,
            ecashBalance,
            accounts
        } = this.props;
        let DATA: DataRow[] = [];
        if (lightning || lnurlParams) {
            DATA.push({
                layer: 'Lightning',
                subtitle: lightning
                    ? `${lightning?.slice(0, 12)}...${lightning?.slice(-12)}`
                    : lnurlParams?.tag,
                balance: lightningBalance,
                disabled:
                    satAmount !== undefined &&
                    satAmount > Number(lightningBalance),
                satAmount
            });
        }

        if (
            (lightning || lnurlParams) &&
            BackendUtils.supportsCashuWallet() &&
            settingsStore?.settings?.ecash?.enableCashu
        ) {
            DATA.push({
                layer: 'Lightning via ecash',
                subtitle: lightning
                    ? `${lightning?.slice(0, 12)}...${lightning?.slice(-12)}`
                    : lnurlParams?.tag,
                balance: ecashBalance,
                disabled:
                    satAmount !== undefined && satAmount > Number(ecashBalance),
                satAmount
            });
        }

        if (lightningAddress) {
            DATA.push({
                layer: 'Lightning address',
                subtitle: lightningAddress,
                balance: lightningBalance,
                disabled:
                    satAmount !== undefined &&
                    satAmount > Number(lightningBalance),
                satAmount
            });
        }

        if (offer) {
            DATA.push({
                layer: 'Offer',
                subtitle: `${offer?.slice(0, 12)}...${offer?.slice(-12)}`,
                disabled:
                    !nodeInfoStore.supportsOffers ||
                    (satAmount !== undefined &&
                        satAmount > Number(lightningBalance)),
                balance: lightningBalance,
                satAmount
            });
        }

        // Only show on-chain balance for non-Lnbank accounts
        if (value && BackendUtils.supportsOnchainReceiving()) {
            DATA.push({
                layer: 'On-chain',
                subtitle: value
                    ? `${value.slice(0, 12)}...${value.slice(-12)}`
                    : undefined,
                disabled:
                    !BackendUtils.supportsOnchainSends() ||
                    (satAmount !== undefined &&
                        satAmount > Number(onchainBalance)),
                balance: onchainBalance,
                account: 'default',
                satAmount
            });

            if (accounts && accounts.length > 0) {
                accounts.forEach((account) => {
                    if (!account.hidden && !account.watch_only) {
                        DATA.push({
                            layer: account.name,
                            subtitle: value
                                ? `${value.slice(0, 12)}...${value.slice(-12)}`
                                : account.XFP,
                            disabled:
                                satAmount !== undefined &&
                                satAmount > account.balance,
                            balance: account.balance,
                            account: account.name,
                            hidden: account.hidden,
                            satAmount
                        });
                    }
                });
            }
        }
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
                            satAmount={
                                satAmount !== undefined
                                    ? String(satAmount)
                                    : undefined
                            }
                            lightning={lightning}
                            lightningAddress={lightningAddress}
                            offer={offer}
                            lnurlParams={lnurlParams}
                        />
                    )}
                    keyExtractor={(_item, index) => `message ${index}`}
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
    eyeIcon: { alignSelf: 'center', margin: 15, marginLeft: 25 }
});
