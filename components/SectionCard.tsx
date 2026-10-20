import * as React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon } from '@rneui/themed';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface SectionCardProps {
    title?: string;
    // Shows an info button next to the title
    onInfoPress?: () => void;
    // Nested cards use the screen background so they stand out from the
    // card around them
    nested?: boolean;
    style?: ViewStyle;
    children?: React.ReactNode;
}

export default function SectionCard({
    title,
    onInfoPress,
    nested,
    style,
    children
}: SectionCardProps) {
    return (
        <View
            style={{
                ...styles.card,
                backgroundColor: nested
                    ? themeColor('background')
                    : themeColor('secondary'),
                ...style
            }}
        >
            {(title || onInfoPress) && (
                <View style={styles.header}>
                    <Text
                        style={{
                            ...styles.title,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {title}
                    </Text>
                    {onInfoPress && (
                        <Icon
                            name="info"
                            onPress={onInfoPress}
                            color={themeColor('text')}
                            underlayColor="transparent"
                            size={26}
                            accessibilityLabel={localeString('general.info')}
                        />
                    )}
                </View>
            )}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 15,
        padding: 20
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    title: {
        flex: 1,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
