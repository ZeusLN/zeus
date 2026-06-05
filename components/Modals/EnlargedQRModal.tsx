import React from 'react';
import { Dimensions, TouchableWithoutFeedback, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { inject, observer } from 'mobx-react';

import ModalBox from '../ModalBox';
import ModalStore from '../../stores/ModalStore';
import { themeColor } from '../../utils/ThemeUtils';

const defaultLogo = require('../../assets/images/icon_black.png');
const defaultLogoWhite = require('../../assets/images/icon_white.png');

interface EnlargedQRModalProps {
    ModalStore?: ModalStore;
}

@inject('ModalStore')
@observer
export default class EnlargedQRModal extends React.Component<
    EnlargedQRModalProps,
    {}
> {
    render() {
        const ModalStore = this.props.ModalStore!;
        const { showEnlargedQR, enlargedQRValue, enlargedQRLogo } = ModalStore;

        const { width } = Dimensions.get('window');
        const close = () => ModalStore.toggleEnlargedQR();

        const logo =
            enlargedQRLogo ??
            (themeColor('invertQrIcons') ? defaultLogoWhite : defaultLogo);

        return (
            <ModalBox
                isOpen={showEnlargedQR}
                onClosed={() => ModalStore.clearEnlargedQR()}
                backdropPressToClose={true}
                backdropColor="black"
                backdropOpacity={0.6}
                swipeToClose={false}
                style={{
                    backgroundColor: 'transparent'
                }}
            >
                <TouchableWithoutFeedback onPress={close}>
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        {enlargedQRValue ? (
                            <QRCode
                                value={enlargedQRValue}
                                size={width}
                                logo={logo}
                                backgroundColor="white"
                                logoBackgroundColor={
                                    themeColor('invertQrIcons')
                                        ? 'black'
                                        : 'white'
                                }
                                logoMargin={10}
                                quietZone={width / 20}
                            />
                        ) : null}
                    </View>
                </TouchableWithoutFeedback>
            </ModalBox>
        );
    }
}
