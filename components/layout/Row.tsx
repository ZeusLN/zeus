import * as React from 'react';
import { View } from 'react-native';

export function Row({
    justify = 'flex-start',
    align = 'center',
    style = {},
    children
}) {
    return (
        <View
            style={{
                flexDirection: 'row',
                justifyContent: justify,
                alignItems: align,
                ...style
            }}
        >
            {children}
        </View>
    );
}
