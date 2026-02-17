import * as React from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import Conversion from '../components/Conversion';
import Header from '../components/Header';
import PinPad from '../components/PinPad';
import Screen from '../components/Screen';
import UnitToggle from '../components/UnitToggle';

import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import { themeColor } from '../utils/ThemeUtils';
import {
    validateKeypadInput,
    startShakeAnimation,
    getAmountFontSize,
    deleteLastCharacter
} from '../utils/KeypadUtils';
import {
    getDecimalPlaceholder,
    formatBitcoinWithSpaces,
    numberWithCommas
} from '../utils/UnitsUtils';
import { localeString } from '../utils/LocaleUtils';

interface AmountKeypadProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'AmountKeypad',
        {
            initialAmount?: string;
            hideUnitChangeButton?: boolean;
            onConfirm?: (amount: string) => void;
        }
    >;
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
}

interface AmountKeypadState {
    amount: string;
}

@inject('FiatStore', 'SettingsStore', 'UnitsStore')
@observer
export default class AmountKeypad extends React.Component<
    AmountKeypadProps,
    AmountKeypadState
> {
    shakeAnimation = new Animated.Value(0);
    textAnimation = new Animated.Value(0);

    constructor(props: AmountKeypadProps) {
        super(props);
        const initialAmount = props.route.params?.initialAmount || '0';
        this.state = {
            amount: initialAmount
        };
    }

    appendValue = (value: string): boolean => {
        const { amount } = this.state;
        const { FiatStore, SettingsStore, UnitsStore } = this.props;
        const { units } = UnitsStore!;

        const { valid, newAmount } = validateKeypadInput(
            amount,
            value,
            units,
            FiatStore!,
            SettingsStore!
        );

        if (!valid) {
            this.startShake();
            return false;
        }

        this.setState({ amount: newAmount });
        return true;
    };

    clearValue = () => {
        this.setState({ amount: '0' });
    };

    deleteValue = () => {
        const { amount } = this.state;
        this.setState({ amount: deleteLastCharacter(amount) });
    };

    startShake = () => {
        startShakeAnimation(this.shakeAnimation, this.textAnimation);
    };

    handleConfirm = () => {
        const { amount } = this.state;
        const { navigation, route } = this.props;
        const { onConfirm } = route.params || {};

        if (onConfirm) {
            onConfirm(amount);
        }

        navigation.goBack();
    };

    handleUnitToggle = () => {
        // Reset to 0 when units change to avoid confusion
        this.setState({ amount: '0' });
    };

    getAmountFontSize = () => {
        const { amount } = this.state;
        const { units } = this.props.UnitsStore!;
        const { count } = getDecimalPlaceholder(amount, units);
        return getAmountFontSize(amount.length, count);
    };

    render() {
        const { navigation, route, UnitsStore } = this.props;
        const { amount } = this.state;
        const { units } = UnitsStore!;
        const hideUnitChangeButton = route.params?.hideUnitChangeButton;

        const decimalPlaceholder = getDecimalPlaceholder(amount, units);
        const fontSize = this.getAmountFontSize();

        const color = this.textAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [themeColor('text'), 'red']
        });

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.amount'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <View style={styles.container}>
                    {/* Amount Display */}
                    <Animated.View
                        style={[
                            styles.amountContainer,
                            {
                                transform: [{ translateX: this.shakeAnimation }]
                            }
                        ]}
                    >
                        <Animated.Text
                            style={[
                                styles.amountText,
                                {
                                    color:
                                        amount === '0'
                                            ? themeColor('secondaryText')
                                            : color,
                                    fontSize
                                }
                            ]}
                        >
                            {units === 'BTC'
                                ? formatBitcoinWithSpaces(amount)
                                : numberWithCommas(amount)}
                            <Animated.Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {decimalPlaceholder.string}
                            </Animated.Text>
                        </Animated.Text>
                    </Animated.View>

                    {/* Unit Toggle */}
                    {!hideUnitChangeButton && (
                        <View style={styles.unitToggleContainer}>
                            <UnitToggle onToggle={this.handleUnitToggle} />
                        </View>
                    )}

                    {/* Conversion Display - always reserve space */}
                    <View style={styles.conversionContainer}>
                        {amount !== '0' && <Conversion amount={amount} />}
                    </View>

                    {/* PinPad */}
                    <View style={styles.pinPadContainer}>
                        <PinPad
                            appendValue={this.appendValue}
                            clearValue={this.clearValue}
                            deleteValue={this.deleteValue}
                            numberHighlight
                            amount
                        />
                    </View>

                    {/* Done Button */}
                    <View style={styles.buttonContainer}>
                        <Button
                            title={localeString('general.confirm')}
                            onPress={this.handleConfirm}
                            containerStyle={styles.doneButton}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20
    },
    amountContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100,
        marginTop: 60
    },
    amountText: {
        textAlign: 'center',
        fontFamily: 'PPNeueMontreal-Medium'
    },
    unitToggleContainer: {
        alignItems: 'center',
        marginVertical: 15
    },
    conversionContainer: {
        alignItems: 'center',
        marginBottom: 15,
        minHeight: 40
    },
    pinPadContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    buttonContainer: {
        paddingBottom: 20
    },
    doneButton: {
        borderRadius: 12
    }
});
