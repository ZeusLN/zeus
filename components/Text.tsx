import * as React from 'react';
import { Text, TextStyle, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import { themeColor } from './../utils/ThemeUtils';

import ModalStore from '../stores/ModalStore';

interface TextProps {
    ModalStore?: ModalStore;
    style?: TextStyle;
    children?: string;
    infoModalText?: string | Array<string>;
    infoModalLink?: string;
    infoModalAdditionalButtons?: Array<{
        title: string;
        callback?: () => void;
    }>;
}

@inject('ModalStore')
@observer
export default class ZeusText extends React.Component<TextProps, {}> {
    render() {
        const {
            children,
            style,
            infoModalText,
            infoModalLink,
            infoModalAdditionalButtons,
            ModalStore
        } = this.props;
        const { toggleInfoModal } = ModalStore!;

        const CoreText = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color: themeColor('text'),
                    ...style
                }}
            >
                {children}
                {infoModalText && (
                    <Text
                        style={{
                            color: themeColor('text'),
                            ...style,
                            fontWeight: 'bold'
                        }}
                    >
                        {'  ⓘ'}
                    </Text>
                )}
            </Text>
        );

        if (infoModalText) {
            return (
                <TouchableOpacity
                    onPress={() =>
                        toggleInfoModal({
                            text: infoModalText,
                            link: infoModalLink,
                            buttons: infoModalAdditionalButtons
                        })
                    }
                >
                    <CoreText />
                </TouchableOpacity>
            );
        }

        return <CoreText />;
    }
}
