import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from './Amount';
import TextInput from './TextInput';

import { themeColor } from '../utils/ThemeUtils';
import { SATS_PER_BTC } from '../utils/UnitsUtils';

import Stores from '../stores/Stores';
import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import ExchangeBitcoinSVG from '../assets/images/SVG/ExchangeBitcoin.svg';
import ExchangeFiatSVG from '../assets/images/SVG/ExchangeFiat.svg';

interface AmountInputProps {
    onAmountChange: (amount: string, satAmount: string | number) => void;
    amount?: string;
    locked?: boolean;
    title?: string;
    hideConversion?: boolean;
    hideUnitChangeButton?: boolean;
    forceUnit?: 'sats' | 'BTC' | 'fiat';
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
}

interface AmountInputState {
    satAmount: string | number;
}

const getSatAmount = (amount: string | number, forceUnit?: string) => {
    const { fiatStore, settingsStore, unitsStore } = Stores;
    const { fiatRates } = fiatStore;
    const { settings } = settingsStore;
    const { fiat } = settings;
    const { units } = unitsStore;
    const effectiveUnits = forceUnit || units;

    // replace , with . for unit separator
    const value = amount ? amount.toString().replace(/,/g, ',') : '';

    const fiatEntry =
        fiat && fiatRates
            ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
            : null;

    const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

    let satAmount: string | number = 0;
    switch (effectiveUnits) {
        case 'sats':
            satAmount = value;
            break;
        case 'BTC':
            satAmount = new BigNumber(value || 0)
                .multipliedBy(SATS_PER_BTC)
                .toNumber();
            break;
        case 'fiat':
            satAmount =
                rate && value
                    ? new BigNumber(value.toString().replace(/,/g, '.'))
                          .dividedBy(rate)
                          .multipliedBy(SATS_PER_BTC)
                          .toNumber()
                          .toFixed(0)
                    : 0;
            break;
        default:
            satAmount = 0;
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
        if (amount)
            satAmount = getSatAmount(amount, props.forceUnit).toString();

        onAmountChange(amount, satAmount);
        this.state = {
            satAmount
        };
    }

    componentDidMount() {
        const { amount, onAmountChange }: any = this.props;
        const satAmount = getSatAmount(amount, this.props.forceUnit);
        onAmountChange(amount, satAmount);
        this.setState({ satAmount });
    }

    UNSAFE_componentWillReceiveProps(
        nextProps: Readonly<AmountInputProps>
    ): void {
        const { amount, forceUnit } = nextProps;
        if (forceUnit === 'sats' && forceUnit !== this.props.forceUnit) {
            const currentSatAmount = getSatAmount(
                amount || '',
                this.props.forceUnit
            );
            this.setState({ satAmount: currentSatAmount });
            this.props.onAmountChange(
                currentSatAmount.toString(),
                currentSatAmount
            );
        } else {
            const satAmount = getSatAmount(amount || '', forceUnit);
            this.setState({ satAmount });
        }
    }

    onChangeUnits = () => {
        const { amount, onAmountChange, UnitsStore }: any = this.props;
        UnitsStore.changeUnits();
        const satAmount = getSatAmount(amount, this.props.forceUnit);
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
            hideUnitChangeButton,
            FiatStore,
            UnitsStore,
            SettingsStore,
            forceUnit
        } = this.props;
        const { units }: any = UnitsStore;
        const effectiveUnits = forceUnit || units;
        const { getRate, getSymbol }: any = FiatStore;
        const { settings }: any = SettingsStore;
        const { fiatEnabled } = settings;

        return (
            <React.Fragment>
                {title && (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('secondaryText')
                        }}
                    >
                        {title}
                    </Text>
                )}
                <View style={{ display: 'flex', flexDirection: 'row' }}>
                    <TextInput
                        keyboardType="numeric"
                        placeholder={'0'}
                        value={amount}
                        onChangeText={(text: string) => {
                        // Allow only numbers and a single decimal point
                        let formatted = text.replace(/[^0-9.]/g, '').replace(/,/g, '');

                        // Prevent multiple decimal points
                        let validInput = formatted.split('.').length > 2
                            ? formatted.substring(0, formatted.lastIndexOf('.'))
                            : formatted;

                        // Limit decimal places to 2 (for fiat)
                        if (validInput.includes('.')) {
                            const parts = validInput.split('.');
                            validInput = parts[0] + '.' + parts[1].slice(0, 2);
                        }

                        const satAmount = getSatAmount(validInput, forceUnit);
                        onAmountChange(validInput, satAmount);
                            this.setState({ satAmount });
                        }}
                        locked={locked}
                        prefix={
                            effectiveUnits !== 'sats' &&
                            (effectiveUnits === 'BTC'
                                ? '₿'
                                : !getSymbol().rtl
                                ? getSymbol().symbol
                                : null)
                        }
                        suffix={
                            effectiveUnits === 'sats'
                                ? effectiveUnits
                                : getSymbol().rtl &&
                                  effectiveUnits === 'fiat' &&
                                  getSymbol().symbol
                        }
                        style={{
                            flex: 1,
                            flexDirection: 'row'
                        }}
                    />
                    {!hideUnitChangeButton && (
                        <TouchableOpacity
                            onPress={() => !locked && this.onChangeUnits()}
                            style={{ marginTop: 22, marginLeft: 15 }}
                        >
                            {UnitsStore!.getNextUnit() === 'fiat' ? (
                                <ExchangeFiatSVG
                                    fill={themeColor('text')}
                                    width="35"
                                    height="35"
                                />
                            ) : (
                                <ExchangeBitcoinSVG
                                    fill={themeColor('text')}
                                    width="35"
                                    height="35"
                                />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
                {!hideConversion && (
                    <View style={{ marginBottom: 10 }}>
                        {fiatEnabled && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('text')
                                }}
                            >
                                {getRate(effectiveUnits === 'sats')}
                            </Text>
                        )}
                        {fiatEnabled && effectiveUnits !== 'fiat' && (
                            <Amount sats={satAmount} fixedUnits="fiat" />
                        )}
                        {effectiveUnits !== 'BTC' && (
                            <Amount sats={satAmount} fixedUnits="BTC" />
                        )}
                        {effectiveUnits !== 'sats' && (
                            <Amount sats={satAmount} fixedUnits="sats" />
                        )}
                    </View>
                )}
            </React.Fragment>
        );
    }
}

export { getSatAmount };
