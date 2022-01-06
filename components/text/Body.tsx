import * as React from 'react';
import { Text } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

export function Body({
    secondary = false,
    bold = false,
    small = false,
    big = false,
    jumbo = false,
    color = undefined,
    children
}: {
    secondary?: boolean;
    bold?: boolean;
    small?: boolean;
    big?: boolean;
    jumbo?: boolean;
    // These should only be keys available on the theme
    // TODO: enforce this with some global ThemeKey enum?
    color?: 'text' | 'success' | 'warning' | 'highlight' | 'secondaryText';
    children: React.ReactNode;
}) {
    return (
        <Text
            style={{
                // If there's a color prop, use that directly, otherwise check if secondary text
                color: color
                    ? themeColor(color)
                    : secondary
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
