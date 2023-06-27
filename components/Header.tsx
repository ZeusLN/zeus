import React from 'react';
import { Header, Icon } from 'react-native-elements';
import { themeColor } from '../utils/ThemeUtils';
import { StyleProp, ViewStyle } from 'react-native';

interface HeaderProps {
    leftComponent?: 'Back' | 'Close' | JSX.Element;
    centerComponent?: JSX.Element;
    rightComponent?: JSX.Element;
    containerStyle?: StyleProp<ViewStyle>;
    placement?: 'left' | 'center' | 'right' | undefined;
    navigation?: any;
    onBack?: () => void;
}

function ZeusHeader(props: HeaderProps) {
    const BackButton = (onBack?: () => void) => (
        <Icon
            name="arrow-back"
            onPress={() => {
                if (onBack) onBack();
                props.navigation.goBack();
            }}
            color={themeColor('text')}
            underlayColor="transparent"
        />
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
