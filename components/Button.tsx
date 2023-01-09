import * as React from 'react';
import { Button as ElementsButton } from 'react-native-elements';
import { themeColor } from './../utils/ThemeUtils';

interface ButtonProps {
    title: string;
    icon?: any;
    titleStyle?: any;
    onPress?: any;
    secondary?: boolean;
    tertiary?: boolean;
    quaternary?: boolean;
    quinary?: boolean;
    iconOnly?: boolean;
    adaptiveWidth?: boolean;
    containerStyle?: any;
    buttonStyle?: any;
    noUppercase?: boolean;
    disabled?: boolean;
}

function Button(props: ButtonProps) {
    const {
        title,
        icon,
        titleStyle,
        onPress,
        secondary,
        tertiary,
        quaternary,
        quinary,
        iconOnly,
        adaptiveWidth,
        containerStyle,
        buttonStyle,
        noUppercase,
        disabled
    } = props;

    const newContainerStyle: any = adaptiveWidth
        ? {
              ...containerStyle,
              borderColor:
                  (containerStyle && containerStyle.borderColor) ||
                  themeColor('highlight'),
              alignSelf: 'center',
              borderRadius: 30
          }
        : {
              ...containerStyle,
              borderColor:
                  (containerStyle && containerStyle.borderColor) ||
                  themeColor('highlight'),
              alignSelf: 'center',
              borderRadius: 30,
              width: '90%'
          };

    return (
        <ElementsButton
            icon={
                icon
                    ? {
                          color: icon.color
                              ? icon.color
                              : iconOnly
                              ? themeColor('text')
                              : secondary
                              ? themeColor('highlight')
                              : themeColor('background'),
                          ...icon
                      }
                    : null
            }
            title={title}
            buttonStyle={{
                backgroundColor: iconOnly
                    ? 'transparent'
                    : quinary
                    ? themeColor('secondary')
                    : quaternary
                    ? themeColor('background')
                    : tertiary
                    ? themeColor('highlight')
                    : secondary
                    ? themeColor('secondary')
                    : themeColor('text'),
                ...buttonStyle
            }}
            titleStyle={
                titleStyle
                    ? {
                          ...titleStyle,
                          textTransform: noUppercase ? 'none' : 'uppercase',
                          fontFamily: 'Lato-Bold'
                      }
                    : {
                          color: iconOnly
                              ? themeColor('text')
                              : quinary
                              ? themeColor('text')
                              : quaternary
                              ? themeColor('text')
                              : secondary
                              ? themeColor('highlight')
                              : themeColor('background'),
                          textTransform: noUppercase ? 'none' : 'uppercase',
                          fontFamily: 'Lato-Bold'
                      }
            }
            onPress={onPress}
            containerStyle={newContainerStyle}
            disabled={disabled}
        />
    );
}

export default Button;
