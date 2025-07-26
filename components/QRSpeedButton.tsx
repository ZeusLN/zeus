import * as React from 'react';
import { Platform, TouchableOpacity, ViewStyle } from 'react-native';
import { observer } from 'mobx-react';
import { themeColor } from '../utils/ThemeUtils';

import SpeedMeter from '../assets/images/SVG/SpeedMeter.svg';
import Button from './Button';
import { localeString } from '../utils/LocaleUtils';

interface QRSpeedMeterButtonProps {
    showOptions: boolean;
    onPress: () => void;
    iconOnly?: boolean;
    iconSize?: number;
    iconContainerStyle?: ViewStyle;
    noUppercase?: boolean;
    icon?: any;
}

@observer
export default class QRSpeedMeterButton extends React.Component<QRSpeedMeterButtonProps> {
    render() {
        const {
            showOptions,
            onPress,
            iconContainerStyle,
            iconOnly,
            noUppercase,
            icon
        } = this.props;

        if (iconOnly) {
            return (
                <TouchableOpacity
                    onPress={onPress}
                    style={[
                        {
                            padding: 5,
                            borderRadius: 8,
                            backgroundColor: showOptions
                                ? themeColor('secondary')
                                : 'transparent'
                        },
                        iconContainerStyle
                    ]}
                >
                    <SpeedMeter
                        width={27}
                        height={27}
                        fill={themeColor('secondaryText')}
                    />
                </TouchableOpacity>
            );
        }
        const buttonTitle = localeString('components.QRSpeedMeterButton.speed');
        return (
            <Button
                title={buttonTitle}
                onPress={onPress}
                icon={icon}
                containerStyle={{
                    marginTop: 10,
                    marginBottom: Platform.OS === 'android' ? 0 : 20
                }}
                secondary
                noUppercase={noUppercase}
            />
        );
    }
}
