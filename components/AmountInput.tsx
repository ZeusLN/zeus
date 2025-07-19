import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from './Amount';
import TextInput from './TextInput';
import { Row } from './layout/Row';

import { themeColor } from '../utils/ThemeUtils';
import { SATS_PER_BTC } from '../utils/UnitsUtils';

import { fiatStore, settingsStore, unitsStore } from '../stores/Stores';
import FiatStore from '../stores/FiatStore';
import SettingsStore, { CURRENCY_KEYS } from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import ExchangeBitcoinSVG from '../assets/images/SVG/ExchangeBitcoin.svg';
import ExchangeFiatSVG from '../assets/images/SVG/ExchangeFiat.svg';
import Icon from 'react-native-vector-icons/Feather';

import NavigationService from '../NavigationService';

interface AmountInputProps {
    onAmountChange: (amount: string, satAmount: string | number) => void;
    amount?: string;
    sats?: string;
    locked?: boolean;
    title?: string;
    hideConversion?: boolean;
    hideUnitChangeButton?: boolean;
    forceUnit?: 'sats' | 'BTC' | 'fiat';
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
    prefix?: any;
    error?: boolean;
}

interface AmountInputState {
    satAmount: string | number;
}

const getSatAmount = (amount: string | number, forceUnit?: string) => {
    const { fiatRates } = fiatStore;
    const { settings } = settingsStore;
    const { fiat } = settings;
    const { units } = unitsStore;
    const effectiveUnits = forceUnit || units;

    // replace , with . for unit separator
    const value = amount ? amount.toString().replace(/,/g, ',') : '';

    const fiatEntry =
        fiat && fiatRates
            ? fiatRates.find((entry: any) => entry.code === fiat)
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

const getAmount = (sats: string | number) => {
    const { fiatRates } = fiatStore;
    const { settings } = settingsStore;
    const { fiat } = settings;
    const { units } = unitsStore;

    // replace , with . for unit separator
    const value = sats ? sats.toString().replace(/,/g, ',') : '';

    const fiatEntry =
        fiat && fiatRates
            ? fiatRates.find((entry: any) => entry.code === fiat)
            : null;

    const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

    let amount: string = '';
    switch (units) {
        case 'sats':
            amount = value;
            break;
        case 'BTC':
            amount = new BigNumber(value || 0).div(SATS_PER_BTC).toString();
            break;
        case 'fiat':
            amount = rate
                ? new BigNumber(value.toString().replace(/,/g, '.'))
                      .times(rate)
                      .div(SATS_PER_BTC)
                      .toNumber()
                      .toFixed(0)
                : '0';
            break;
    }

    return amount;
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

    getFlagEmoji = (currencyValue: string) => {
        if (
            currencyValue === 'XAF' ||
            currencyValue == 'XAU' ||
            currencyValue == 'XAG'
        ) {
            return '';
        }
        const currency = CURRENCY_KEYS.find(
            (currency) => currency.value === currencyValue
        );
        if (currency) {
            return currency.key.split(' ')[0];
        }
        return '';
    };

    render() {
        const { satAmount } = this.state;
        const {
            amount,
            sats,
            onAmountChange,
            title,
            locked,
            hideConversion,
            hideUnitChangeButton,
            FiatStore,
            UnitsStore,
            SettingsStore,
            forceUnit,
            prefix,
            error
        } = this.props;
        const { units }: any = UnitsStore;
        const effectiveUnits = forceUnit || units;
        const { getRate, getSymbol }: any = FiatStore;
        const { settings }: any = SettingsStore;
        const { fiatEnabled } = settings;
        const fiat = settings.fiat;

        return (
            <React.Fragment>
                {title && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 5,
                            height: 24
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('secondaryText'),
                                fontSize: 14
                            }}
                        >
                            {title}
                        </Text>
                        {fiatEnabled && effectiveUnits === 'fiat' && (
                            <TouchableOpacity
                                onPress={() => {
                                    NavigationService.navigate(
                                        'SelectCurrency'
                                    );
                                }}
                                activeOpacity={0.5}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 4,
                                    paddingHorizontal: 10,
                                    borderRadius: 16,
                                    backgroundColor: themeColor('secondary'),
                                    borderWidth: 1,
                                    borderColor: themeColor('highlight')
                                }}
                            >
                                <Row style={styles.row}>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Medium',
                                            marginRight: 4
                                        }}
                                    >
                                        {this.getFlagEmoji(fiat)}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Medium',
                                            marginRight: 4
                                        }}
                                    >
                                        {fiat}
                                    </Text>
                                    <Icon
                                        name="chevron-right"
                                        size={12}
                                        color={themeColor('text')}
                                    />
                                </Row>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                <Row>
                    {prefix ? prefix : undefined}
                    <TextInput
                        keyboardType="numeric"
                        placeholder={'0'}
                        value={
                            amount !== undefined
                                ? amount
                                : sats
                                ? getAmount(sats)
                                : undefined
                        }
                        onChangeText={(text: string) => {
                            // remove spaces and non-numeric chars
                            const formatted = text.replace(/[^\d.,-]/g, '');
                            const satAmount = getSatAmount(
                                formatted,
                                forceUnit
                            );
                            onAmountChange(formatted, satAmount);
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
                        error={error}
                    />
                    {!hideUnitChangeButton && (
                        <TouchableOpacity
                            onPress={() => !locked && this.onChangeUnits()}
                            style={{ marginLeft: 15 }}
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
                </Row>
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

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center'
    }
});
