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
    iconOnly?: boolean;
    adaptiveWidth?: boolean;
    containerStyle?: any;
    buttonStyle?: any;
    noUppercase?: boolean;
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
        iconOnly,
        adaptiveWidth,
        containerStyle,
        buttonStyle,
        noUppercase
    } = props;

    const newContainerStyle: any = adaptiveWidth
        ? {
              ...containerStyle,
              borderWidth: secondary ? 2 : 0,
              borderColor:
                  (containerStyle && containerStyle.borderColor) ||
                  themeColor('highlight'),
              alignSelf: 'center',
              borderRadius: 30
          }
        : {
              ...containerStyle,
              borderWidth: secondary ? 2 : 0,
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
                    : {
                          color: iconOnly
                              ? themeColor('text')
                              : secondary
                              ? themeColor('highlight')
                              : themeColor('background')
                      }
            }
            title={title}
            buttonStyle={
                buttonStyle
                    ? buttonStyle
                    : {
                          backgroundColor: iconOnly
                              ? 'transparent'
                              : quaternary
                              ? themeColor('background')
                              : tertiary
                              ? themeColor('highlight')
                              : secondary
                              ? themeColor('secondary')
                              : themeColor('text')
                      }
            }
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
        />
    );
}

export default Button;
