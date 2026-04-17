import * as React from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { inject, observer } from 'mobx-react';

import AnimatedDigit from './AnimatedDigit';

import Conversion from './Conversion';

import FiatStore from '../stores/FiatStore';
import UnitsStore from '../stores/UnitsStore';

import { themeColor } from '../utils/ThemeUtils';
import {
    getDecimalPlaceholder,
    formatBitcoinWithSpaces,
    numberWithCommas,
    numberWithDecimals
} from '../utils/UnitsUtils';

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
    UnitsStore?: UnitsStore;
    children?: React.ReactNode;
}

@inject('FiatStore', 'UnitsStore')
@observer
export default class KeypadAmountDisplay extends React.Component<KeypadAmountDisplayProps> {
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
            UnitsStore,
            children
        } = this.props;
        const units = forceUnit || UnitsStore!.units;
        const { symbol, space, rtl, separatorSwap } =
            units === 'fiat'
                ? FiatStore!.getSymbol()
                : {
                      symbol: '',
                      space: false,
                      rtl: false,
                      separatorSwap: false
                  };

        const color = textAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [themeColor('text'), 'red']
        });

        const decimalPlaceholder = getDecimalPlaceholder(amount, units);

        const formattedNumber =
            units === 'BTC'
                ? formatBitcoinWithSpaces(amount)
                : separatorSwap
                ? numberWithDecimals(amount)
                : numberWithCommas(amount);

        const isSingularSat = units === 'sats' && parseFloat(amount) === 1;

        let prefix = '';
        let suffix = '';
        if (units === 'BTC') {
            prefix = '₿';
        } else if (units === 'sats') {
            suffix = ` ${isSingularSat ? 'sat' : 'sats'}`;
        } else if (units === 'fiat') {
            if (rtl) {
                suffix = `${space ? ' ' : ''}${symbol}`;
            } else {
                prefix = `${symbol}${space ? ' ' : ''}`;
            }
        }

        const textColor = amount === '0' ? themeColor('secondaryText') : color;

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
                                    color: textColor,
                                    fontSize,
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    lineHeight
                                }}
                            >
                                {prefix}
                            </Animated.Text>
                        ) : null}
                        {this.renderFormattedNumber(
                            formattedNumber,
                            textColor,
                            fontSize,
                            lineHeight
                        )}
                        {decimalPlaceholder.string ? (
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize,
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    lineHeight
                                }}
                            >
                                {decimalPlaceholder.string}
                            </Text>
                        ) : null}
                        {suffix ? (
                            <Animated.Text
                                style={{
                                    alignSelf: 'center',
                                    marginTop: fontSize * 0.25,
                                    color: textColor,
                                    fontSize: Math.max(fontSize * 0.2, 12),
                                    fontFamily: 'PPNeueMontreal-Medium'
                                }}
                            >
                                {suffix}
                            </Animated.Text>
                        ) : null}
                    </View>
                </Animated.View>

                {childrenBeforeConversion && children}
                {conversionElement}
                {!childrenBeforeConversion && children}
            </View>
        );
    }
}
