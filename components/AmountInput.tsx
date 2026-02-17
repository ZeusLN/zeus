import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from './Amount';
import { Row } from './layout/Row';

import { themeColor } from '../utils/ThemeUtils';
import { getSatAmount } from '../utils/AmountUtils';
import {
    SATS_PER_BTC,
    formatBitcoinWithSpaces,
    numberWithCommas
} from '../utils/UnitsUtils';

import { fiatStore, settingsStore, unitsStore } from '../stores/Stores';
import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import ExchangeBitcoinSVG from '../assets/images/SVG/ExchangeBitcoin.svg';
import ExchangeFiatSVG from '../assets/images/SVG/ExchangeFiat.svg';

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

    componentDidUpdate(prevProps: Readonly<AmountInputProps>): void {
        const { amount, forceUnit, onAmountChange } = this.props;
        if (amount !== prevProps.amount || forceUnit !== prevProps.forceUnit) {
            if (forceUnit === 'sats' && forceUnit !== prevProps.forceUnit) {
                const currentSatAmount = getSatAmount(
                    amount || '',
                    prevProps.forceUnit
                );
                this.setState({ satAmount: currentSatAmount });

                onAmountChange(currentSatAmount.toString(), currentSatAmount);
            } else {
                const satAmount = getSatAmount(amount || '', forceUnit);
                if (satAmount !== this.state.satAmount) {
                    this.setState({ satAmount });
                }
            }
        }
    }

    onChangeUnits = () => {
        const { amount, onAmountChange, UnitsStore }: any = this.props;
        UnitsStore.changeUnits();
        const satAmount = getSatAmount(amount, this.props.forceUnit);
        onAmountChange(amount, satAmount);
        this.setState({ satAmount });
    };

    getDisplayValue = (): string => {
        const { amount, sats } = this.props;
        return amount !== undefined ? amount : sats ? getAmount(sats) : '0';
    };

    openKeypad = () => {
        if (!this.props.locked) {
            const { hideUnitChangeButton } = this.props;
            const displayValue = this.getDisplayValue();

            // Navigate to keypad view with callback
            NavigationService.navigate('AmountKeypad', {
                initialAmount: displayValue || '0',
                hideUnitChangeButton,
                onConfirm: (newAmount: string) => {
                    const { onAmountChange, forceUnit } = this.props;
                    const satAmount = getSatAmount(newAmount, forceUnit);
                    onAmountChange(newAmount, satAmount);
                    this.setState({ satAmount });
                }
            });
        }
    };

    render() {
        const { satAmount } = this.state;
        const {
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
        const { getRate }: any = FiatStore;
        const { settings }: any = SettingsStore;
        const { fiatEnabled } = settings;
        const displayValue = this.getDisplayValue();

        let formattedAmount: string;
        if (effectiveUnits === 'BTC') {
            formattedAmount = `₿ ${formatBitcoinWithSpaces(
                displayValue || '0'
            )}`;
        } else if (effectiveUnits === 'fiat') {
            formattedAmount = FiatStore!.formatAmountForDisplay(
                displayValue || '0'
            );
        } else {
            const isSingular = parseFloat(displayValue) === 1;
            formattedAmount = `${numberWithCommas(displayValue || '0')} ${
                isSingular ? 'sat' : 'sats'
            }`;
        }

        return (
            <React.Fragment>
                {title && (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('secondaryText'),
                            fontSize: 14,
                            marginBottom: 5
                        }}
                    >
                        {title}
                    </Text>
                )}
                <Row>
                    {prefix ? prefix : undefined}
                    <TouchableOpacity
                        onPress={this.openKeypad}
                        disabled={locked}
                        activeOpacity={0.7}
                        style={[
                            styles.amountDisplay,
                            {
                                backgroundColor: themeColor('secondary'),
                                borderWidth: error ? 1 : 0,
                                borderColor: error
                                    ? themeColor('error')
                                    : undefined,
                                opacity: locked ? 0.8 : 1
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.amountText,
                                {
                                    color:
                                        displayValue === '0' ||
                                        displayValue === ''
                                            ? themeColor('secondaryText')
                                            : themeColor('text')
                                }
                            ]}
                        >
                            {formattedAmount}
                        </Text>
                    </TouchableOpacity>
                    {!hideUnitChangeButton && !locked && (
                        <TouchableOpacity
                            onPress={() => this.onChangeUnits()}
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
    },
    amountDisplay: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        top: 10,
        borderRadius: 6,
        marginBottom: 20,
        paddingLeft: 10,
        paddingRight: 10,
        overflow: 'hidden'
    },
    amountText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 20
    }
});
