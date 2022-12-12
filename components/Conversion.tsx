import * as React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import Amount from '../components/Amount';

import FiatStore from '../stores/UnitsStore';
import UnitsStore, { SATS_PER_BTC } from '../stores/UnitsStore';
import SettingsStore, { DEFAULT_FIAT } from '../stores/SettingsStore';

import { themeColor } from '../utils/ThemeUtils';

interface ConversionProps {
    amount: string | number;
    sats: string | number;
    FiatStore: FiatStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
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
        const { amount, sats, FiatStore, UnitsStore, SettingsStore } =
            this.props;
        const { showRate } = this.state;
        const { units } = UnitsStore;
        const { settings } = SettingsStore;
        const { fiat } = settings;

        const { fiatRates, getRate }: any = FiatStore;

        // calculate fiat rate
        const fiatEntry =
            fiat && fiatRates && fiatRates.filter
                ? fiatRates.filter((entry: any) => entry.code === fiat)[0]
                : null;

        const rate =
            fiat && fiat !== 'Disabled' && fiatRates && fiatEntry
                ? fiatEntry.rate
                : 0;

        let satAmount: string | number;
        if (amount) {
            const amountStr = amount.toString();
            switch (units) {
                case 'sats':
                    satAmount = amountStr;
                    break;
                case 'BTC':
                    satAmount = Number(amountStr) * SATS_PER_BTC;
                    break;
                case 'fiat':
                    satAmount = Number(
                        (Number(amountStr.replace(/,/g, '.')) / Number(rate)) *
                            Number(SATS_PER_BTC)
                    ).toFixed(0);
                    break;
            }
        } else if (sats) {
            satAmount = sats;
        }

        if (!fiat || fiat === DEFAULT_FIAT || (!amount && !sats)) return;

        // TODO negative is hardcoded to false because we're inconsistent
        // an on-chain debit is a negative number, but a lightning debit isn't
        return (
            <>
                {units === 'fiat' && (
                    <TouchableOpacity
                        style={{ alignItems: 'center' }}
                        onPress={() => this.toggleShowRate()}
                    >
                        <Amount sats={satAmount} fixedUnits="sats" />
                        {showRate && (
                            <Text style={{ color: themeColor('text') }}>
                                {getRate()}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
                {units !== 'fiat' && (
                    <TouchableOpacity
                        style={{ alignItems: 'center' }}
                        onPress={() => this.toggleShowRate()}
                    >
                        <Amount sats={satAmount} fixedUnits="fiat" />
                        {showRate && (
                            <Text style={{ color: themeColor('text') }}>
                                {getRate()}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </>
        );
    }
}
