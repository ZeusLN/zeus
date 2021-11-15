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
}

export default class Button extends React.Component<ButtonProps, {}> {
    render() {
        const { title, icon, onPress, secondary, tertiary, iconOnly, adaptiveWidth } =
            this.props;
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
                        ? themeColor('background')
                        : tertiary
                        ? themeColor('text')
                        : secondary
                        ? themeColor('secondary')
                        : themeColor('highlight')
                }}
                titleStyle={{
                    color: secondary
                        ? themeColor('highlight')
                        : themeColor('background'),
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
                }}
                containerStyle={{
                    alignItems: 'center'
                }}
                onPress={onPress}
                containerStyle={{
                    borderWidth: secondary ? 2 : 0,
                    borderColor: themeColor('highlight'),
                    alignSelf: 'center',
                    width: adaptiveWidth ? null : '100%'
                }}
            />
        );
    }
}
