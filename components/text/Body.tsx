import * as React from 'react';
import { Text } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

export function Body({
    secondary = false,
    bold = false,
    small = false,
    children
}) {
    return (
        <Text
            style={{
                color: secondary
                    ? themeColor('secondaryText')
                    : themeColor('text'),
                fontWeight: bold ? 'bold' : 'normal',
                fontSize: small ? 12 : 16
            }}
        >
            {children}
        </Text>
    );
}
