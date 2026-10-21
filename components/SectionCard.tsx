import * as React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
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
    // With onToggle the title opens and closes the card. A closed card
    // shows the summary in place of its children.
    expanded?: boolean;
    onToggle?: () => void;
    summary?: React.ReactNode;
    style?: ViewStyle;
    children?: React.ReactNode;
}

export default function SectionCard({
    title,
    onInfoPress,
    nested,
    expanded,
    onToggle,
    summary,
    style,
    children
}: SectionCardProps) {
    const collapsible = !!onToggle;
    const open = !collapsible || !!expanded;

    const titleText = (
        <Text
            style={{
                ...styles.title,
                ...(nested ? styles.nestedTitle : {}),
                color: themeColor('secondaryText')
            }}
        >
            {title}
        </Text>
    );

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
                    {collapsible ? (
                        <TouchableOpacity
                            style={styles.toggle}
                            onPress={onToggle}
                            accessibilityRole="button"
                            accessibilityLabel={title}
                            accessibilityState={{ expanded: open }}
                        >
                            {titleText}
                            <Icon
                                name={open ? 'expand-less' : 'expand-more'}
                                color={themeColor('secondaryText')}
                                size={26}
                                accessible={false}
                            />
                        </TouchableOpacity>
                    ) : (
                        titleText
                    )}
                    {onInfoPress && (
                        <Icon
                            name="info"
                            onPress={onInfoPress}
                            color={themeColor('text')}
                            underlayColor="transparent"
                            size={26}
                            accessibilityLabel={localeString('general.info')}
                            containerStyle={
                                collapsible ? styles.infoAfterToggle : undefined
                            }
                        />
                    )}
                </View>
            )}
            {open ? (
                children
            ) : summary ? (
                <TouchableOpacity
                    style={styles.summary}
                    onPress={onToggle}
                    accessibilityRole="button"
                    accessibilityHint={title}
                >
                    {summary}
                </TouchableOpacity>
            ) : null}
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
    toggle: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center'
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    nestedTitle: {
        fontSize: 16
    },
    infoAfterToggle: {
        marginLeft: 10
    },
    summary: {
        paddingTop: 15
    }
});
