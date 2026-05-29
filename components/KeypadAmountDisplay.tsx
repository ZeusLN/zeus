import * as React from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { inject, observer } from 'mobx-react';

import AnimatedDigit from './AnimatedDigit';

import Conversion from './Conversion';

import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import { themeColor } from '../utils/ThemeUtils';
import {
    getDecimalPlaceholder,
    formatBitcoinWithSpaces,
    numberWithCommas,
    numberWithDecimals
} from '../utils/UnitsUtils';

interface KeypadAmountDisplayState {
    exitingDigit: null | { char: string; key: number };
    syncedAmount: string;
    exitKeySeq: number;
    placeholderAmount: string;
}

interface KeypadAmountDisplayProps {
    amount: string;
    shakeAnimation: Animated.Value;
    textAnimation: Animated.Value;
    fontSize: number;
    showConversion?: boolean;
    conversionTop?: number;
    lineHeight?: number;
    containerStyle?: ViewStyle;
    childrenBeforeConversion?: boolean;
    forceUnit?: string;
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
    children?: React.ReactNode;
}

@inject('FiatStore', 'SettingsStore', 'UnitsStore')
@observer
export default class KeypadAmountDisplay extends React.Component<
    KeypadAmountDisplayProps,
    KeypadAmountDisplayState
