import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from './Amount';
import TextInput from './TextInput';
import { Row } from './layout/Row';

import { themeColor } from '../utils/ThemeUtils';

import Stores from '../stores/Stores';
import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore, { SATS_PER_BTC } from '../stores/UnitsStore';

import ExchangeBitcoinSVG from '../assets/images/SVG/ExchangeBitcoin.svg';
import ExchangeFiatSVG from '../assets/images/SVG/ExchangeFiat.svg';

interface AmountInputProps {
    onAmountChange: (amount: string, satAmount: string | number) => void;
    amount?: string;
    sats?: string;
    locked?: boolean;
    title?: string;
    hideConversion?: boolean;
    hideUnitChangeButton?: boolean;
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
    prefix?: any;
    error?: boolean;
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
    const value = amount ? amount.toString().replace(/,/g, ',') : '';

    const fiatEntry =
        fiat && fiatRates
            ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
            : null;

    const rate = fiat && fiatRates && fiatEntry ? fiatEntry.rate : 0;

    let satAmount: string | number = 0;
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
    const { fiatStore, settingsStore, unitsStore } = Stores;
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

    let amount: string;
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

        const { amount, sats, onAmountChange } = props;
        let satAmount = '0';
        if (amount) satAmount = getSatAmount(amount).toString();
        if (sats) satAmount = sats;

        onAmountChange(amount, satAmount);
        this.state = {
            satAmount
        };
    }

    componentDidMount() {
        const { amount, onAmountChange }: any = this.props;
        const satAmount = amount ? getSatAmount(amount) : 0;
        onAmountChange(amount, satAmount);
        this.setState({ satAmount });
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
        const satAmount = amount ? getSatAmount(amount) : 0;
        onAmountChange(amount, satAmount);
        this.setState({ satAmount });
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
            prefix,
            error
        } = this.props;
        const { units }: any = UnitsStore;
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
                <Row>
                    {prefix ? prefix : undefined}
                    <TextInput
                        keyboardType="numeric"
                        placeholder={'0'}
                        value={amount || sats ? getAmount(sats) : undefined}
                        onChangeText={(text: string) => {
                            // remove spaces and non-numeric chars
                            const formatted = text.replace(/[^\d.,-]/g, '');
                            const satAmount = formatted
                                ? getSatAmount(formatted)
                                : 0;
                            onAmountChange(formatted, satAmount);
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
                                {getRate(units === 'sats')}
                            </Text>
                        )}
                        {fiatEnabled && units !== 'fiat' && (
                            <Amount sats={satAmount} fixedUnits="fiat" />
                        )}
                        {units !== 'BTC' && (
                            <Amount sats={satAmount} fixedUnits="BTC" />
                        )}
                        {units !== 'sats' && (
                            <Amount sats={satAmount} fixedUnits="sats" />
                        )}
                    </View>
                )}
            </React.Fragment>
        );
    }
}

export { getSatAmount };
