import * as React from 'react';
import { Animated, View, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import Conversion from '../../components/Conversion';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import WalletHeader from '../../components/WalletHeader';

import ChannelsStore from '../../stores/ChannelsStore';
import FiatStore from '../../stores/FiatStore';
import UnitsStore, { SATS_PER_BTC } from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';
import PosStore from '../../stores/PosStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { getDecimalPlaceholder } from '../../utils/UnitsUtils';

import { PricedIn } from '../../models/Product';

interface PosKeypadPaneProps {
    navigation: any;
    ChannelsStore?: ChannelsStore;
    FiatStore?: FiatStore;
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
    PosStore?: PosStore;
}

interface PosKeypadPaneState {
    amount: string;
}

const MAX_LENGTH = 10;

@inject('ChannelsStore', 'FiatStore', 'UnitsStore', 'SettingsStore', 'PosStore')
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
        const { units } = this.props.UnitsStore!;

        let newAmount;

        // only allow one decimal
        if (amount.includes('.') && value === '.') return this.startShake();

        // limit decimal places depending on units
        if (units === 'fiat') {
            if (amount.split('.')[1] && amount.split('.')[1].length == 2)
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
            ]).start(),
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
            ]).start()
        ]);
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

        order.line_items.push({
            name: localeString('pos.customItem'),
            quantity: 1,
            base_price_money: {
                amount: units === PricedIn.Fiat ? Number(amount) : 0,
                sats:
                    units === PricedIn.Sats
                        ? Number(amount)
                        : units === PricedIn.Bitcoin
                        ? Number(amount) * SATS_PER_BTC
                        : 0
            }
        });

        PosStore.recalculateCurrentOrder();

        await PosStore.saveStandaloneOrder(order);

        navigation.navigate('Order', { order });
    };

    render() {
        const { FiatStore, UnitsStore, navigation } = this.props;
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
                        {FiatStore.numberWithCommas(amount)}
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
                            bottom: 10
                        }}
                    >
                        <View style={{ width: '100%' }}>
                            <Button
                                title={localeString(
                                    'general.request'
                                ).toUpperCase()}
                                quinary
                                noUppercase
                                onPress={() => {
                                    this.addItemAndCheckout();
                                }}
                                buttonStyle={{ height: 40 }}
                                disabled={!amount || amount == '0'}
                            />
                        </View>
                    </View>
                </View>
            </View>
        );
    }
}
