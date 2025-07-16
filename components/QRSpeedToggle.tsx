import * as React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { observer } from 'mobx-react';

import Text from './Text';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import {
    QR_ANIMATION_SPEED_OPTIONS,
    QRAnimationSpeed
} from '../utils/QRAnimationUtils';

interface QRSpeedToggleProps {
    currentSpeed: QRAnimationSpeed;
    onSpeedChange: (speed: QRAnimationSpeed) => void;
}

@observer
export default class QRSpeedToggle extends React.Component<QRSpeedToggleProps> {
    render() {
        const { currentSpeed, onSpeedChange } = this.props;

        return (
            <View style={styles.container}>
                <Text
                    style={{
                        color: themeColor('secondaryText'),
                        fontSize: 14,
                        fontFamily: 'PPNeueMontreal-Book',
                        marginBottom: 8
                    }}
                >
                    {localeString('views.Settings.Display.qrAnimationSpeed')}
                </Text>
                <View style={styles.buttonContainer}>
                    {QR_ANIMATION_SPEED_OPTIONS.map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.button,
                                {
                                    backgroundColor:
                                        currentSpeed === option.value
                                            ? themeColor('highlight')
                                            : themeColor('secondary')
                                }
                            ]}
                            onPress={() =>
                                onSpeedChange(option.value as QRAnimationSpeed)
                            }
                        >
                            <Text
                                style={
                                    (styles.buttonText,
                                    {
                                        color:
                                            currentSpeed === option.value
                                                ? themeColor('background')
                                                : themeColor('text')
                                    })
                                }
                            >
                                {option.key}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        marginTop: 15,
        alignItems: 'center'
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8
    },
    button: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 60,
        alignItems: 'center'
    },
    buttonText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
