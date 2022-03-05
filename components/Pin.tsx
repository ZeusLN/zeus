import React, { useState } from 'react';
import { View } from 'react-native';
import PinPad from './PinPad';
import PinCircles from './PinCircles';

export default function Pin() {
    const [pinValue, setPinValue] = useState('');
    const pinLength = 4;

    const appendValue = (newValue: string) => {
        setPinValue(`${pinValue}${newValue}`);
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

    return (
        <View>
            <PinCircles pinLength={pinLength} numFilled={pinValue.length} />
            <PinPad
                appendValue={appendValue}
                clearValue={clearValue}
                deleteValue={deleteValue}
            />
        </View>
    );
}
