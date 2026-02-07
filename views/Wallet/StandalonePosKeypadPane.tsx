import * as React from 'react';
import { Animated, View, Text } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Conversion from '../../components/Conversion';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import WalletHeader from '../../components/WalletHeader';

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

import { PricedIn } from '../../models/Product';

import BigNumber from 'bignumber.js';

interface PosKeypadPaneProps {
    navigation: StackNavigationProp<any, any>;
    FiatStore?: FiatStore;
    PosStore?: PosStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
}

interface PosKeypadPaneState {
    amount: string;
}

@inject('FiatStore', 'PosStore', 'SettingsStore', 'UnitsStore')
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

    appendValue = (value: string): boolean => {
        const { amount } = this.state;
        const { FiatStore, SettingsStore, UnitsStore } = this.props;
        const { units } = UnitsStore!;

        let newAmount;

        const getDecimalLimit = (): number | null => {
            if (units === 'fiat') {
                const fiat = SettingsStore!.settings?.fiat || '';
                const fiatProperties = FiatStore!.symbolLookup(fiat);
                return fiatProperties?.decimalPlaces !== undefined
                    ? fiatProperties.decimalPlaces
                    : 2;
            }
            if (units === 'sats') return 3;
            if (units === 'BTC') return 8;
            return null;
        };

        const decimalLimit = getDecimalLimit();
        const [integerPart, decimalPart] = amount.split('.');

        // limit decimal places depending on units
        if (
            decimalPart &&
            decimalLimit !== null &&
            decimalPart.length >= decimalLimit
        ) {
            this.startShake();
            return false;
        }

        if (units === 'BTC') {
            // deny if trying to add more than 8 figures of Bitcoin
            if (
                !decimalPart &&
                integerPart &&
                integerPart.length == 8 &&
                !amount.includes('.') &&
                value !== '.'
            ) {
                this.startShake();
                return false;
            }
        }

        // only allow one decimal, unless currency has zero decimal places
        if (value === '.' && (amount.includes('.') || decimalLimit === 0)) {
            this.startShake();
            return false;
        }

        const proposedNewAmountStr = `${amount}${value}`;
        const proposedNewAmount = new BigNumber(proposedNewAmountStr);

        // deny if exceeding BTC 21 million capacity
        if (units === 'BTC' && proposedNewAmount.gt(21000000)) {
            this.startShake();
            return false;
        }
        if (units === 'sats' && proposedNewAmount.gt(2100000000000000.0)) {
            this.startShake();
            return false;
        }

        if (amount === '0') {
            newAmount = value;
        } else {
            newAmount = proposedNewAmountStr;
        }

        this.setState({
            amount: newAmount
        });

        return true;
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

    private createCustomOrder = () => {
        const { PosStore, UnitsStore, SettingsStore } = this.props;
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
    };

    addItemAndCheckout = async () => {
        this.createCustomOrder();

        const { PosStore, navigation } = this.props;

        await PosStore?.processCheckout(navigation, false);
    };

    addItemAndQuickPay = async () => {
        this.createCustomOrder();

        const { PosStore, navigation } = this.props;

        await PosStore?.processCheckout(navigation, true);
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
