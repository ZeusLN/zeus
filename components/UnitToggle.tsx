import * as React from 'react';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';

import UnitsStore from '../stores/UnitsStore';
import SettingsStore from '../stores/SettingsStore';

import { themeColor } from '../utils/ThemeUtils';

interface UnitToggleProps {
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
    onToggle?: () => void;
    amount?: string;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class UnitToggle extends React.Component<UnitToggleProps, {}> {
    render() {
        const { UnitsStore, SettingsStore, onToggle, amount } = this.props;
        const { changeUnits, units } = UnitsStore!;
        const { settings, cycleFiat } = SettingsStore!;
        const { fiat, fiats } = settings;

        // Check if amount is effectively zero
        const isAmountZero = !amount || amount === '0' || amount === '';

        const handlePress = () => {
            // If amount > 0 AND in fiat mode AND multiple fiats: cycle fiats (keep amount)
            if (
                !isAmountZero &&
                units === 'fiat' &&
                fiats &&
                fiats.length > 1
            ) {
                cycleFiat();
            } else {
                // Normal unit change: sats → BTC → fiat (clears amount)
                if (onToggle) onToggle();
                changeUnits();
            }
        };

        return (
            <React.Fragment>
                <Button
                    title={units === 'fiat' ? fiat : units}
                    icon={{
                        name: 'import-export',
                        size: 25,
                        color: themeColor('buttonText')
                    }}
                    adaptiveWidth
                    quaternary
                    noUppercase
                    onPress={handlePress}
                />
            </React.Fragment>
        );
    }
}
