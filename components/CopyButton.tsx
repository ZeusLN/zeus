import * as React from 'react';
import { Platform, TouchableOpacity, ViewStyle } from 'react-native';
import { Icon } from 'react-native-elements';
import Clipboard from '@react-native-clipboard/clipboard';
import Button from './../components/Button';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

interface CopyButtonProps {
    title?: string;
    copyValue: string;
    icon?: any;
    noUppercase?: boolean;
    iconOnly?: boolean;
    iconSize?: number;
    copyIconContainerStyle?: ViewStyle;
}

interface CopyButtonState {
    copied: boolean;
}

export default class CopyButton extends React.Component<
    CopyButtonProps,
    CopyButtonState
> {
    isComponentMounted = false;

    state = {
        copied: false
    };

    componentDidMount() {
        this.isComponentMounted = true;
    }

    componentWillUnmount() {
        this.isComponentMounted = false;
    }

    copyToClipboard = () => {
        const { copyValue } = this.props;
        this.setState({
            copied: true
        });

        Clipboard.setString(copyValue);

        setTimeout(() => {
            if (this.isComponentMounted) {
                this.setState({
                    copied: false
                });
            }
        }, 5000);
    };

    render() {
        const { copied } = this.state;
        const {
            title,
            icon,
            noUppercase,
            iconOnly,
            iconSize,
            copyIconContainerStyle
        } = this.props;

        const buttonTitle = copied
            ? localeString('components.CopyButton.copied')
            : title || localeString('components.CopyButton.copy');

        if (iconOnly) {
            return (
                <TouchableOpacity
                    // "padding: 5" leads to a larger area where users can click on
                    // "copyIconContainerStyle" allows contextual spacing (marginRight)
                    // when used alongside ShareButton
                    style={[{ padding: 5 }, copyIconContainerStyle]}
                    onPress={() => this.copyToClipboard()}
                >
                    <Icon
                        name={copied ? 'check' : 'content-copy'}
                        size={iconSize ?? 27}
                        color={themeColor('secondaryText')}
                    />
                </TouchableOpacity>
            );
        }

        return (
            <Button
                title={buttonTitle}
                icon={
                    icon && !copied
                        ? icon
                        : {
                              name: 'content-copy',
                              size: 25
                          }
                }
                containerStyle={{
                    marginTop: 10,
                    marginBottom: Platform.OS === 'android' ? 0 : 20
                }}
                onPress={() => this.copyToClipboard()}
                secondary
                noUppercase={noUppercase}
            />
        );
    }
}
