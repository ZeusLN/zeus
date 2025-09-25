import * as React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import FiatStore from '../stores/FiatStore';
import UnitsStore from '../stores/UnitsStore';
import SettingsStore from '../stores/SettingsStore';

import { Spacer } from './layout/Spacer';
import { Row } from './layout/Row';
import { Body } from './text/Body';
import LoadingIndicator from './LoadingIndicator';

import { localeString, formatInlineNoun } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { formatBitcoinWithSpaces } from '../utils/UnitsUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import { processSatsAmount } from '../utils/AmountUtils';

import ClockIcon from '../assets/images/SVG/Clock.svg';

type Units = 'sats' | 'BTC' | 'fiat';

interface AmountDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    rtl?: boolean;
    space?: boolean;
    jumboText?: boolean;
    defaultTextSize?: boolean;
    color?:
        | 'text'
        | 'success'
        | 'warning'
        | 'warningReserve'
        | 'highlight'
        | 'secondaryText';
    colorOverride?: string;
    pending?: boolean;
    fee?: boolean;
    fiatRatesLoading?: boolean;
    accessible?: boolean;
    accessibilityLabel?: string;
    roundAmount?: boolean;
}

interface SymbolProps {
    accessible?: boolean;
}

function AmountDisplay({
    amount,
    unit,
    symbol,
    negative = false,
    rtl = false,
    space = false,
    jumboText = false,
    defaultTextSize = false,
    color = undefined,
    colorOverride = undefined,
    pending = false,
    fee = false,
    fiatRatesLoading = false,
    accessible,
    accessibilityLabel,
    roundAmount = false
}: AmountDisplayProps) {
    if (unit === 'fiat' && !symbol) {
        console.error('Must include a symbol when rendering fiat');
    }

    const actualSymbol = unit === 'BTC' ? '₿' : symbol;

    const Pending = () => (
        <View
            style={{
                paddingHorizontal: 4,
                paddingTop: jumboText ? 4 : 1
            }}
        >
            <ClockIcon
                color={themeColor('bitcoin')}
                width={jumboText ? 24 : 12}
                height={jumboText ? 24 : 12}
            />
        </View>
    );

    const FiatSymbol: React.FC<SymbolProps> = ({ accessible }) => (
        <Body
            secondary
            jumbo={jumboText}
            color={color}
            colorOverride={colorOverride}
            accessible={accessible}
            accessibilityLabel={unit}
        >
            {actualSymbol}
        </Body>
    );

    const ApproximateSymbol: React.FC<SymbolProps> = ({ accessible }) => (
        <Body
            secondary
            jumbo={jumboText}
            color={color}
            colorOverride={colorOverride}
            accessible={accessible}
            accessibilityLabel={localeString('general.approximately')}
        >
            ≈
        </Body>
    );

    const RoundingIndicator = () => (
        <Body
            jumbo={jumboText}
            defaultSize={defaultTextSize}
            color={color}
            colorOverride={colorOverride}
            accessible={accessible}
        >
            ~
        </Body>
    );

    const TextSpace = () => (
        <Body jumbo={jumboText} color={color} colorOverride={colorOverride}>
            {' '}
        </Body>
    );

    const renderSatsAmount = (
        displayAmount: string,
        shouldShowRounding: boolean
    ) => {
        const isPlural = displayAmount !== '1';

        return (
            <Row
                style={styles.row}
                accessible={accessible}
                accessibilityLabel={accessibilityLabel}
            >
                {pending && <Pending />}
                <View style={styles.textContainer}>
                    {shouldShowRounding && <RoundingIndicator />}
                    <Body
                        jumbo={jumboText}
                        defaultSize={defaultTextSize}
                        color={color}
                        colorOverride={colorOverride}
                        accessible={accessible}
                    >
                        {negative ? '-' : ''}
                        {displayAmount}
                    </Body>
                    <Spacer width={2} />
                    <View accessible={accessible}>
                        <Body
                            secondary
                            small={!jumboText}
                            defaultSize={defaultTextSize}
                            color={color}
                            colorOverride={colorOverride}
                            accessible={accessible}
                        >
                            {isPlural ? 'sats' : 'sat'}
                            {fee
                                ? ' ' +
                                  formatInlineNoun(
                                      localeString('views.Payment.fee')
                                  )
                                : ''}
                        </Body>
                    </View>
                </View>
            </Row>
        );
    };

    const renderCurrencyAmount = () => {
        const feeSection = fee && (
            <>
                <Spacer width={2} />
                <View>
                    <Body
                        secondary
                        small={!jumboText}
                        defaultSize={defaultTextSize}
                        color={color}
                        colorOverride={colorOverride}
                    >
                        {formatInlineNoun(localeString('views.Payment.fee'))}
                    </Body>
                </View>
            </>
        );

        const amountContent = (
            <Body
                jumbo={jumboText}
                defaultSize={defaultTextSize}
                color={color}
                colorOverride={colorOverride}
                accessible={accessible}
            >
                {negative ? '-' : ''}
                {amount === 'N/A' && fiatRatesLoading ? (
                    <LoadingIndicator size={20} />
                ) : unit === 'BTC' ? (
                    formatBitcoinWithSpaces(amount)
                ) : (
                    amount.toString()
                )}
            </Body>
        );

        const indicators = (
            <>
                {unit === 'BTC' && roundAmount && <RoundingIndicator />}
                {unit === 'fiat' && <ApproximateSymbol accessible />}
            </>
        );

        const symbols = (
            <>
                {unit === 'BTC' && amount !== 'N/A' && (
                    <FiatSymbol accessible />
                )}
                {amount !== 'N/A' && unit === 'fiat' && (
                    <FiatSymbol accessible />
                )}
            </>
        );

        const spacer = space ? <TextSpace /> : <Spacer width={1} />;

        return (
            <Row
                style={styles.row}
                accessible={accessible}
                accessibilityLabel={accessibilityLabel}
            >
                {!rtl && pending && <Pending />}
                <View style={styles.textContainer}>
                    {rtl && feeSection}
                    {indicators}
                    {rtl ? (
                        <>
                            {amountContent}
                            {spacer}
                            {symbols}
                        </>
                    ) : (
                        <>
                            {symbols}
                            {spacer}
                            {amountContent}
                        </>
                    )}
                    {!rtl && feeSection}
                </View>
                {rtl && pending && <Pending />}
            </Row>
        );
    };

    switch (unit) {
        case 'sats':
            const { displayAmount, shouldShowRounding } = processSatsAmount(
                amount,
                roundAmount
            );
            return renderSatsAmount(displayAmount, shouldShowRounding);
        case 'BTC':
        case 'fiat':
            return renderCurrencyAmount();

        default:
            return null;
    }
}

