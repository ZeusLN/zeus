import React from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';

import { themeColor } from '../utils/ThemeUtils';

import Skull from '../assets/images/SVG/Skull.svg';

const DangerousCopySeedButton = ({
    onPress,
    style
}: {
    onPress: () => void;
    style?: ViewStyle;
}) => (
    <TouchableOpacity onPress={onPress} style={style}>
        <Skull fill={themeColor('text')} />
    </TouchableOpacity>
);

export default DangerousCopySeedButton;
