import * as React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StatusBar,
    Dimensions
} from 'react-native';
import { useStealthTapDetector } from './StealthTapDetector';

const { width } = Dimensions.get('window');
const BUTTON_SIZE = (width - 50) / 4;

interface CalculatorAppProps {
    onUnlock: () => void;
    requiredTaps?: number;
}

type Operation = '+' | '-' | '×' | '÷' | null;

const CalculatorApp: React.FC<CalculatorAppProps> = ({
    onUnlock,
    requiredTaps = 5
}) => {
    const [displayValue, setDisplayValue] = React.useState('0');
    const [previousValue, setPreviousValue] = React.useState<string | null>(
        null
    );
    const [operation, setOperation] = React.useState<Operation>(null);
    const [waitingForOperand, setWaitingForOperand] = React.useState(false);

    // Secret unlock: tap "=" requiredTaps times within 4 seconds
    const { handleTap: handleSecretTap } = useStealthTapDetector({
        requiredTaps,
        timeWindow: 4000,
        onUnlock
    });

    const handleNumber = (num: string) => {
        if (waitingForOperand) {
            setDisplayValue(num);
            setWaitingForOperand(false);
        } else {
            if (displayValue.length >= 9) return;
            setDisplayValue(displayValue === '0' ? num : displayValue + num);
        }
    };

    const handleDecimal = () => {
        if (waitingForOperand) {
            setDisplayValue('0.');
            setWaitingForOperand(false);
            return;
        }
        if (!displayValue.includes('.')) {
            setDisplayValue(displayValue + '.');
        }
    };

    const handleOperation = (op: Operation) => {
        const current = parseFloat(displayValue);

        if (previousValue === null) {
            setPreviousValue(displayValue);
        } else if (operation) {
            const previous = parseFloat(previousValue);
            const result = calculate(previous, current, operation);
            setDisplayValue(String(result));
            setPreviousValue(String(result));
        }

        setWaitingForOperand(true);
        setOperation(op);
    };

    const calculate = (a: number, b: number, op: Operation): number => {
        switch (op) {
            case '+':
                return a + b;
            case '-':
                return a - b;
            case '×':
                return a * b;
            case '÷':
                return b !== 0 ? a / b : 0;
            default:
                return b;
        }
    };

    const handleEquals = () => {
        // Secret tap detection on equals button
        handleSecretTap();

        if (operation === null || previousValue === null) return;

        const current = parseFloat(displayValue);
        const previous = parseFloat(previousValue);
        const result = calculate(previous, current, operation);

        let resultString = String(result);
        if (resultString.length > 9) {
            resultString = result.toPrecision(6);
        }

        setDisplayValue(resultString);
        setPreviousValue(null);
        setOperation(null);
        setWaitingForOperand(true);
    };

    const handleClear = () => {
        setDisplayValue('0');
        setPreviousValue(null);
        setOperation(null);
        setWaitingForOperand(false);
    };

    const handleToggleSign = () => {
        const value = parseFloat(displayValue);
        setDisplayValue(String(value * -1));
    };

    const handlePercent = () => {
        const value = parseFloat(displayValue);
        setDisplayValue(String(value / 100));
    };

    const renderButton = (
        label: string,
        onPress: () => void,
        style?: object,
        textStyle?: object
    ) => (
        <TouchableOpacity
            style={[styles.button, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={[styles.buttonText, textStyle]}>{label}</Text>
        </TouchableOpacity>
    );

    const formatDisplay = (value: string) => {
        // Add thousand separators for display
        const parts = value.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Display */}
            <View style={styles.displayContainer}>
                <Text
                    style={styles.display}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    {formatDisplay(displayValue)}
                </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
                {/* Row 1 */}
                <View style={styles.row}>
                    {renderButton(
                        displayValue !== '0' ? 'C' : 'AC',
                        handleClear,
                        styles.functionButton,
                        styles.functionButtonText
                    )}
                    {renderButton(
                        '+/-',
                        handleToggleSign,
                        styles.functionButton,
                        styles.functionButtonText
                    )}
                    {renderButton(
                        '%',
                        handlePercent,
                        styles.functionButton,
                        styles.functionButtonText
                    )}
                    {renderButton(
                        '÷',
                        () => handleOperation('÷'),
                        operation === '÷'
                            ? styles.operationButtonActive
                            : styles.operationButton,
                        styles.operationButtonText
                    )}
                </View>

                {/* Row 2 */}
                <View style={styles.row}>
                    {renderButton('7', () => handleNumber('7'))}
                    {renderButton('8', () => handleNumber('8'))}
                    {renderButton('9', () => handleNumber('9'))}
                    {renderButton(
                        '×',
                        () => handleOperation('×'),
                        operation === '×'
                            ? styles.operationButtonActive
                            : styles.operationButton,
                        styles.operationButtonText
                    )}
                </View>

                {/* Row 3 */}
                <View style={styles.row}>
                    {renderButton('4', () => handleNumber('4'))}
                    {renderButton('5', () => handleNumber('5'))}
                    {renderButton('6', () => handleNumber('6'))}
                    {renderButton(
                        '-',
                        () => handleOperation('-'),
                        operation === '-'
                            ? styles.operationButtonActive
                            : styles.operationButton,
                        styles.operationButtonText
                    )}
                </View>

                {/* Row 4 */}
                <View style={styles.row}>
                    {renderButton('1', () => handleNumber('1'))}
                    {renderButton('2', () => handleNumber('2'))}
                    {renderButton('3', () => handleNumber('3'))}
                    {renderButton(
                        '+',
                        () => handleOperation('+'),
                        operation === '+'
                            ? styles.operationButtonActive
                            : styles.operationButton,
                        styles.operationButtonText
                    )}
                </View>

                {/* Row 5 */}
                <View style={styles.row}>
                    {renderButton(
                        '0',
                        () => handleNumber('0'),
                        styles.zeroButton
                    )}
                    {renderButton('.', handleDecimal)}
                    {renderButton(
                        '=',
                        handleEquals,
                        styles.operationButton,
                        styles.operationButtonText
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000'
    },
    displayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        paddingBottom: 20
    },
    display: {
        color: '#fff',
        fontSize: 70,
        fontWeight: '300'
    },
    buttonsContainer: {
        paddingHorizontal: 10,
        paddingBottom: 20
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    button: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '400'
    },
    functionButton: {
        backgroundColor: '#a5a5a5'
    },
    functionButtonText: {
        color: '#000'
    },
    operationButton: {
        backgroundColor: '#ff9500'
    },
    operationButtonActive: {
        backgroundColor: '#fff'
    },
    operationButtonText: {
        color: '#fff',
        fontSize: 38
    },
    zeroButton: {
        width: BUTTON_SIZE * 2 + 10,
        alignItems: 'flex-start',
        paddingLeft: 35
    }
});

export default CalculatorApp;