interface AmountProps {
    FiatStore?: FiatStore;
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
    sats?: number | string;
    fixedUnits?: string;
    sensitive?: boolean;
    sensitiveLength?: number;
    jumboText?: boolean;
    defaultTextSize?: boolean;
    credit?: boolean;
    debit?: boolean;
    // If credit or debit doesn't cover the use case
    color?:
        | 'text'
        | 'success'
        | 'warning'
        | 'warningReserve'
        | 'highlight'
        | 'secondaryText';
    colorOverride?: string;
    toggleable?: boolean;
    pending?: boolean;
    fee?: boolean;
    accessible?: boolean;
    accessibilityLabel?: string;
    negative?: boolean;
    roundAmount?: boolean;
}

@inject('FiatStore', 'UnitsStore', 'SettingsStore')
@observer
export default class Amount extends React.Component<AmountProps, {}> {
    render() {
        const {
            sats: value,
            fixedUnits,
            sensitive = false,
            sensitiveLength = 4,
            jumboText = false,
            defaultTextSize = false,
            credit = false,
            debit = false,
            toggleable = false,
            color = undefined,
            colorOverride = undefined,
            pending = false,
            fee = false,
            accessible,
            accessibilityLabel,
            negative = false,
            roundAmount = false
        } = this.props;
        const FiatStore = this.props.FiatStore!;
        const UnitsStore = this.props.UnitsStore!;
        const SettingsStore = this.props.SettingsStore!;
        const lurkerMode =
            SettingsStore.settings.privacy &&
            SettingsStore.settings.privacy.lurkerMode;
        const lurkerExposed = SettingsStore.lurkerExposed;

        // TODO: This doesn't feel like the right place for this but it makes the component "reactive"
        const units = fixedUnits ? fixedUnits : UnitsStore.units;

        const unformattedAmount = UnitsStore.getUnformattedAmount({
            sats: value,
            fixedUnits: units
        });

        // display fiat amounts when rate fetch fails as $N/A
        if (unformattedAmount.error) {
            const amount = 'N/A';
            const unit = 'fiat';
            const symbol = '$';

            if (toggleable) {
                return (
                    <TouchableOpacity
                        onPress={() => {
                            if (lurkerExposed || !lurkerMode) {
                                UnitsStore.changeUnits();
                                if (lurkerExposed) {
                                    SettingsStore.toggleLurker();
                                }
                            }
                        }}
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
                            negative={negative}
                            jumboText={jumboText}
                            defaultTextSize={defaultTextSize}
                            pending={pending}
                            fee={fee}
                            fiatRatesLoading={FiatStore.loading}
                            accessible={accessible}
                            accessibilityLabel={accessibilityLabel}
                            roundAmount={roundAmount}
                        />
                    </TouchableOpacity>
                );
            }

            return (
                <AmountDisplay
                    amount={amount}
                    unit={unit}
                    symbol={symbol}
                    negative={negative}
                    jumboText={jumboText}
                    defaultTextSize={defaultTextSize}
                    pending={pending}
                    fee={fee}
                    fiatRatesLoading={FiatStore.loading}
                    accessible={accessible}
                    accessibilityLabel={accessibilityLabel}
                    roundAmount={roundAmount}
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
                    onPress={() => {
                        if (lurkerExposed || !lurkerMode) {
                            UnitsStore.changeUnits();
                            if (lurkerExposed) {
                                SettingsStore.toggleLurker();
                            }
                        }
                    }}
                    onLongPress={() => {
                        if (!lurkerExposed && lurkerMode) {
                            SettingsStore.toggleLurker();
                        }
                    }}
                >
                    <AmountDisplay
                        {...unformattedAmount}
                        negative={negative}
                        jumboText={jumboText}
                        defaultTextSize={defaultTextSize}
                        color={textColor}
                        colorOverride={colorOverride}
                        pending={pending}
                        fee={fee}
                        fiatRatesLoading={FiatStore.loading}
                        accessible={accessible}
                        accessibilityLabel={accessibilityLabel}
                        roundAmount={roundAmount}
                    />
                </TouchableOpacity>
            );
        }

        return (
            <AmountDisplay
                {...unformattedAmount}
                negative={negative}
                jumboText={jumboText}
                defaultTextSize={defaultTextSize}
                color={textColor}
                colorOverride={colorOverride}
                pending={pending}
                fee={fee}
                fiatRatesLoading={FiatStore.loading}
                accessible={accessible}
                accessibilityLabel={accessibilityLabel}
                roundAmount={roundAmount}
            />
        );
    }
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    textContainer: {
        flexDirection: 'row',
        alignItems: 'baseline'
    }
});
