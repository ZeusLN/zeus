import * as React from 'react';
import { Animated, TouchableOpacity, View, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/Button';
import CurrencySelectorModal from '../components/CurrencySelectorModal';
import Header from '../components/Header';
import KeypadAmountDisplay from '../components/KeypadAmountDisplay';
import PinPad from '../components/PinPad';
import Screen from '../components/Screen';
import UnitToggle from '../components/UnitToggle';

import FiatStore from '../stores/FiatStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';

import { themeColor } from '../utils/ThemeUtils';
import {
    KeypadAnimationRefs,
    validateKeypadInput,
    getAmountFontSize,
    deleteLastCharacter,
    parseClipboardAmount,
    resetKeypadTextAnimation,
    resetAllKeypadAnimations,
    startKeypadInvalidInputAnimation
} from '../utils/KeypadUtils';
import { getDecimalPlaceholder } from '../utils/UnitsUtils';
import { localeString } from '../utils/LocaleUtils';

import ClipboardSVG from '../assets/images/SVG/Clipboard.svg';

interface AmountKeypadProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'AmountKeypad',
        {
            initialAmount?: string;
            hideUnitChangeButton?: boolean;
            forceUnit?: 'sats' | 'BTC' | 'fiat';
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
    animationRefs: KeypadAnimationRefs = {
        textAnimationRef: null,
        shakeAnimationRef: null
    };
    /*
     Use this as the latest amount between setState updates.
     Fast taps can use old state and show wrong red/shake animation.
    */
    amountInput = '0';
    private currencySelectorModalRef = React.createRef<CurrencySelectorModal>();

    constructor(props: AmountKeypadProps) {
        super(props);
        const initialAmount = props.route.params?.initialAmount || '0';
        this.amountInput = initialAmount;
        this.state = {
            amount: initialAmount
        };
    }

    componentDidUpdate(
        _prevProps: AmountKeypadProps,
        prevState: AmountKeypadState
    ) {
        if (prevState.amount !== this.state.amount) {
            this.amountInput = this.state.amount;
        }
    }

    componentWillUnmount() {
        resetAllKeypadAnimations(
            this.shakeAnimation,
            this.textAnimation,
            this.animationRefs
        );
    }

    getEffectiveUnits = (): string => {
        const forceUnit = this.props.route.params?.forceUnit;
        return forceUnit || this.props.UnitsStore!.units;
    };

    appendValue = (value: string): boolean => {
        const amount = this.amountInput;
        const { FiatStore, SettingsStore } = this.props;
        const units = this.getEffectiveUnits();

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

        resetKeypadTextAnimation(this.textAnimation, this.animationRefs);
        this.amountInput = newAmount;
        this.setState({ amount: newAmount });
        return true;
    };

    clearValue = () => {
        resetKeypadTextAnimation(this.textAnimation, this.animationRefs);
        this.amountInput = '0';
        this.setState({ amount: '0' });
    };

    deleteValue = () => {
        const amount = this.amountInput;
        if (amount === '0') {
            this.startShake();
            return;
        }
        resetKeypadTextAnimation(this.textAnimation, this.animationRefs);
        this.amountInput = deleteLastCharacter(amount);
        this.setState({ amount: this.amountInput });
    };

    startShake = () => {
        startKeypadInvalidInputAnimation(
            this.shakeAnimation,
            this.textAnimation,
            this.animationRefs
        );
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
        this.clearValue();
    };

    handleOpenCurrencyModal = () => {
        this.currencySelectorModalRef.current?.open();
    };

    handleCurrencyModalClose = () => {
        this.clearValue();
    };

    handlePaste = async () => {
        const { FiatStore, SettingsStore } = this.props;
        const clipboardValue = await Clipboard.getString();
        const parsed = parseClipboardAmount(
            clipboardValue,
            this.getEffectiveUnits(),
            FiatStore!,
            SettingsStore!
        );

        if (parsed === null) {
            this.startShake();
            return;
        }

        resetKeypadTextAnimation(this.textAnimation, this.animationRefs);
        this.amountInput = parsed;
        this.setState({ amount: parsed });
    };

    getAmountFontSize = () => {
        const { amount } = this.state;
        const units = this.getEffectiveUnits();
        const { count } = getDecimalPlaceholder(amount, units);
        return getAmountFontSize(amount.length, count);
    };

    render() {
        const { navigation, route } = this.props;
        const { amount } = this.state;
        const hideUnitChangeButton = route.params?.hideUnitChangeButton;
        const forceUnit = route.params?.forceUnit;

        const fontSize = this.getAmountFontSize();

        const PasteButton = (
            <TouchableOpacity
                onPress={this.handlePaste}
                accessibilityLabel={localeString('general.paste')}
                hitSlop={10}
            >
                <ClipboardSVG
                    fill={themeColor('text')}
                    width="24"
                    height="30"
                />
            </TouchableOpacity>
        );

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
                    rightComponent={PasteButton}
                    navigation={navigation}
                />

                <View style={styles.container}>
                    <View style={styles.amountDisplayContainer}>
                        <KeypadAmountDisplay
                            amount={amount}
                            shakeAnimation={this.shakeAnimation}
                            textAnimation={this.textAnimation}
                            fontSize={fontSize}
                            forceUnit={forceUnit}
                            showConversion
                        >
                            {!hideUnitChangeButton && !forceUnit && (
                                <View style={styles.unitToggleContainer}>
                                    <UnitToggle
                                        onToggle={this.handleUnitToggle}
                                        onOpenModal={
                                            this.handleOpenCurrencyModal
                                        }
                                    />
                                </View>
                            )}
                        </KeypadAmountDisplay>
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
                <CurrencySelectorModal
                    ref={this.currencySelectorModalRef}
                    navigation={navigation}
                    onClose={this.handleCurrencyModalClose}
                />
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20
    },
    amountDisplayContainer: {
        flex: 1,
        alignItems: 'center',
        marginTop: 60,
        overflow: 'hidden'
    },
    unitToggleContainer: {
        alignItems: 'center',
        marginVertical: 15
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
