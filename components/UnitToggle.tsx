import * as React from 'react';
import { View, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';

import UnitsStore from '../stores/UnitsStore';
import SettingsStore, { CURRENCY_KEYS } from '../stores/SettingsStore';

import { themeColor } from '../utils/ThemeUtils';

interface UnitToggleProps {
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
    onToggle?: () => void;
    onOpenModal?: () => void;
}

const getFlagForFiat = (fiatCode: string): string => {
    const currency = CURRENCY_KEYS.find((c) => c.value === fiatCode);
    return currency?.flag || '';
};

// Split a string of multiple flag emojis into individual flags
const splitFlags = (flags: string): string[] => {
    if (!flags) return [];
    const flagRegex = /\p{Regional_Indicator}{2}/gu;
    const matches = flags.match(flagRegex);
    return matches || [flags];
};

@inject('UnitsStore', 'SettingsStore')
@observer
export default class UnitToggle extends React.Component<UnitToggleProps, {}> {
    render() {
        const { UnitsStore, SettingsStore, onToggle, onOpenModal } = this.props;
        const { changeUnits, units } = UnitsStore!;
        const { settings } = SettingsStore!;
        const { fiat, fiatEnabled } = settings;

        const getDisplayTitle = (): string | React.ReactElement => {
            if (units === 'fiat' && fiat) {
                const flag = getFlagForFiat(fiat);
                if (flag) {
                    const flags = splitFlags(flag);
                    if (flags.length > 1) {
                        // Multiple flags - stack them vertically
                        return (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: 'column',
                                        marginRight: 4
                                    }}
                                >
                                    {flags.slice(0, 3).map((f, idx) => (
                                        <Text
                                            key={idx}
                                            style={{
                                                fontSize: 8,
                                                lineHeight: 10
                                            }}
                                        >
                                            {f}
                                        </Text>
                                    ))}
                                </View>
                                <Text
                                    style={{ color: themeColor('buttonText') }}
                                >
                                    {fiat}
                                </Text>
                            </View>
                        );
                    }
                    return `${flag} ${fiat}`;
                }
                return fiat;
            }
            return units;
        };

        const handlePress = () => {
            if (fiatEnabled && onOpenModal) {
                onOpenModal();
            } else {
                if (onToggle) onToggle();
                changeUnits();
            }
        };

        return (
            <React.Fragment>
                <Button
                    title={getDisplayTitle()}
                    icon={{
                        name: 'import-export',
                        size: 20,
                        color: themeColor('buttonText')
                    }}
                    adaptiveWidth
                    quaternary
                    noUppercase
                    onPress={handlePress}
                    containerStyle={{ height: 40 }}
                    buttonStyle={{
                        height: 40,
                        paddingVertical: 0,
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                />
            </React.Fragment>
        );
    }
}
