import React from 'react';
import {
    StyleProp,
    TextStyle,
    ViewStyle,
    TouchableOpacity
} from 'react-native';
import { Header, TextProps } from 'react-native-elements';
import { IconObject } from 'react-native-elements/dist/icons/Icon';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ArrowLeft from '../assets/images/SVG/Arrow_left.svg';
import Close from '../assets/images/SVG/Close.svg';
import { StackNavigationProp } from '@react-navigation/stack';

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
    navigation?: StackNavigationProp<any, any>;
    onBack?: () => void;
    navigateBackOnBackPress?: boolean;
}

function ZeusHeader(props: HeaderProps) {
    const BackButton = (
        onBack?: () => void,
        navigateBackOnBackPress?: boolean
    ) => (
        <TouchableOpacity
            onPress={() => {
                if (onBack) onBack();
                if (navigateBackOnBackPress) {
                    props.navigation!.goBack();
                }
            }}
            accessibilityLabel={localeString('general.goBack')}
        >
            <ArrowLeft
                fill={themeColor('text')}
                width="30"
                height="30"
                style={{ alignSelf: 'center' }}
            />
        </TouchableOpacity>
    );

    const CloseButton = (onBack?: () => void) => (
        <TouchableOpacity
            onPress={() => {
                if (onBack) onBack();
                props.navigation!.goBack();
            }}
            accessibilityLabel={localeString('general.close')}
        >
            <Close
                fill={themeColor('text')}
                width="30"
                height="30"
                style={{ alignSelf: 'center', marginLeft: 5 }}
            />
        </TouchableOpacity>
    );

    const {
        leftComponent,
        centerComponent,
        rightComponent,
        containerStyle,
        placement,
        onBack,
        navigateBackOnBackPress = true
    } = props;
    return (
        <Header
            leftComponent={
                leftComponent === 'Back'
                    ? BackButton(onBack, navigateBackOnBackPress)
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
