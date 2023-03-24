import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import UnitsStore from '../stores/UnitsStore';
import SettingsStore from '../stores/SettingsStore';
import PrivacyUtils from '../utils/PrivacyUtils';
import ClockIcon from '../assets/images/SVG/Clock.svg';
import { themeColor } from '../utils/ThemeUtils';
import { Spacer } from './layout/Spacer';
import { Row } from './layout/Row';
import { Body } from './text/Body';
import LoadingIndicator from './LoadingIndicator';

type Units = 'sats' | 'BTC' | 'fiat';

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
    colorOverride?: string;
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
    colorOverride = undefined,
    pending = false
}: AmountDisplayProps) {
    if (unit === 'fiat' && !symbol) {
        console.error('Must include a symbol when rendering fiat');
    }

    const actualSymbol = unit === 'BTC' ? '₿' : symbol;

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
        <Body
            secondary
            jumbo={jumboText}
            color={color}
            colorOverride={colorOverride}
        >
            {actualSymbol}
        </Body>
    );

    const TextSpace = () => (
        <Body jumbo={jumboText} color={color} colorOverride={colorOverride}>
            {' '}
        </Body>
    );

    // TODO this could probably be made more readable by componentizing the repeat bits
    switch (unit) {
        case 'sats':
            return (
                <Row align="flex-end">
                    {pending ? <Pending /> : null}
                    <Body
                        jumbo={jumboText}
                        color={color}
                        colorOverride={colorOverride}
                    >
                        {amount}
                    </Body>
                    <Spacer width={2} />
                    <View style={{ paddingBottom: jumboText ? 8 : 1.5 }}>
                        <Body
                            secondary
                            small={!jumboText}
                            color={color}
                            colorOverride={colorOverride}
                        >
                            {plural ? 'sats' : 'sat'}
                        </Body>
                    </View>
                </Row>
            );
        case 'BTC':
        case 'fiat':
            if (rtl) {
                return (
                    <Row align="flex-end">
                        <Body
                            jumbo={jumboText}
                            color={color}
                            colorOverride={colorOverride}
                        >
                            {negative ? '-' : ''}
                            {amount === 'N/A' ? (
                                <LoadingIndicator size={20} />
                            ) : (
                                amount.toString()
                            )}
                        </Body>
                        {space ? <TextSpace /> : <Spacer width={1} />}
                        {amount !== 'N/A' && <FiatSymbol />}
                        {pending ? <Pending /> : null}
                    </Row>
                );
            } else {
                return (
                    <Row align="flex-end">
                        {pending ? <Pending /> : null}
                        {amount !== 'N/A' && <FiatSymbol />}
                        {space ? <TextSpace /> : <Spacer width={1} />}
                        <Body
                            jumbo={jumboText}
                            color={color}
                            colorOverride={colorOverride}
                        >
                            {negative ? '-' : ''}
                            {amount === 'N/A' ? (
                                <LoadingIndicator size={20} />
                            ) : (
                                amount.toString()
                            )}
                        </Body>
                    </Row>
                );
            }
    }
}

interface AmountProps {
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
    sats: number | string;
    fixedUnits?: string;
    sensitive?: boolean;
    sensitiveLength?: number;
    jumboText?: boolean;
    credit?: boolean;
    debit?: boolean;
    // If credit or debit doesn't cover the use case
    color?: 'text' | 'success' | 'warning' | 'highlight' | 'secondaryText';
    colorOverride?: string;
    toggleable?: boolean;
    pending?: boolean;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class Amount extends React.Component<AmountProps, {}> {
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
            colorOverride = undefined,
            pending = false
        } = this.props;
        const UnitsStore = this.props.UnitsStore!;
        const SettingsStore = this.props.SettingsStore!;
        const lurkerMode =
            SettingsStore.settings.privacy &&
            SettingsStore.settings.privacy.lurkerMode;
        const lurkerExposed = SettingsStore.lurkerExposed;

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
                    <TouchableOpacity
                        onPress={() => UnitsStore.changeUnits()}
                        onLongPress={() => {
                            if (!lurkerExposed && lurkerMode) {
                                SettingsStore.toggleLurker();
                            }
                        }}
                    >
                        <AmountDisplay
                            amount={amount}
                            unit={unit}
                            symbol={symbol}
                            negative={false}
                            jumboText={jumboText}
                            pending={pending}
                            colorOverride={colorOverride}
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
                    colorOverride={colorOverride}
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
                <TouchableOpacity
                    onPress={() => UnitsStore.changeUnits()}
                    onLongPress={() => {
                        if (!lurkerExposed && lurkerMode) {
                            SettingsStore.toggleLurker();
                        }
                    }}
                >
                    <AmountDisplay
                        {...unformattedAmount}
                        negative={false}
                        jumboText={jumboText}
                        color={textColor}
                        pending={pending}
                        colorOverride={colorOverride}
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
                colorOverride={colorOverride}
            />
        );
    }
}
