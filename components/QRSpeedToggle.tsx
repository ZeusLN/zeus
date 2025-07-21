import * as React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { observer } from 'mobx-react';
import { ButtonGroup } from 'react-native-elements';

import { themeColor } from '../utils/ThemeUtils';
import {
    QR_ANIMATION_SPEED_OPTIONS,
    QRAnimationSpeed
} from '../utils/QRAnimationUtils';

import SpeedMeter from '../assets/images/SVG/SpeedMeter.svg';

interface QRSpeedToggleProps {
    currentSpeed: QRAnimationSpeed;
    onSpeedChange: (speed: QRAnimationSpeed) => void;
}

interface QRSpeedToggleState {
    showOptions: boolean;
}

@observer
export default class QRSpeedToggle extends React.Component<
    QRSpeedToggleProps,
    QRSpeedToggleState
> {
    state = {
        showOptions: false
    };

    toggleOptions = () => {
        this.setState((prevState) => ({
            showOptions: !prevState.showOptions
        }));
    };

    render() {
        const { currentSpeed, onSpeedChange } = this.props;
        const { showOptions } = this.state;

        const selectedIndex = QR_ANIMATION_SPEED_OPTIONS.findIndex(
            (option) => option.value === currentSpeed
        );
        const speedButtons = QR_ANIMATION_SPEED_OPTIONS.map((option, index) => {
            return React.createElement(option.icon, {
                width: 28,
                height: 28,
                fill:
                    selectedIndex === index
                        ? themeColor('text')
                        : themeColor('secondaryText')
            });
        });
        return (
            <>
                <TouchableOpacity
                    onPress={this.toggleOptions}
                    style={[
                        {
                            padding: 5,
                            borderRadius: 8,
                            backgroundColor: showOptions
                                ? themeColor('secondary')
                                : 'transparent'
                        }
                    ]}
                >
                    <SpeedMeter
                        width={27}
                        height={27}
                        fill={themeColor('secondaryText')}
                    />
                </TouchableOpacity>
                {showOptions && (
                    <View style={styles.buttonContainer}>
                        <ButtonGroup
                            onPress={(index: number) => {
                                const selectedOption =
                                    QR_ANIMATION_SPEED_OPTIONS[index];
                                onSpeedChange(
                                    selectedOption.value as QRAnimationSpeed
                                );
                            }}
                            selectedIndex={selectedIndex}
                            buttons={speedButtons}
                            selectedButtonStyle={{
                                backgroundColor: themeColor('highlight'),
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 8
                            }}
                            containerStyle={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 12,
                                borderColor: themeColor('secondary'),
                                width: 'auto',
                                minWidth: 250,
                                alignSelf: 'center'
                            }}
                            innerBorderStyle={{
                                color: themeColor('secondary')
                            }}
                        />
                    </View>
                )}
            </>
        );
    }
}

const styles = StyleSheet.create({
    buttonContainer: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000
    }
});
