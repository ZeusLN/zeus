import * as React from 'react';
import { View } from 'react-native';
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
    credit?: boolean;
    debit?: boolean;
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
    credit = false,
    debit = false
}: AmountDisplayProps) {
    if (unit === 'fiat' && !symbol) {
        console.error('Must include a symbol when rendering fiat');
    }

    const actualSymbol = unit === 'btc' ? '₿' : symbol;

    switch (unit) {
        case 'sats':
            return (
                <Row align="flex-end">
                    <Body jumbo={jumboText} credit={credit} debit={debit}>
                        {amount}
                    </Body>
                    <Spacer width={2} />
                    <View style={{ paddingBottom: jumboText ? 8 : 1.5 }}>
                        <Body
                            secondary
                            small={!jumboText}
                            credit={credit}
                            debit={debit}
                        >
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
                        <Body jumbo={jumboText} credit={credit} debit={debit}>
                            {negative ? '-' : ''}
                            {amount}
                        </Body>
                        {space ? (
                            <Body
                                jumbo={jumboText}
                                credit={credit}
                                debit={debit}
                            >
                                {' '}
                            </Body>
                        ) : (
                            <Spacer width={1} />
                        )}
                        <Body
                            secondary
                            jumbo={jumboText}
                            credit={credit}
                            debit={debit}
                        >
                            {actualSymbol}
                        </Body>
                    </Row>
                );
            } else {
                return (
                    <Row align="flex-end">
                        <Body
                            secondary
                            jumbo={jumboText}
                            credit={credit}
                            debit={debit}
                        >
                            {actualSymbol}
                        </Body>
                        {space ? (
                            <Body
                                jumbo={jumboText}
                                credit={credit}
                                debit={debit}
                            >
                                {' '}
                            </Body>
                        ) : (
                            <Spacer width={1} />
                        )}
                        <Body jumbo={jumboText} credit={credit} debit={debit}>
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
            debit = false
        } = this.props;
        const UnitsStore = this.props.UnitsStore!;

        // TODO: This doesn't feel like the right place for this but it makes the component "reactive"
        const units = fixedUnits ? fixedUnits : UnitsStore.units;

        let unformattedAmount = UnitsStore.getUnformattedAmount(value, units);

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

        return (
            <AmountDisplay
                {...unformattedAmount}
                jumboText={jumboText}
                credit={credit}
                debit={debit}
            />
        );
    }
}
