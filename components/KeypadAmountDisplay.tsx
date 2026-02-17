import * as React from 'react';
import { Animated, Text, View, ViewStyle } from 'react-native';
import { inject, observer } from 'mobx-react';

import Conversion from './Conversion';

import UnitsStore from '../stores/UnitsStore';

import { themeColor } from '../utils/ThemeUtils';
import {
    getDecimalPlaceholder,
    formatBitcoinWithSpaces,
    numberWithCommas
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
    UnitsStore?: UnitsStore;
    children?: React.ReactNode;
}

@inject('UnitsStore')
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
            UnitsStore,
            children
        } = this.props;
        const { units } = UnitsStore!;

        const color = textAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [themeColor('text'), 'red']
        });

        const decimalPlaceholder = getDecimalPlaceholder(amount, units);

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
                        {units === 'BTC'
                            ? formatBitcoinWithSpaces(amount)
                            : numberWithCommas(amount)}
                        <Text
                            style={{
                                color: themeColor('secondaryText')
                            }}
                        >
                            {decimalPlaceholder.string}
                        </Text>
                    </Animated.Text>
                </Animated.View>

                {childrenBeforeConversion && children}
                {conversionElement}
                {!childrenBeforeConversion && children}
            </View>
        );
    }
}
