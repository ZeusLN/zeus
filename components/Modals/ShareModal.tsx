import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import Text from '../../components/Text';
import { Row } from '../../components/layout/Row';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import QR from '../../assets/images/SVG/QR.svg';
import TextSVG from '../../assets/images/SVG/Text.svg';

interface ShareModalProps {
    ModalStore: ModalStore;
}

@inject('ModalStore')
@observer
export default class ShareModal extends React.Component<ShareModalProps, {}> {
    render() {
        const { ModalStore } = this.props;
        const {
            showShareModal,
            toggleShareModal,
            shareQR,
            shareText,
            closeVisibleModalDialog
        } = ModalStore;

        return (
            <ModalBox
                style={{
                    ...styles.modal,
                    backgroundColor: themeColor('background')
                }}
                swipeToClose={true}
                backButtonClose={true}
                backdropPressToClose={true}
                backdrop={true}
                position="bottom"
                isOpen={showShareModal}
                onClosed={() => toggleShareModal({})}
            >
                <View>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('text'),
                            fontSize: 16,
                            paddingTop: 24,
                            paddingBottom: 24
                        }}
                    >
                        {localeString('general.share')}
                    </Text>
                    <TouchableOpacity
                        key="share-qr"
                        onPress={async () => {
                            shareQR();
                            closeVisibleModalDialog();
                        }}
                        style={{
                            ...styles.sendOption,
                            backgroundColor: themeColor('secondary')
                        }}
                    >
                        <Row>
                            <View style={{ marginRight: 15 }}>
                                <QR
                                    fill={
                                        themeColor('action') ||
                                        themeColor('highlight')
                                    }
                                    width={30}
                                    height={30}
                                />
                            </View>
                            <Text
                                style={{
                                    ...styles.sendOptionLabel,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('general.qr')}
                            </Text>
                        </Row>
                    </TouchableOpacity>
                    <TouchableOpacity
                        key="share-text"
                        onPress={async () => {
                            shareText();
                            closeVisibleModalDialog();
                        }}
                        style={{
                            ...styles.sendOption,
                            backgroundColor: themeColor('secondary')
                        }}
                    >
                        <Row>
                            <View style={{ marginRight: 15 }}>
                                <TextSVG
                                    fill={
                                        themeColor('action') ||
                                        themeColor('highlight')
                                    }
                                    width={30}
                                    height={30}
                                />
                            </View>
                            <Text
                                style={{
                                    ...styles.sendOptionLabel,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('general.text')}
                            </Text>
                        </Row>
                    </TouchableOpacity>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    modal: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: 250,
        paddingLeft: 24,
        paddingRight: 24
    },
    sendOption: {
        borderRadius: 5,
        padding: 16,
        marginBottom: 24
    },
    sendOptionLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 22
    }
});
