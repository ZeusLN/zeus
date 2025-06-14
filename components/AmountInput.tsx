import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { StackNavigationProp } from '@react-navigation/stack';

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
    navigation: StackNavigationProp<any, any>;
}

interface AmountInputState {
    satAmount: string | number;
    forceFiat: string | undefined;
    prevForceFiat: string | undefined;
}

const getSatAmount = (
    amount: string | number,
    forceUnit?: string,
    forceFiat?: string
) => {
    const { fiatRates } = fiatStore;
    const { settings } = settingsStore;
    const fiat = forceFiat || settings.fiat;
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
            ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
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

        const { amount, onAmountChange, SettingsStore } = props;
        const { selectedForceFiat } = SettingsStore;
        let satAmount = '0';
        if (amount)
            satAmount = getSatAmount(
                amount,
                props.forceUnit,
                selectedForceFiat
            ).toString();

        onAmountChange(amount, satAmount);
        this.state = {
            satAmount,
            forceFiat: '',
            prevForceFiat: ''
        };
    }

    componentDidMount() {
        const { amount, onAmountChange, SettingsStore }: any = this.props;
        const satAmount = getSatAmount(
            amount,
            this.props.forceUnit,
            SettingsStore?.selectedForceFiat
        );
        onAmountChange(amount, satAmount);
        this.setState({
            satAmount,
            forceFiat: SettingsStore?.selectedForceFiat
        });
    }

    componentDidUpdate(
        prevProps: AmountInputProps,
        prevState: AmountInputState
    ) {
        const { amount, forceUnit, SettingsStore, onAmountChange } = this.props;
        const currentFiat = SettingsStore?.selectedForceFiat;

        if (prevState.prevForceFiat !== currentFiat) {
            const newSatAmount = getSatAmount(
                amount || '',
                forceUnit,
                currentFiat
            );
            this.setState({
                satAmount: newSatAmount,
                forceFiat: currentFiat,
                prevForceFiat: currentFiat
            });
            onAmountChange?.(amount || '', newSatAmount);
            return;
        }

        if (forceUnit === 'sats' && forceUnit !== prevProps.forceUnit) {
            const currentSatAmount = getSatAmount(
                amount || '',
                prevProps.forceUnit,
                currentFiat
            );
            this.setState({ satAmount: currentSatAmount });
            onAmountChange?.(currentSatAmount.toString(), currentSatAmount);
            return;
        }

        if (forceUnit !== prevProps.forceUnit || amount !== prevProps.amount) {
            const satAmount = getSatAmount(
                amount || '',
                forceUnit,
                currentFiat
            );
            this.setState({ satAmount });
        }
    }

    onChangeUnits = () => {
        const { amount, onAmountChange, UnitsStore, SettingsStore }: any =
            this.props;
        UnitsStore.changeUnits();
        const satAmount = getSatAmount(
            amount,
            this.props.forceUnit,
            SettingsStore.selectedForceFiat
        );
        onAmountChange(amount, satAmount);
        this.setState({ satAmount });
    };

    navigateToCurrencySelection = () => {
        const { SettingsStore, navigation }: any = this.props;

        navigation.navigate('SelectCurrency', {
            currencyConverter: false,
            fromReceive: true,
            selectedCurrency: SettingsStore.selectedForceFiat,
            onSelect: (value: string) => {
                SettingsStore.setSelectedForceFiat(value);
            }
        });
    };

    getFlagEmoji = (currencyValue: string) => {
        if (currencyValue === 'XAF') {
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
        const fiat = SettingsStore?.selectedForceFiat || settings.fiat;

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
                                    this.navigateToCurrencySelection();
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
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}
                                >
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
                                </View>
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
                                forceUnit,
                                SettingsStore?.selectedForceFiat
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
