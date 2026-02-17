import * as React from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { inject, observer } from 'mobx-react';

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
    FiatStore?: FiatStore;
    UnitsStore?: UnitsStore;
    children?: React.ReactNode;
}

@inject('FiatStore', 'UnitsStore')
@observer
export default class KeypadAmountDisplay extends React.Component<KeypadAmountDisplayProps> {
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
            FiatStore,
            UnitsStore,
            children
        } = this.props;
        const { units } = UnitsStore!;
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

        const conversionElement = showConversion && (
            <View
                style={{
                    marginBottom: 10,
                    alignItems: 'center',
                    ...(conversionTop !== undefined && { top: conversionTop })
                }}
            >
                <Conversion amount={amount} />
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
                    <Animated.Text
                        style={{
                            color:
                                amount === '0'
                                    ? themeColor('secondaryText')
                                    : color,
                            fontSize,
                            textAlign: 'center',
                            fontFamily: 'PPNeueMontreal-Medium',
                            lineHeight
                        }}
                    >
                        {prefix}
                        {formattedNumber}
                        <Text
                            style={{
                                color: themeColor('secondaryText')
                            }}
                        >
                            {decimalPlaceholder.string}
                        </Text>
                        {suffix ? (
                            <Text
                                style={{
                                    fontSize: fontSize * 0.2
                                }}
                            >
                                {suffix}
                            </Text>
                        ) : null}
                    </Animated.Text>
                </Animated.View>

                {childrenBeforeConversion && children}
                {conversionElement}
                {!childrenBeforeConversion && children}
            </View>
        );
    }
}
