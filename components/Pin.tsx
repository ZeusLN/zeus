import React, { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import PinPad from './PinPad';
import PinCircles from './PinCircles';
import ShowHideToggle from '../components/ShowHideToggle';

interface PinProps {
    onSubmit: (value: string, pinConfirm?: boolean) => void;
    onPinChange?: () => void;
    hidePinLength: boolean;
    pinLength?: number;
    pinConfirm?: boolean;
    shuffle?: boolean;
}

export default function Pin({
    onSubmit,
    onPinChange = () => void 0,
    hidePinLength,
    pinLength = 4,
    pinConfirm = false,
    shuffle = true
}: PinProps) {
    const [pinValue, setPinValue] = useState('');
    const [showPin, setShowPin] = useState(false);
    const maxLength = 8;
    const minLength = 4;

    const appendValue = (newValue: string) => {
        if (pinValue.length + 1 <= maxLength) {
            setPinValue(`${pinValue}${newValue}`);
        }
    };

    const clearValue = () => {
        setPinValue('');
    };

    const deleteValue = () => {
        if (pinValue.length <= 1) {
            clearValue();
        } else {
            setPinValue(`${pinValue.slice(0, pinValue.length - 1)}`);
        }
    };

    const submitValue = () => {
        onSubmit(pinValue, pinConfirm);
        setPinValue('');
    };

    const toggleShowPin = () => {
        setShowPin(!showPin);
    };

    useEffect(() => {
        if (!hidePinLength && pinValue.length === pinLength) {
            onSubmit(pinValue, pinConfirm);
            setPinValue('');
        } else if (pinValue !== '') {
            onPinChange();
        }
    }, [pinValue]);

    return (
        <View
            style={{
                flex: 1,
                justifyContent: 'flex-start'
            }}
        >
            <View
                style={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {showPin ? (
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Bold',
                            fontSize: 27,
                            letterSpacing: 21,
                            left: Platform.OS === 'ios' ? 12 : 0,
                            color: '#FFD93F'
                        }}
                    >
                        {pinValue}
                    </Text>
                ) : (
                    <PinCircles
                        pinLength={pinLength}
                        numFilled={pinValue.length}
                        hidePinLength={hidePinLength}
                    />
                )}
                {pinValue.length > 0 && (
                    <View style={{ marginTop: 20 }}>
                        <ShowHideToggle onPress={toggleShowPin} />
                    </View>
                )}
            </View>
            <View
                style={{
                    flex: 1,
                    justifyContent: 'flex-end'
                }}
            >
                <PinPad
                    appendValue={appendValue}
                    clearValue={clearValue}
                    deleteValue={deleteValue}
                    submitValue={submitValue}
                    shuffle={shuffle}
                    hidePinLength={hidePinLength}
                    minLength={minLength}
                    maxLength={maxLength}
                />
            </View>
        </View>
    );
}
