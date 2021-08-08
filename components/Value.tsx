import * as React from 'react';
import { View } from 'react-native';
import { Body } from '../components/text/Body';
import { Row } from '../components/layout/Row';
import { Spacer } from '../components/layout/Spacer';
import { inject, observer } from 'mobx-react';
import type UnitsStore from '../stores/UnitsStore';
import PrivacyUtils from '../utils/PrivacyUtils';

export const satoshisPerBTC = 100000000;

type Units = 'sats' | 'btc' | 'fiat';

interface ValueDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    plural?: boolean;
    rtl?: boolean;
    space?: boolean;
    jumbo?: boolean;
}

function ValueDisplay({
    amount,
    unit,
    symbol,
    negative = false,
    plural = false,
    rtl = false,
    space = false,
    jumbo = false
}: ValueDisplayProps) {
    if (unit === 'fiat' && !symbol) {
        console.error('Must include a symbol when rendering fiat');
    }

    const actualSymbol = unit === 'btc' ? '₿' : symbol;

    switch (unit) {
        case 'sats':
            return (
                <Row align="flex-end">
                    <Body jumbo={jumbo}>{amount}</Body>
                    <Spacer width={2} />
                    <View style={{ paddingBottom: jumbo ? 8 : 1.5 }}>
                        <Body secondary small={!jumbo}>
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
                        <Body jumbo={jumbo}>
                            {negative ? '-' : ''}
                            {amount}
                        </Body>
                        {space ? <Body jumbo={jumbo}>{' '}</Body> : <Spacer width={1} />} 
                        <Body secondary jumbo={jumbo}>{actualSymbol}</Body>
                    </Row>
                );
            } else {
                return (
                    <Row align="flex-end">
                        <Body secondary jumbo={jumbo}>{actualSymbol}</Body>
                        {space ? <Body jumbo={jumbo}>{' '}</Body> : <Spacer width={1} />} 
                        <Body jumbo={jumbo}>
                            {negative ? '-' : ''}
                            {amount}
                        </Body>
                    </Row>
                );
            }
    }
}

interface ValueProps {
    UnitsStore?: UnitsStore;
    sats: number | string;
    fixedUnits?: string;
    sensitive?: boolean;
    sensitiveLength?: number;
    jumbo?: boolean;
}

@inject('UnitsStore')
@observer
export class Value extends React.Component<ValueProps, {}> {
    render() {
        const { sats: value, fixedUnits, sensitive = false, sensitiveLength = 4, jumbo = false } = this.props;
        const UnitsStore = this.props.UnitsStore!;

        // TODO: This doesn't feel like the right place for this but it makes the component "reactive"
        const units = fixedUnits ? fixedUnits : UnitsStore.units; 

        let unformattedAmount = UnitsStore.getUnformattedAmount(
            value,
            units 
        );

        console.log({unformattedAmount})

        if (sensitive) {
            let amount = unformattedAmount.amount;

            // This should be a string because sensitiveValue can only return a date if you pass it a date
            // TODO: can we do better than hardcoding these?
            unformattedAmount.amount = PrivacyUtils.sensitiveValue(amount, sensitiveLength, true) as string;
            console.log({unformattedAmount})
        }

        return <ValueDisplay {...unformattedAmount} jumbo={jumbo} />;
    }
}
