import * as React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Row } from './layout/Row';

import { themeColor } from './../utils/ThemeUtils';

import ModalStore from '../stores/ModalStore';

interface TextProps {
    ModalStore: ModalStore;
    style?: any;
    children: string;
    infoText?: string | Array<string>;
    infoLink?: string;
    infoNav?: string;
}

@inject('ModalStore')
@observer
export default class ZeusText extends React.Component<TextProps, {}> {
    render() {
        const { children, style, infoText, infoLink, infoNav, ModalStore } =
            this.props;
        const { toggleInfoModal } = ModalStore;

        const CoreText = () => (
            <Row>
                <Text
                    style={{
                        fontFamily: 'Lato-Regular',
                        color: themeColor('text'),
                        ...style
                    }}
                >
                    {children}
                </Text>
                {infoText && (
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
            </Row>
        );

        if (infoText) {
            return (
                <TouchableOpacity
                    onPress={() => toggleInfoModal(infoText, infoLink, infoNav)}
                >
                    <CoreText />
                </TouchableOpacity>
            );
        }

        return <CoreText />;
    }
}
