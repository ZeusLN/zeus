import * as React from 'react';
import { Switch as RNSwitch } from 'react-native';
import { themeColor } from './../utils/ThemeUtils';

interface SwitchProps {
    value: boolean;
    onValueChange?: any;
    disabled?: boolean;
}

function Switch(props: SwitchProps) {
    const { value, onValueChange, disabled } = props;
    return (
        <RNSwitch
            value={value}
            onValueChange={onValueChange}
            trackColor={{
                false: themeColor('disabled'),
                true: themeColor('highlight')
            }}
            thumbColor={
                value ? themeColor('highlight') : themeColor('disabled')
            }
            style={{
                alignSelf: 'flex-end'
            }}
            disabled={disabled}
        />
    );
}

export default Switch;
