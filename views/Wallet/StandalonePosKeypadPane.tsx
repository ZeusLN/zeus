import * as React from 'react';
import { Animated, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import KeypadAmountDisplay from '../../components/KeypadAmountDisplay';
import PinPad from '../../components/PinPad';
import UnitToggle from '../../components/UnitToggle';
import WalletHeader from '../../components/WalletHeader';

import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import SettingsStore from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';

import {
    validateKeypadInput,
    startShakeAnimation,
    getAmountFontSize,
    deleteLastCharacter
} from '../../utils/KeypadUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { SATS_PER_BTC, getDecimalPlaceholder } from '../../utils/UnitsUtils';

import { PricedIn } from '../../models/Product';

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

        const { valid, newAmount } = validateKeypadInput(
            amount,
            value,
            units,
            FiatStore!,
            SettingsStore!
        );

        if (!valid) {
            this.startShake();
            return false;
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
        this.setState({
            amount: deleteLastCharacter(amount)
        });
    };

    amountSize = () => {
        const { amount } = this.state;
        const { units } = this.props.UnitsStore!;
        const { count } = getDecimalPlaceholder(amount, units);
        return getAmountFontSize(amount.length, count, { compact: true });
    };

    startShake = () => {
        startShakeAnimation(this.shakeAnimation, this.textAnimation);
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
        const { navigation } = this.props;
        const { amount } = this.state;

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader navigation={navigation} />

                <KeypadAmountDisplay
                    amount={amount}
                    shakeAnimation={this.shakeAnimation}
                    textAnimation={this.textAnimation}
                    fontSize={this.amountSize()}
                    showConversion={amount !== '0'}
                    conversionTop={10}
                    lineHeight={undefined}
                    childrenBeforeConversion
                    containerStyle={{
                        alignSelf: 'center',
                        bottom: 15
                    }}
                >
                    <UnitToggle onToggle={this.clearValue} />
                </KeypadAmountDisplay>

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
