import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import UnitsStore from '../stores/UnitsStore';
import PrivacyUtils from '../utils/PrivacyUtils';
import ClockIcon from '../images/SVG/Clock.svg';
import { themeColor } from '../utils/ThemeUtils';
import { Spacer } from './layout/Spacer';
import { Row } from './layout/Row';
import { Body } from './text/Body';

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
    pending?: boolean;
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
    color = undefined,
    pending = false
}: AmountDisplayProps) {
    if (unit === 'fiat' && !symbol) {
        console.error('Must include a symbol when rendering fiat');
    }

    const actualSymbol = unit === 'btc' ? '₿' : symbol;

    const Pending = () => (
        <View
            style={{
                paddingBottom: jumboText ? 8 : 2,
                paddingHorizontal: jumboText ? 0 : 1
            }}
        >
            <ClockIcon
                color={themeColor('bitcoin')}
                width={jumboText ? 30 : 15}
                height={jumboText ? 30 : 15}
            />
        </View>
    );

    const FiatSymbol = () => (
        <Body secondary jumbo={jumboText} color={color}>
            {actualSymbol}
        </Body>
    );

    const TextSpace = () => (
        <Body jumbo={jumboText} color={color}>
            {' '}
        </Body>
    );

    // TODO this could probably be made more readable by componentizing the repeat bits
    switch (unit) {
        case 'sats':
            return (
                <Row align="flex-end">
                    {pending ? <Pending /> : null}
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
                        {space ? <TextSpace /> : <Spacer width={1} />}
                        <FiatSymbol />
                        {pending ? <Pending /> : null}
                    </Row>
                );
            } else {
                return (
                    <Row align="flex-end">
                        {pending ? <Pending /> : null}
                        <FiatSymbol />
                        {space ? <TextSpace /> : <Spacer width={1} />}
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
    pending?: boolean;
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
            color = undefined,
            pending = false
        } = this.props;
        const UnitsStore = this.props.UnitsStore!;

        // TODO: This doesn't feel like the right place for this but it makes the component "reactive"
        const units = fixedUnits ? fixedUnits : UnitsStore.units;

        const unformattedAmount = UnitsStore.getUnformattedAmount(value, units);

        // display fiat amounts when rate fetch fails as $N/A
        if (unformattedAmount.error) {
            const amount = 'N/A';
            const unit = 'fiat';
            const symbol = '$';

            if (toggleable) {
                return (
                    <TouchableOpacity onPress={() => UnitsStore.changeUnits()}>
                        <AmountDisplay
                            amount={amount}
                            unit={unit}
                            symbol={symbol}
                            negative={false}
                            jumboText={jumboText}
                            pending={pending}
                        />
                    </TouchableOpacity>
                );
            }

            return (
                <AmountDisplay
                    amount={amount}
                    unit={unit}
                    symbol={symbol}
                    negative={false}
                    jumboText={jumboText}
                    pending={pending}
                />
            );
        }

        const textColor = debit
            ? 'warning'
            : credit
            ? 'success'
            : color
            ? color
            : undefined;

        if (sensitive) {
            const amount = unformattedAmount.amount;

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
                        pending={pending}
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
                pending={pending}
            />
        );
    }
}
