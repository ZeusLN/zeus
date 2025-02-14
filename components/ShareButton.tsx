import * as React from 'react';
import { Platform, TouchableOpacity, ViewStyle } from 'react-native';

import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import { Icon } from 'react-native-elements';

import Button from './../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { sleep } from '../utils/SleepUtils';
import { themeColor } from '../utils/ThemeUtils';

type QRCodeElement = React.ElementRef<typeof QRCode>;

interface ShareButtonProps {
    value: string;
    qrRef: React.RefObject<QRCodeElement> | null;
    title?: string;
    icon?: any;
    noUppercase?: boolean;
    iconOnly?: boolean;
    onPress: () => Promise<void>;
    onShareComplete?: () => void;
    iconContainerStyle?: ViewStyle;
}

export default class ShareButton extends React.Component<ShareButtonProps> {
    handlePress = async () => {
        const { onPress } = this.props;
        await onPress();
        await this.shareContent();
    };

    shareContent = async () => {
        const { value, qrRef, onShareComplete } = this.props;
        try {
            if (!qrRef?.current) return;

            if (Platform.OS === 'ios') await sleep(500);
            const base64Data = await captureRef(qrRef.current, {
                format: 'png',
                quality: 1
            });

            await Share.open({
                message: value,
                url: base64Data
            });
        } catch (error) {
            // Share API throws error when share sheet closes, regardless of success
            console.log('Error in shareContent:', error);
        } finally {
            onShareComplete?.();
        }
    };

    render() {
        const { title, icon, noUppercase, iconOnly, iconContainerStyle } =
            this.props;

        if (iconOnly) {
            return (
                <TouchableOpacity
                    // "padding: 5" leads to a larger area where users can click on
                    // "iconContainerStyle" allows contextual spacing (marginRight)
                    // when used alongside ShareButton
                    style={[{ padding: 5 }, iconContainerStyle]}
                    onPress={this.handlePress}
                >
                    <Icon
                        name={'share'}
                        size={27}
                        color={themeColor('secondaryText')}
                    />
                </TouchableOpacity>
            );
        }

        return (
            <Button
                title={title || localeString('general.share')}
                icon={
                    icon
                        ? icon
                        : {
                              name: 'share',
                              size: 25
                          }
                }
                containerStyle={{
                    marginTop: 10,
                    marginBottom: Platform.OS === 'android' ? 0 : 20
                }}
                onPress={this.handlePress}
                secondary
                noUppercase={noUppercase}
            />
        );
    }
}
