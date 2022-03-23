import * as React from 'react';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import { themeColor } from '../utils/ThemeUtils';
import { Row } from './layout/Row';
import Success from './../assets/images/SVG/Success.svg';
import Touchable from './Touchable';

interface PinPadProps {
    appendValue: (newValue: string) => void;
    clearValue: () => void;
    deleteValue: () => void;
    submitValue?: () => void;
    shuffle?: boolean;
    hidePinLength?: boolean;
    minLength?: number;
    maxLength?: number;
    numberHighlight?: boolean;
}

export default function PinPad({
    appendValue,
    clearValue,
    deleteValue,
    submitValue = () => void 0,
    shuffle = false,
    hidePinLength = false,
    minLength = 4,
    maxLength = 8,
    numberHighlight = false
}: PinPadProps) {
    // PinPad state only depends on pin value length, not the actual pin/amount value
    // Parent component to PinPad can store pin/amount value
    const [pinValueLength, setPinValueLength] = useState(0);

    // Sets pinNumbers before first render, and doesn't reset them on state change
    const pinNumbers = useMemo(() => {
        let pinNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        if (shuffle) {
            // shuffle the order of the numbers using schwartzian transform
            pinNumbers = pinNumbers
                .map((value) => ({ value, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
        }

        return pinNumbers;
    }, []);

    const incrementPinValueLength = () => {
        if (pinValueLength < maxLength) {
            setPinValueLength(pinValueLength + 1);
        }
    };

    const decrementPinValueLength = () => {
        if (pinValueLength > 0) {
            setPinValueLength(pinValueLength - 1);
        }
    };

    const clearPinValueLength = () => {
        setPinValueLength(0);
    };

    return (
        <View style={styles.bottom}>
            <Row align="flex-end" style={styles.pinPadRow}>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[1]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[1]}</Text>
                </Touchable>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[2]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[2]}</Text>
                </Touchable>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[3]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[3]}</Text>
                </Touchable>
            </Row>
            <Row align="flex-end" style={styles.pinPadRow}>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[4]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[4]}</Text>
                </Touchable>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[5]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[5]}</Text>
                </Touchable>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[6]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[6]}</Text>
                </Touchable>
            </Row>
            <Row align="flex-end" style={styles.pinPadRow}>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[7]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[7]}</Text>
                </Touchable>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[8]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[8]}</Text>
                </Touchable>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[9]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[9]}</Text>
                </Touchable>
            </Row>
            <Row align="flex-end" style={styles.pinPadRow}>
                <Touchable
                    touch={() => {
                        decrementPinValueLength();
                        deleteValue();
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{'<'}</Text>
                </Touchable>
                <Touchable
                    touch={() => {
                        incrementPinValueLength();
                        appendValue(pinNumbers[0]);
                    }}
                    highlight={numberHighlight}
                    style={styles.key}
                >
                    <Text style={styles.pinPadNumber}>{pinNumbers[0]}</Text>
                </Touchable>
                {!hidePinLength && (
                    <Touchable
                        touch={() => {
                            clearPinValueLength();
                            clearValue();
                        }}
                        highlight={numberHighlight}
                        style={styles.key}
                    >
                        <Text style={styles.pinPadNumber}>C</Text>
                    </Touchable>
                )}
                {!!hidePinLength && pinValueLength >= minLength && (
                    <Touchable
                        touch={() => {
                            submitValue();
                            clearPinValueLength();
                        }}
                        highlight={numberHighlight}
                        style={styles.key}
                    >
                        <Success />
                    </Touchable>
                )}
                {!!hidePinLength && pinValueLength < minLength && (
                    <Pressable style={styles.key}></Pressable>
                )}
            </Row>
        </View>
    );
}

const styles = StyleSheet.create({
    pinPadRow: {
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 10
    },
    pinPadNumber: {
        color: themeColor('text'),
        fontSize: 20,
        fontFamily: 'Lato-Bold'
    },
    bottom: {
        justifyContent: 'flex-end',
        marginBottom: 75
    },
    key: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: 60
    }
});
