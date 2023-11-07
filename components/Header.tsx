import React from 'react';
import {
    StyleProp,
    TextStyle,
    TouchableOpacity,
    ViewStyle
} from 'react-native';
import { Header, Icon, TextProps } from 'react-native-elements';
import { IconObject } from 'react-native-elements/dist/icons/Icon';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Back from '../assets/images/SVG/Back.svg';

interface HeaderIcon extends IconObject {
    icon?: string;
    text?: string;
    color?: string;
    style?: StyleProp<TextStyle>;
}

interface HeaderProps {
    leftComponent?:
        | React.ReactElement<{}>
        | TextProps
        | HeaderIcon
        | 'Back'
        | 'Close';
    centerComponent?: React.ReactElement<{}> | TextProps | HeaderIcon;
    rightComponent?: React.ReactElement<{}> | TextProps | HeaderIcon;
    containerStyle?: ViewStyle;
    placement?: 'left' | 'center' | 'right' | undefined;
    navigation?: any;
    onBack?: () => void;
}

function ZeusHeader(props: HeaderProps) {
    const BackButton = (onBack?: () => void) => (
        <TouchableOpacity
            onPress={() => {
                if (onBack) onBack();
                props.navigation.goBack();
            }}
            accessibilityLabel={localeString('general.goBack')}
        >
            <Back stroke={themeColor('text')} />
        </TouchableOpacity>
    );

    const CloseButton = (onBack?: () => void) => (
        <Icon
            name="close"
            onPress={() => {
                if (onBack) onBack();
                props.navigation.goBack();
            }}
            color={themeColor('text')}
            underlayColor="transparent"
            size={35}
            accessibilityLabel={localeString('general.close')}
        />
    );

    const {
        leftComponent,
        centerComponent,
        rightComponent,
        containerStyle,
        placement,
        onBack
    } = props;
    return (
        <Header
            leftComponent={
                leftComponent === 'Back'
                    ? BackButton(onBack)
                    : leftComponent === 'Close'
                    ? CloseButton(onBack)
                    : leftComponent
                    ? leftComponent
                    : undefined
            }
            centerComponent={centerComponent ? centerComponent : undefined}
            rightComponent={rightComponent ? rightComponent : undefined}
            backgroundColor="transparent"
            containerStyle={{
                ...containerStyle,
                borderBottomWidth: 0
            }}
            placement={placement}
        />
    );
}

export default ZeusHeader;
