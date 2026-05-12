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
    fontSize: fontSizeOverride = undefined,
    lineHeight = undefined,
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
    fontSize?: number;
    // Override the natural line height. Useful when a glyph (e.g. ₿) is
    // missing from the bundled font and falls back to a system font with
    // taller metrics, which would otherwise inflate row height.
    lineHeight?: number;
    // These should only be keys available on the theme
    // TODO: enforce this with some global ThemeKey enum?
    colorOverride?: string;
    color?:
        | 'text'
        | 'success'
        | 'warning'
        | 'warningReserve'
        | 'highlight'
        | 'secondaryText'
        | 'outbound'
        | 'inbound';
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
                fontSize: fontSizeOverride
                    ? fontSizeOverride
                    : small
                    ? 12
                    : big
                    ? 20
                    : jumbo
                    ? 40
                    : defaultSize
                    ? undefined
                    : 16,
                lineHeight,
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
