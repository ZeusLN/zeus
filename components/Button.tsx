import * as React from 'react';
import { Button as ElementsButton } from 'react-native-elements';
import { themeColor } from './../utils/ThemeUtils';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';

interface ButtonProps {
    title?: string | React.ReactElement;
    icon?: any;
    titleStyle?: TextStyle;
    onPress?: any;
    secondary?: boolean;
    tertiary?: boolean;
    quaternary?: boolean;
    warning?: boolean;
    iconOnly?: boolean;
    adaptiveWidth?: boolean;
    containerStyle?: any;
    buttonStyle?: StyleProp<ViewStyle>;
    noUppercase?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
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
        warning,
        iconOnly,
        adaptiveWidth,
        containerStyle,
        buttonStyle,
        noUppercase,
        disabled,
        accessibilityLabel
    } = props;

    const newContainerStyle: any = adaptiveWidth
        ? {
              ...containerStyle,
              borderColor:
                  (containerStyle && containerStyle.borderColor) ||
                  themeColor('highlight'),
              alignSelf: 'center',
              borderRadius: 5
          }
        : {
              ...containerStyle,
              borderColor:
                  (containerStyle && containerStyle.borderColor) ||
                  themeColor('highlight'),
              alignSelf: 'center',
              borderRadius: 5,
              width: '90%'
          };

    const textColor = themeColor('buttonText') || themeColor('text');

    return (
        <ElementsButton
            icon={
                icon
                    ? {
                          color: icon.color
                              ? icon.color
                              : iconOnly
                              ? textColor
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
                    : quaternary
                    ? themeColor('buttonBackground') || themeColor('secondary')
                    : tertiary
                    ? themeColor('highlight')
                    : secondary
                    ? themeColor('secondary')
                    : warning
                    ? themeColor('delete')
                    : themeColor('text'),
                ...(buttonStyle as object)
            }}
            titleStyle={
                titleStyle
                    ? {
                          ...(titleStyle as object),
                          textTransform: noUppercase ? 'none' : 'uppercase',
                          fontFamily: 'PPNeueMontreal-Book'
                      }
                    : {
                          color: iconOnly
                              ? textColor
                              : quaternary
                              ? textColor
                              : warning
                              ? themeColor('text')
                              : secondary
                              ? themeColor('highlight')
                              : themeColor('background'),
                          textTransform: noUppercase ? 'none' : 'uppercase',
                          fontFamily: 'PPNeueMontreal-Book'
                      }
            }
            onPress={onPress}
            containerStyle={newContainerStyle}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
        />
    );
}

export default Button;
