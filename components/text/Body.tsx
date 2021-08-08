import * as React from 'react';
import { Text } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

export function Body({
    secondary = false,
    bold = false,
    small = false,
    big = false,
    jumbo = false,
    children
}: {
    secondary?: boolean;
    bold?: boolean;
    small?: boolean;
    big?: boolean;
    jumbo?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Text
            style={{
                color: secondary
                    ? themeColor('secondaryText')
                    : themeColor('text'),
                fontWeight: bold ? 'bold' : 'normal',
                fontSize: small ? 12 : big ? 20 : jumbo ? 40 : 16
            }}
        >
            {children}
        </Text>
    );
}
