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

import ClockIcon from '../assets/images/SVG/Clock.svg';

import stores from '../stores/Stores';

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
}

interface FiatSymbolProps {
    accessible?: boolean;
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
    defaultTextSize = false,
    color = undefined,
    colorOverride = undefined,
    pending = false,
    fee = false,
    fiatRatesLoading = false,
    accessible,
    accessibilityLabel
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

    const FiatSymbol: React.FC<FiatSymbolProps> = ({ accessible }) => (
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

    const TextSpace = () => (
        <Body jumbo={jumboText} color={color} colorOverride={colorOverride}>
            {' '}
        </Body>
    );

    // TODO this could probably be made more readable by componentizing the repeat bits
    switch (unit) {
        case 'sats':
            const hideMsats =
                !stores.settingsStore?.settings?.display
                    ?.showMillisatoshiAmounts;
            if (hideMsats) {
                const [wholeSats] = amount.toString().split('.');
                amount = wholeSats;
                plural = amount === '1' ? false : true;
            }
            return (
                <Row
                    style={styles.row}
                    accessible={accessible}
                    accessibilityLabel={accessibilityLabel}
                >
                    {pending && <Pending />}
                    <View style={styles.textContainer}>
                        <Body
                            jumbo={jumboText}
                            defaultSize={defaultTextSize}
                            color={color}
                            colorOverride={colorOverride}
                            accessible={accessible}
                        >
                            {negative ? '-' : ''}
                            {amount}
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
                                {plural ? 'sats' : 'sat'}
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
        case 'BTC':
        case 'fiat':
            if (rtl) {
                return (
                    <Row
                        style={styles.row}
                        accessible={accessible}
                        accessibilityLabel={accessibilityLabel}
                    >
                        <View style={styles.textContainer}>
                            {fee && (
                                <>
                                    <Body
                                        secondary
                                        small={!jumboText}
                                        defaultSize={defaultTextSize}
                                        color={color}
                                        colorOverride={colorOverride}
                                    >
                                        {formatInlineNoun(
                                            localeString('views.Payment.fee')
                                        )}
                                    </Body>
                                    <Spacer width={2} />
                                </>
                            )}
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
                            {space ? <TextSpace /> : <Spacer width={1} />}
                            {amount !== 'N/A' && <FiatSymbol accessible />}
                        </View>
                        {pending && <Pending />}
                    </Row>
                );
            } else {
                return (
                    <Row
                        style={styles.row}
                        accessible={accessible}
                        accessibilityLabel={accessibilityLabel}
                    >
                        {pending && <Pending />}
                        <View style={styles.textContainer}>
                            {amount !== 'N/A' && <FiatSymbol accessible />}
                            {space ? <TextSpace /> : <Spacer width={1} />}
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
                            {fee && (
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
                                            {formatInlineNoun(
                                                localeString(
                                                    'views.Payment.fee'
                                                )
                                            )}
                                        </Body>
                                    </View>
                                </>
                            )}
                        </View>
                    </Row>
                );
            }
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
            negative = false
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

        const unformattedAmount = UnitsStore.getUnformattedAmount(value, units);

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
