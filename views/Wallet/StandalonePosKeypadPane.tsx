import * as React from 'react';
import { Animated, View, Text } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import BigNumber from 'bignumber.js';

import Button from '../../components/Button';
import Conversion from '../../components/Conversion';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import WalletHeader from '../../components/WalletHeader';

import ChannelsStore from '../../stores/ChannelsStore';
import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import SettingsStore from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import {
    SATS_PER_BTC,
    getDecimalPlaceholder,
    numberWithCommas
} from '../../utils/UnitsUtils';
import { calculateTaxSats } from '../../utils/PosUtils';
import BackendUtils from '../../utils/BackendUtils';

import { PricedIn } from '../../models/Product';

interface PosKeypadPaneProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore?: ChannelsStore;
    FiatStore?: FiatStore;
    PosStore?: PosStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
}

interface PosKeypadPaneState {
    amount: string;
}

const MAX_LENGTH = 10;

@inject('ChannelsStore', 'FiatStore', 'PosStore', 'SettingsStore', 'UnitsStore')
@observer
export default class PosKeypadPane extends React.PureComponent<
    PosKeypadPaneProps,
    PosKeypadPaneState
> {
    shakeAnimation = new Animated.Value(0);
    textAnimation = new Animated.Value(0);
    state = {
        amount: '0'
    };

    appendValue = (value: string) => {
        const { amount } = this.state;
        const { FiatStore, SettingsStore, UnitsStore } = this.props;
        const { units } = UnitsStore!;

        let newAmount, decimalCount;

        // limit decimal places depending on units
        if (units === 'fiat') {
            const fiat = SettingsStore!.settings?.fiat || '';
            const fiatProperties = FiatStore!.symbolLookup(fiat);
            decimalCount =
                fiatProperties?.decimalPlaces !== undefined
                    ? fiatProperties.decimalPlaces
                    : 2;
            if (
                amount.split('.')[1] &&
                amount.split('.')[1].length == decimalCount
            )
                return this.startShake();
        }
        if (units === 'sats') {
            if (amount.split('.')[1] && amount.split('.')[1].length == 3)
                return this.startShake();
        }
        if (units === 'BTC') {
            if (amount.split('.')[1] && amount.split('.')[1].length == 8)
                return this.startShake();
        }

        // only allow one decimal, unless currency has zero decimal places
        if (value === '.' && (amount.includes('.') || decimalCount === 0))
            return this.startShake();

        if (amount.length >= MAX_LENGTH) {
            newAmount = amount;
            return this.startShake();
        } else if (amount === '0') {
            newAmount = value;
        } else {
            newAmount = `${amount}${value}`;
        }

        this.setState({
            amount: newAmount
        });
    };

    clearValue = () => {
        this.setState({
            amount: '0'
        });
    };

    deleteValue = () => {
        const { amount } = this.state;

        let newAmount;

        if (amount.length === 1) {
            newAmount = '0';
        } else {
            newAmount = amount.substr(0, amount.length - 1);
        }

        this.setState({
            amount: newAmount
        });
    };

    amountSize = () => {
        const { amount } = this.state;
        const { units } = this.props.UnitsStore!;
        switch (amount.length + getDecimalPlaceholder(amount, units).count) {
            case 1:
            case 2:
                return 80;
            case 3:
            case 4:
                return 65;
            case 5:
            case 6:
                return 55;
            case 7:
                return 50;
            case 8:
                return 45;
            default:
                return 35;
        }
    };

    startShake = () => {
        Animated.parallel([
            Animated.sequence([
                Animated.timing(this.textAnimation, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: false
                }),
                Animated.timing(this.textAnimation, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: false
                })
            ]),
            Animated.sequence([
                Animated.timing(this.shakeAnimation, {
                    toValue: 10,
                    duration: 100,
                    useNativeDriver: true
                }),
                Animated.timing(this.shakeAnimation, {
                    toValue: -10,
                    duration: 100,
                    useNativeDriver: true
                }),
                Animated.timing(this.shakeAnimation, {
                    toValue: 10,
                    duration: 100,
                    useNativeDriver: true
                }),
                Animated.timing(this.shakeAnimation, {
                    toValue: 0,
                    duration: 100,
                    useNativeDriver: true
                })
            ])
        ]).start();
    };

    addItemAndCheckout = async () => {
        const { PosStore, UnitsStore, SettingsStore, navigation } = this.props;
        const { settings } = SettingsStore!;
        const { units } = UnitsStore!;
        const { fiat } = settings;

        const { amount } = this.state;

        if (!PosStore?.currentOrder)
            PosStore?.createCurrentOrder(fiat || 'USD');
        const order = PosStore?.currentOrder;

        if (!order) return;

        const amountCalc = amount.replace(/,/g, '.');

        order.line_items.push({
            name: localeString('pos.customItem'),
            quantity: 1,
            base_price_money: {
                amount: units === PricedIn.Fiat ? Number(amountCalc) : 0,
                sats:
                    units === PricedIn.Sats
                        ? Number(amountCalc)
                        : units === PricedIn.Bitcoin
                        ? Number(amountCalc) * SATS_PER_BTC
                        : 0
            }
        });

        PosStore.recalculateCurrentOrder();

        await PosStore.saveStandaloneOrder(order);

        navigation.navigate('Order', { order });
    };

    addItemAndQuickPay = async () => {
        const { PosStore, UnitsStore, SettingsStore, FiatStore, navigation } =
            this.props;
        const { settings } = SettingsStore!;
        const { units } = UnitsStore!;
        const { fiat } = settings;

        const { amount } = this.state;

        if (!PosStore?.currentOrder)
            PosStore?.createCurrentOrder(fiat || 'USD');
        const currentOrder = PosStore?.currentOrder;

        if (!currentOrder) return;

        const amountCalc = amount.replace(/,/g, '.');

        currentOrder.line_items.push({
            name: localeString('pos.customItem'),
            quantity: 1,
            base_price_money: {
                amount: units === PricedIn.Fiat ? Number(amountCalc) : 0,
                sats:
                    units === PricedIn.Sats
                        ? Number(amountCalc)
                        : units === PricedIn.Bitcoin
                        ? Number(amountCalc) * SATS_PER_BTC
                        : 0
            }
        });

        PosStore.recalculateCurrentOrder();
        await PosStore.saveStandaloneOrder(currentOrder);

        if (!SettingsStore || !FiatStore || !UnitsStore) return;
        const { getRate, fiatRates } = FiatStore;
        const { pos } = settings;
        const merchantName = pos?.merchantName;
        const taxPercentage = pos?.taxPercentage;
        const lineItems = currentOrder.line_items;

        const memo = merchantName
            ? `${merchantName} POS powered by ZEUS - Order ${currentOrder?.id}`
            : `ZEUS POS - Order ${currentOrder?.id}`;

        const fiatEntry =
            fiat && fiatRates
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;
        const rate =
            fiat && fiatRates && fiatEntry ? fiatEntry.rate.toFixed() : 0;

        const subTotalSats =
            (currentOrder?.total_money?.sats ?? 0) > 0
                ? currentOrder.total_money.sats
                : new BigNumber(currentOrder?.total_money?.amount)
                      .div(100)
                      .div(rate)
                      .multipliedBy(SATS_PER_BTC)
                      .toFixed(0);

        const taxSats = Number(
            calculateTaxSats(lineItems, subTotalSats, rate, taxPercentage)
        );

        const totalSats = new BigNumber(subTotalSats || 0)
            .plus(taxSats)
            .toFixed(0);

        const totalFiat = new BigNumber(totalSats ?? 0)
            .multipliedBy(rate)
            .dividedBy(SATS_PER_BTC)
            .toFixed(2);
        navigation.navigate(
            settings?.ecash?.enableCashu && BackendUtils.supportsCashuWallet()
                ? 'ReceiveEcash'
                : 'Receive',
            {
                amount:
                    units === 'sats'
                        ? totalSats
                        : units === 'BTC'
                        ? new BigNumber(totalSats || 0)
                              .div(SATS_PER_BTC)
                              .toFixed(8)
                        : totalFiat,
                autoGenerate: true,
                memo,
                order: currentOrder,
                // For displaying paid orders
                orderId: currentOrder.id,
                // sats
                orderTip: 0,
                orderTotal: totalSats,
                // formatted string rate
                exchangeRate: getRate(),
                // numerical rate
                rate
            }
        );
    };

    render() {
        const { UnitsStore, navigation } = this.props;
        const { amount } = this.state;
        const { units } = UnitsStore!;

        const color = this.textAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [themeColor('text'), 'red']
        });

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader navigation={navigation} />

                <Animated.View
                    style={{
                        flex: 1,
                        flexDirection: 'column',
                        alignSelf: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        transform: [{ translateX: this.shakeAnimation }],
                        bottom: 15
                    }}
                >
                    <Animated.Text
                        style={{
                            color:
                                amount === '0'
                                    ? themeColor('secondaryText')
                                    : color,
                            fontSize: this.amountSize(),
                            textAlign: 'center',
                            fontFamily: 'PPNeueMontreal-Medium'
                        }}
                    >
                        {numberWithCommas(amount)}
                        <Text style={{ color: themeColor('secondaryText') }}>
                            {getDecimalPlaceholder(amount, units).string}
                        </Text>
                    </Animated.Text>

                    <UnitToggle onToggle={this.clearValue} />

                    {amount !== '0' && (
                        <View style={{ top: 10, alignItems: 'center' }}>
                            <Conversion amount={amount} />
                        </View>
                    )}
                </Animated.View>

                <View>
                    <View style={{ marginTop: 30, bottom: '10%' }}>
                        <PinPad
                            appendValue={this.appendValue}
                            clearValue={this.clearValue}
                            deleteValue={this.deleteValue}
                            numberHighlight
                            amount
                        />
                    </View>
                    <View
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            position: 'absolute',
                            bottom: 10,
                            paddingHorizontal: 22
                        }}
                    >
                        <Button
                            title={localeString(
                                'general.request'
                            ).toUpperCase()}
                            containerStyle={{
                                borderRadius: 12,
                                flex: 2,
                                marginRight: 5
                            }}
                            titleStyle={{
                                color: themeColor('background')
                            }}
                            buttonStyle={{
                                backgroundColor: themeColor('highlight')
                            }}
                            disabled={!amount || amount == '0'}
                            onPress={() => this.addItemAndCheckout()}
                        />
                        <Button
                            title={localeString('views.Settings.POS.quickPay')}
                            containerStyle={{
                                borderRadius: 12,
                                flex: 1
                            }}
                            titleStyle={{
                                color: themeColor('background')
                            }}
                            buttonStyle={{
                                backgroundColor: themeColor('highlight')
                            }}
                            disabled={!amount || amount == '0'}
                            onPress={() => this.addItemAndQuickPay()}
                        />
                    </View>
                </View>
            </View>
        );
    }
}
