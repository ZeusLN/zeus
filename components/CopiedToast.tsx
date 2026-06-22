import * as React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@rneui/themed';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

const DURATION = 2000;

let listeners: Array<(visible: boolean) => void> = [];
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

export function showCopiedToast() {
    if (hideTimeout) clearTimeout(hideTimeout);
    listeners.forEach((l) => l(true));
    hideTimeout = setTimeout(() => {
        listeners.forEach((l) => l(false));
        hideTimeout = null;
    }, DURATION);
}

export default function CopiedToastHost() {
    const [visible, setVisible] = React.useState(false);
    React.useEffect(() => {
        listeners.push(setVisible);
        return () => {
            listeners = listeners.filter((l) => l !== setVisible);
        };
    }, []);

    if (!visible) return null;
    return (
        <View pointerEvents="none" style={styles.container}>
            <View
                style={[styles.toast, { backgroundColor: themeColor('text') }]}
            >
                <Icon
                    name="check"
                    size={18}
                    color={themeColor('background')}
                    containerStyle={{ marginRight: 6 }}
                />
                <Text
                    style={[
                        styles.toastText,
                        { color: themeColor('background') }
                    ]}
                >
                    {localeString('components.CopyButton.copied')}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(Dimensions.get('window').height * 0.15, 160),
        alignItems: 'center'
    },
    toast: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 5
    },
    toastText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14
    }
});
