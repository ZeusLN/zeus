import * as React from 'react';
import { Text } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

export function Body({
    secondary = false,
    bold = false,
    small = false,
    big = false,
    jumbo = false,
    defaultSize = false,
    color = undefined,
    colorOverride = undefined,
    children,
    accessible,
    accessibilityLabel
}: {
    secondary?: boolean;
    bold?: boolean;
    small?: boolean;
    big?: boolean;
    jumbo?: boolean;
    defaultSize?: boolean;
    // These should only be keys available on the theme
    // TODO: enforce this with some global ThemeKey enum?
    colorOverride?: string;
    color?: 'text' | 'success' | 'warning' | 'highlight' | 'secondaryText';
    children: React.ReactNode;
    accessible?: boolean;
    accessibilityLabel?: string;
}) {
    return (
        <Text
            style={{
                // First check for colorOverride prop, if not check if there's a
                // color prop to use, otherwise check if secondary text
                color: colorOverride
                    ? colorOverride
                    : color
                    ? themeColor(color)
                    : secondary
                    ? themeColor('secondaryText')
                    : themeColor('text'),
                fontSize: small
                    ? 12
                    : big
                    ? 20
                    : jumbo
                    ? 40
                    : defaultSize
                    ? undefined
                    : 16,
                fontFamily:
                    bold || jumbo
                        ? 'PPNeueMontreal-Medium'
                        : 'PPNeueMontreal-Book'
            }}
            accessible={accessible}
            accessibilityLabel={accessibilityLabel}
        >
            {children}
        </Text>
    );
}
