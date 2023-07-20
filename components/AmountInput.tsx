import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from './Amount';
import TextInput from './TextInput';

import { themeColor } from '../utils/ThemeUtils';

import Stores from '../stores/Stores';
import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore, { SATS_PER_BTC } from '../stores/UnitsStore';

interface AmountInputProps {
    onAmountChange: (amount: string, satAmount: string | number) => void;
    amount?: string;
    locked?: boolean;
    title: string;
    hideConversion?: boolean;
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
}

interface AmountInputState {
    satAmount: string | number;
}

const getSatAmount = (amount: string | number) => {
    const { fiatStore, settingsStore, unitsStore } = Stores;
    const { fiatRates } = fiatStore;
    const { settings } = settingsStore;
    const { fiat } = settings;
    const { units } = unitsStore;

    // replace , with . for unit separator
    const value = amount.toString().replace(/,/g, ',') || '0';

    const fiatEntry =
        fiat && fiatRates
            ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
            : null;

    const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

    let satAmount: string | number;
    switch (units) {
        case 'sats':
            satAmount = value;
            break;
        case 'BTC':
            satAmount = new BigNumber(value || 0)
                .multipliedBy(SATS_PER_BTC)
                .toNumber();
            break;
        case 'fiat':
            satAmount = rate
                ? new BigNumber(value.toString().replace(/,/g, '.'))
                      .dividedBy(rate)
                      .multipliedBy(SATS_PER_BTC)
                      .toNumber()
                      .toFixed(0)
                : 0;
            break;
    }

    return satAmount;
};

@inject('FiatStore', 'SettingsStore', 'UnitsStore')
@observer
export default class AmountInput extends React.Component<
    AmountInputProps,
    AmountInputState
> {
    constructor(props: any) {
        super(props);

        const { amount, onAmountChange } = props;
        let satAmount = '0';
        if (amount) {
            // reset units to sats if amount is passed in
            this.props.UnitsStore?.resetUnits();
            satAmount = getSatAmount(amount).toString();
        }

        onAmountChange(amount, satAmount);
        this.state = {
            satAmount
        };
    }

    UNSAFE_componentWillReceiveProps(
        nextProps: Readonly<AmountInputProps>
    ): void {
        const { amount } = nextProps;
        if (amount) {
            const satAmount = getSatAmount(amount);
            this.setState({ satAmount });
        }
    }

    onChangeUnits = () => {
        const { amount, onAmountChange, UnitsStore }: any = this.props;
        UnitsStore.changeUnits();
        const satAmount = getSatAmount(amount);
        onAmountChange(amount, satAmount);
        this.setState({ satAmount });
    };

    render() {
        const { satAmount } = this.state;
        const {
            amount,
            onAmountChange,
            title,
            locked,
            hideConversion,
            FiatStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { units }: any = UnitsStore;
        const { getRate, getSymbol }: any = FiatStore;
        const { settings }: any = SettingsStore;
        const { fiatEnabled } = settings;

        return (
            <React.Fragment>
                {title && (
                    <TouchableOpacity
                        onPress={() => !locked && this.onChangeUnits()}
                    >
                        <Text
                            style={{
                                fontFamily: 'Lato-Regular',
                                color: themeColor('secondaryText')
                            }}
                        >
                            {title}
                        </Text>
                    </TouchableOpacity>
                )}
                <TextInput
                    keyboardType="numeric"
                    placeholder={'0'}
                    value={amount}
                    onChangeText={(text: string) => {
                        const satAmount = getSatAmount(text);
                        onAmountChange(text, satAmount);
                        this.setState({ satAmount });
                    }}
                    locked={locked}
                    prefix={
                        units !== 'sats' &&
                        (units === 'BTC'
                            ? '₿'
                            : !getSymbol().rtl
                            ? getSymbol().symbol
                            : null)
                    }
                    suffix={
                        units === 'sats'
                            ? units
                            : getSymbol().rtl &&
                              units === 'fiat' &&
                              getSymbol().symbol
                    }
                    toggleUnits={() => !locked && this.onChangeUnits()}
                />
                {!hideConversion && (
                    <TouchableOpacity
                        onPress={() => !locked && this.onChangeUnits()}
                    >
                        <View style={{ marginBottom: 10 }}>
                            {fiatEnabled && units !== 'fiat' && (
                                <Amount sats={satAmount} fixedUnits="fiat" />
                            )}
                            {fiatEnabled && (
                                <Text
                                    style={{
                                        fontFamily: 'Lato-Regular',
                                        color: themeColor('text')
                                    }}
                                >
                                    {getRate(units === 'sats')}
                                </Text>
                            )}
                            {units !== 'sats' && (
                                <Amount sats={satAmount} fixedUnits="sats" />
                            )}
                            {units !== 'BTC' && (
                                <Amount sats={satAmount} fixedUnits="BTC" />
                            )}
                        </View>
                    </TouchableOpacity>
                )}
            </React.Fragment>
        );
    }
}

export { getSatAmount };
