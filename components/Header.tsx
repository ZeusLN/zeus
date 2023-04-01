import React from 'react';
import { Header, Icon } from 'react-native-elements';
import { themeColor } from '../utils/ThemeUtils';

interface HeaderProps {
    leftComponent?: 'Back' | 'Close' | JSX.Element;
    centerComponent?: JSX.Element;
    rightComponent?: JSX.Element;
    containerStyle?: any;
    placement?: 'left' | 'center' | 'right' | undefined;
    navigation?: any;
}

function ZeusHeader(props: HeaderProps) {
    const BackButton = () => (
        <Icon
            name="arrow-back"
            onPress={() => props.navigation.goBack()}
            color={themeColor('text')}
            underlayColor="transparent"
        />
    );

    const CloseButton = () => (
        <Icon
            name="close"
            onPress={() => props.navigation.goBack()}
            color={themeColor('text')}
            underlayColor="transparent"
        />
    );

    const {
        leftComponent,
        centerComponent,
        rightComponent,
        containerStyle,
        placement
    } = props;
    return (
        <Header
            leftComponent={
                leftComponent === 'Back'
                    ? BackButton
                    : leftComponent === 'Close'
                    ? CloseButton
                    : leftComponent
                    ? leftComponent
                    : null
            }
            centerComponent={centerComponent ? centerComponent : null}
            rightComponent={rightComponent ? rightComponent : null}
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
