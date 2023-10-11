import * as React from 'react';
import { View } from 'react-native';

export function Row({
    flex = 0,
    justify = 'flex-start',
    align = 'center',
    style = {},
    children,
    accessible,
    accessibilityLabel
}: {
    flex?: number;
    justify?:
        | 'flex-start'
        | 'flex-end'
        | 'center'
        | 'space-between'
        | 'space-around';
    align?:
        | 'flex-start'
        | 'flex-end'
        | 'center'
        | 'space-between'
        | 'space-around';
    style?: any;
    children?: React.ReactNode;
    accessible?: boolean;
    accessibilityLabel?: string;
}) {
    return (
        <View
            style={{
                flex,
                flexDirection: 'row',
                justifyContent: justify,
                alignItems: align,
                ...style
            }}
            accessible={accessible}
            accessibilityLabel={accessibilityLabel}
        >
            {children}
        </View>
    );
}
