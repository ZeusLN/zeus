import * as React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import Amount from '../components/Amount';

import { Row } from '../components/layout/Row';
import { getSatAmount } from '../components/AmountInput';

import FiatStore from '../stores/UnitsStore';
import UnitsStore from '../stores/UnitsStore';
import SettingsStore, { DEFAULT_FIAT } from '../stores/SettingsStore';

import { themeColor } from '../utils/ThemeUtils';

import ClockIcon from '../assets/images/SVG/Clock.svg';
import { Units } from '../enums';

interface ConversionProps {
    amount: string | number;
    sats: string | number;
    satsPending: string | number;
    FiatStore: FiatStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
    sensitive?: boolean;
}

interface ConversionState {
    showRate: boolean;
}

@inject('FiatStore', 'UnitsStore', 'SettingsStore')
@observer
export default class Conversion extends React.Component<
    ConversionProps,
    ConversionState
> {
    state = {
        showRate: false
    };

    toggleShowRate = () => {
        this.setState({
            showRate: !this.state.showRate
        });
    };

    render() {
        const {
            amount,
            sats,
            satsPending,
            FiatStore,
            UnitsStore,
            SettingsStore,
            sensitive
        } = this.props;
        const { showRate } = this.state;
        const { units } = UnitsStore;
        const { settings } = SettingsStore;
        const { fiat } = settings;

        const { getRate }: any = FiatStore;

        let satAmount: string | number;
        if (Units.sats) {
            satAmount = sats;
        } else {
            satAmount = getSatAmount(amount);
        }

        if (!fiat || fiat === DEFAULT_FIAT || (!amount && !sats)) return;

        const ConversionDisplay = ({
            units = Units.sats,
            showRate
        }: {
            units: string;
            showRate: boolean;
        }) => (
            <Row align="flex-end">
                <Amount
                    sats={satAmount}
                    fixedUnits={units}
                    sensitive={sensitive}
                    color="secondaryText"
                />
                {showRate && (
                    <>
                        <Text style={{ color: themeColor('secondaryText') }}>
                            {` | ${getRate(
                                this.props.UnitsStore.units === Units.sats
                            )}`}
                        </Text>
                    </>
                )}
            </Row>
        );

        const ConversionPendingDisplay = ({
            units = Units.sats,
            showRate
        }: {
            units: string;
            showRate: boolean;
        }) => (
            <Row align="flex-end">
                <Amount
                    sats={satAmount}
                    fixedUnits={units}
                    sensitive={sensitive}
                    color="secondaryText"
                />
                <Text style={{ color: themeColor('secondaryText') }}>
                    {' | '}
                </Text>
                <ClockIcon
                    color={themeColor('bitcoin')}
                    width={17}
                    height={17}
                />
                <Amount
                    sats={satsPending}
                    fixedUnits={units}
                    sensitive={sensitive}
                    color="secondaryText"
                />
                {showRate && (
                    <>
                        <Text style={{ color: themeColor('secondaryText') }}>
                            {` | ${getRate(
                                this.props.UnitsStore.units === Units.sats
                            )}`}
                        </Text>
                    </>
                )}
            </Row>
        );

        // TODO negative is hardcoded to false because we're inconsistent
        // an on-chain debit is a negative number, but a lightning debit isn't
        return (
            <>
                {units === Units.fiat && (
                    <TouchableOpacity onPress={() => this.toggleShowRate()}>
                        {satsPending ? (
                            <ConversionPendingDisplay
                                units={Units.sats}
                                showRate={showRate}
                            />
                        ) : (
                            <ConversionDisplay
                                units={Units.sats}
                                showRate={showRate}
                            />
                        )}
                    </TouchableOpacity>
                )}
                {units !== Units.fiat && (
                    <TouchableOpacity onPress={() => this.toggleShowRate()}>
                        {satsPending ? (
                            <ConversionPendingDisplay
                                units={Units.fiat}
                                showRate={showRate}
                            />
                        ) : (
                            <ConversionDisplay
                                units={Units.fiat}
                                showRate={showRate}
                            />
                        )}
                    </TouchableOpacity>
                )}
            </>
        );
    }
}
