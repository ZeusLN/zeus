import * as React from 'react';
import { Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@rneui/themed';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface CopiedToastProps {
    visible: boolean;
}

export default function CopiedToast({ visible }: CopiedToastProps) {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={() => {}}
        >
            <View style={styles.container}>
                <View
                    style={[
                        styles.toast,
                        { backgroundColor: themeColor('text') }
                    ]}
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
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: Math.max(Dimensions.get('window').height * 0.15, 160)
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
