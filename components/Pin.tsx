import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import PinPad from './PinPad';
import PinCircles from './PinCircles';

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
                justifyContent: 'flex-end'
            }}
        >
            <View
                style={{
                    flex: 1,
                    justifyContent: 'flex-start'
                }}
            >
                <PinCircles
                    pinLength={pinLength}
                    numFilled={pinValue.length}
                    hidePinLength={hidePinLength}
                />
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
