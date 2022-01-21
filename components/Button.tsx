import * as React from 'react';
import { Button as ElementsButton } from 'react-native-elements';
import { themeColor } from './../utils/ThemeUtils';

interface ButtonProps {
    title: string;
    icon?: any;
    onPress?: any;
    secondary?: boolean;
    tertiary?: boolean;
    iconOnly?: boolean;
    adaptiveWidth?: boolean;
    containerStyle?: any;
}

function Button(props: ButtonProps) {
    const {
        title,
        icon,
        onPress,
        secondary,
        tertiary,
        iconOnly,
        adaptiveWidth,
        containerStyle
    } = props;

    const newContainerStyle: any = adaptiveWidth
        ? {
              ...containerStyle,
              borderWidth: secondary ? 2 : 0,
              borderColor: themeColor('highlight'),
              alignSelf: 'center',
              borderRadius: 30
          }
        : {
              ...containerStyle,
              borderWidth: secondary ? 2 : 0,
              borderColor: themeColor('highlight'),
              alignSelf: 'center',
              borderRadius: 30,
              width: '90%'
          };

    return (
        <ElementsButton
            icon={{
                ...icon,
                color: iconOnly
                    ? themeColor('text')
                    : secondary
                    ? themeColor('highlight')
                    : themeColor('background')
            }}
            title={title}
            buttonStyle={{
                backgroundColor: iconOnly
                    ? 'transparent'
                    : tertiary
                    ? themeColor('highlight')
                    : secondary
                    ? themeColor('secondary')
                    : themeColor('text')
            }}
            titleStyle={{
                color: iconOnly
                    ? themeColor('text')
                    : secondary
                    ? themeColor('highlight')
                    : themeColor('background'),
                textTransform: 'uppercase',
                fontWeight: 'bold'
            }}
            onPress={onPress}
            containerStyle={newContainerStyle}
        />
    );
}

export default Button;