> {
    constructor(props: KeypadAmountDisplayProps) {
        super(props);
        this.state = {
            exitingDigit: null,
            syncedAmount: props.amount,
            exitKeySeq: 0,
            placeholderAmount: props.amount
        };
    }

    private static digitsOnlyFromFormatted(formatted: string): string {
        let out = '';
        for (let i = 0; i < formatted.length; i++) {
            const c = formatted.charAt(i);
            if (c >= '0' && c <= '9') {
                out += c;
            }
        }
        return out;
    }

    private static formattedForAmount(
        props: KeypadAmountDisplayProps,
        amount: string
    ): string {
        const { forceUnit, FiatStore, UnitsStore } = props;
        const units = forceUnit || UnitsStore!.units;
        const { separatorSwap } =
            units === 'fiat'
                ? FiatStore!.getSymbol()
                : {
                      separatorSwap: false
                  };
        if (units === 'BTC') {
            return formatBitcoinWithSpaces(amount);
        }
        return separatorSwap
            ? numberWithDecimals(amount)
            : numberWithCommas(amount);
    }

    static getDerivedStateFromProps(
        props: KeypadAmountDisplayProps,
        state: KeypadAmountDisplayState
    ): Partial<KeypadAmountDisplayState> | null {
        if (props.amount === state.syncedAmount) {
            return null;
        }

        const prevF = KeypadAmountDisplay.formattedForAmount(
            props,
            state.syncedAmount
        );
        const currF = KeypadAmountDisplay.formattedForAmount(
            props,
            props.amount
        );
        const prevD = KeypadAmountDisplay.digitsOnlyFromFormatted(prevF);
        const currD = KeypadAmountDisplay.digitsOnlyFromFormatted(currF);

        const next: Partial<KeypadAmountDisplayState> = {
            syncedAmount: props.amount
        };

        if (currD.length > prevD.length) {
            next.exitingDigit = null;
            next.placeholderAmount = props.amount;
            return next;
        }

        if (prevD.length === currD.length + 1 && currD === prevD.slice(0, -1)) {
            const nextKey = state.exitKeySeq + 1;
            next.exitingDigit = {
                char: prevD.charAt(prevD.length - 1),
                key: nextKey
            };
            next.exitKeySeq = nextKey;
            return next;
        }

        if (state.exitingDigit !== null) {
            next.exitingDigit = null;
        }
        next.placeholderAmount = props.amount;
        return next;
    }

    private getFormattedNumber(amount: string): string {
        return KeypadAmountDisplay.formattedForAmount(this.props, amount);
    }

    renderFormattedNumber(
        formattedNumber: string,
        textColor: Animated.AnimatedInterpolation<string> | string,
        fontSize: number,
        lineHeight: number
    ) {
        let digitIndex = 0;
        const textStyle = {
            fontSize,
            fontFamily: 'PPNeueMontreal-Medium',
            lineHeight
        };
        return formattedNumber.split('').map((char) => {
            const isDigit = char >= '0' && char <= '9';
            if (isDigit) {
                const key = `digit_${digitIndex}`;
                digitIndex++;
                return (
                    <AnimatedDigit
                        key={key}
                        value={char}
                        color={textColor}
                        style={textStyle}
                        lineHeight={lineHeight}
                    />
                );
            }
            return (
                <Animated.Text
                    key={'sep_' + digitIndex + '_' + char}
                    style={[textStyle, { color: textColor }]}
                >
                    {char}
                </Animated.Text>
            );
        });
    }

    render() {
        const {
            amount,
            shakeAnimation,
            textAnimation,
            fontSize,
            showConversion = true,
            conversionTop,
            lineHeight = 80,
            containerStyle,
            childrenBeforeConversion = false,
            forceUnit,
            FiatStore,
            SettingsStore,
            UnitsStore,
            children
        } = this.props;
        const useSatsSymbol =
            SettingsStore?.settings?.display?.useSatsSymbol ?? true;
        const units = forceUnit || UnitsStore!.units;
        const { symbol, space, rtl } =
            units === 'fiat'
                ? FiatStore!.getSymbol()
                : {
                      symbol: '',
                      space: false,
                      rtl: false
                  };

        const color = textAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [themeColor('text'), 'red']
        });

        const decimalPlaceholder = getDecimalPlaceholder(
            this.state.placeholderAmount,
            units
        );

        const formattedNumber = this.getFormattedNumber(amount);

        const isSingularSat = units === 'sats' && parseFloat(amount) === 1;

        let prefix = '';
        let suffix = '';
        if (units === 'BTC') {
            prefix = '₿';
        } else if (units === 'sats') {
            suffix = ` ${useSatsSymbol ? 'β' : isSingularSat ? 'sat' : 'sats'}`;
        } else if (units === 'fiat') {
            if (rtl) {
                suffix = `${space ? ' ' : ''}${symbol}`;
            } else {
                prefix = `${symbol}${space ? ' ' : ''}`;
            }
        }

        const textColor = amount === '0' ? themeColor('secondaryText') : color;

        const mainChars =
            prefix.length +
            formattedNumber.length +
            (decimalPlaceholder.string?.length ?? 0);
        const totalWeightedChars = mainChars + suffix.length * 0.25;
        const scaledFontSize =
            totalWeightedChars > 0
                ? Math.min(
                      fontSize,
                      Math.max(
                          Math.floor(350 / (totalWeightedChars * 0.47)),
                          20
                      )
                  )
                : fontSize;
        const scaledLineHeight = Math.round(
            lineHeight * (scaledFontSize / fontSize)
        );

        const conversionElement = showConversion && (
            <View
                style={{
                    marginBottom: 10,
                    alignItems: 'center',
                    ...(conversionTop !== undefined && { top: conversionTop })
                }}
            >
                <Conversion amount={amount} forceUnit={forceUnit} />
            </View>
        );

        return (
            <View
                style={[
                    {
                        flex: 1,
                        flexDirection: 'column',
                        justifyContent: 'center',
                        zIndex: 10,
                        height: 50
                    },
                    containerStyle
                ]}
            >
                <Animated.View
                    style={{
                        transform: [{ translateX: shakeAnimation }]
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            justifyContent: 'center'
                        }}
                    >
                        {prefix ? (
                            <Animated.Text
                                style={{
                                    zIndex: 1,
                                    color: textColor,
                                    fontSize: scaledFontSize,
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    lineHeight: scaledLineHeight
                                }}
                            >
                                {prefix}
                            </Animated.Text>
                        ) : null}
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'flex-end',
                                height: scaledLineHeight,
                                overflow: 'hidden',
                                zIndex: 0
                            }}
                        >
                            {this.renderFormattedNumber(
                                formattedNumber,
                                textColor,
                                scaledFontSize,
                                scaledLineHeight
                            )}
                            {this.state.exitingDigit ? (
                                <AnimatedDigit
                                    key={`exit-${this.state.exitingDigit.key}`}
                                    variant="exit"
                                    value={this.state.exitingDigit.char}
                                    color={textColor}
                                    style={{
                                        fontSize: scaledFontSize,
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        lineHeight: scaledLineHeight
                                    }}
                                    lineHeight={scaledLineHeight}
                                    onExitComplete={() =>
                                        this.setState({
                                            exitingDigit: null,
                                            placeholderAmount: this.props.amount
                                        })
                                    }
                                />
                            ) : null}
                            {decimalPlaceholder.string ? (
                                <Text
                                    style={{
                                        zIndex: 1,
                                        color: themeColor('secondaryText'),
                                        fontSize: scaledFontSize,
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        lineHeight: scaledLineHeight
                                    }}
                                >
                                    {decimalPlaceholder.string}
                                </Text>
                            ) : null}
                            {suffix
                                ? (() => {
                                      const suffixFontSize = Math.max(
                                          scaledFontSize *
                                              (useSatsSymbol ? 1 : 0.2),
                                          12
                                      );
                                      // alignItems on the parent is 'flex-end'
                                      // (baseline triggers a Fabric crash on
                                      // re-render of paragraph nodes). When
                                      // the suffix is much smaller than the
                                      // digits, its baseline sits below the
                                      // digit baseline; nudge it up to fake
                                      // baseline alignment.
                                      const suffixMarginBottom = useSatsSymbol
                                          ? 0
                                          : Math.max(
                                                0,
                                                Math.round(
                                                    scaledFontSize * 0.25 -
                                                        suffixFontSize * 0.3
                                                )
                                            );
                                      return (
                                          <Animated.Text
                                              style={{
                                                  zIndex: 1,
                                                  color: textColor,
                                                  fontSize: suffixFontSize,
                                                  fontFamily:
                                                      'PPNeueMontreal-Medium',
                                                  lineHeight: useSatsSymbol
                                                      ? scaledLineHeight
                                                      : undefined,
                                                  marginBottom:
                                                      suffixMarginBottom
                                              }}
                                          >
                                              {suffix}
                                          </Animated.Text>
                                      );
                                  })()
                                : null}
                        </View>
                    </View>
                </Animated.View>

                {childrenBeforeConversion && children}
                {conversionElement}
                {!childrenBeforeConversion && children}
            </View>
        );
    }
}
