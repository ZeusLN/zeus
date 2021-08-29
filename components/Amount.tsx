import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Body } from './text/Body';
import { Row } from './layout/Row';
import { Spacer } from './layout/Spacer';
import { inject, observer } from 'mobx-react';
import UnitsStore from '../stores/UnitsStore';
import PrivacyUtils from '../utils/PrivacyUtils';

export const satoshisPerBTC = 100000000;

type Units = 'sats' | 'btc' | 'fiat';

interface AmountDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    plural?: boolean;
    rtl?: boolean;
    space?: boolean;
    jumboText?: boolean;
    color?: 'text' | 'success' | 'warning' | 'highlight' | 'secondaryText';
}

function AmountDisplay({
    amount,
    unit,
    symbol,
    negative = false,
    plural = false,
    rtl = false,
    space = false,
    jumboText = false,
    color = undefined
}: AmountDisplayProps) {
    if (unit === 'fiat' && !symbol) {
        console.error('Must include a symbol when rendering fiat');
    }

    const actualSymbol = unit === 'btc' ? '₿' : symbol;

    // TODO this could probably be made more readable by componentizing the repeat bits
    switch (unit) {
        case 'sats':
            return (
                <Row align="flex-end">
                    <Body jumbo={jumboText} color={color}>
                        {amount}
                    </Body>
                    <Spacer width={2} />
                    <View style={{ paddingBottom: jumboText ? 8 : 1.5 }}>
                        <Body secondary small={!jumboText} color={color}>
                            {plural ? 'sats' : 'sat'}
                        </Body>
                    </View>
                </Row>
            );
        case 'btc':
        case 'fiat':
            if (rtl) {
                return (
                    <Row align="flex-end">
                        <Body jumbo={jumboText} color={color}>
                            {negative ? '-' : ''}
                            {amount}
                        </Body>
                        {space ? (
                            <Body jumbo={jumboText} color={color}>
                                {' '}
                            </Body>
                        ) : (
                            <Spacer width={1} />
                        )}
                        <Body secondary jumbo={jumboText} color={color}>
                            {actualSymbol}
                        </Body>
                    </Row>
                );
            } else {
                return (
                    <Row align="flex-end">
                        <Body secondary jumbo={jumboText} color={color}>
                            {actualSymbol}
                        </Body>
                        {space ? (
                            <Body jumbo={jumboText} color={color}>
                                {' '}
                            </Body>
                        ) : (
                            <Spacer width={1} />
                        )}
                        <Body jumbo={jumboText} color={color}>
                            {negative ? '-' : ''}
                            {amount.toString()}
                        </Body>
                    </Row>
                );
            }
    }
}

interface AmountProps {
    UnitsStore?: UnitsStore;
    sats: number | string;
    fixedUnits?: string;
    sensitive?: boolean;
    sensitiveLength?: number;
    jumboText?: boolean;
    credit?: boolean;
    debit?: boolean;
    // If credit or debit doesn't cover the use case
    color?: 'text' | 'success' | 'warning' | 'highlight' | 'secondaryText';
    toggleable?: boolean;
}

@inject('UnitsStore')
@observer
export class Amount extends React.Component<AmountProps, {}> {
    render() {
        const {
            sats: value,
            fixedUnits,
            sensitive = false,
            sensitiveLength = 4,
            jumboText = false,
            credit = false,
            debit = false,
            toggleable = false,
            color = undefined
        } = this.props;
        const UnitsStore = this.props.UnitsStore!;

        // TODO: This doesn't feel like the right place for this but it makes the component "reactive"
        const units = fixedUnits ? fixedUnits : UnitsStore.units;

        let unformattedAmount = UnitsStore.getUnformattedAmount(value, units);

        const textColor = debit
            ? 'warning'
            : credit
            ? 'success'
            : color
            ? color
            : undefined;

        if (sensitive) {
            let amount = unformattedAmount.amount;

            // This should be a string because sensitiveValue can only return a date if you pass it a date
            // TODO: can we do better than hardcoding these?
            unformattedAmount.amount = PrivacyUtils.sensitiveValue(
                amount,
                sensitiveLength,
                true
            ) as string;
        }

        if (toggleable) {
            return (
                <TouchableOpacity onPress={() => UnitsStore.changeUnits()}>
                    <AmountDisplay
                        {...unformattedAmount}
                        negative={false}
                        jumboText={jumboText}
                        color={textColor}
                    />
                </TouchableOpacity>
            );
        }

        // TODO negative is hardcoded to false because we're inconsistent
        // an on-chain debit is a negative number, but a lightning debit isn't
        return (
            <AmountDisplay
                {...unformattedAmount}
                negative={false}
                jumboText={jumboText}
                color={textColor}
            />
        );
    }
}
