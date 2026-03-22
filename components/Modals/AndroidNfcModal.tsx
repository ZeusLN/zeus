import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';
import NfcManager from 'react-native-nfc-manager';

import Button from '../Button';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';

import NFC from '../../assets/images/SVG/NFC.svg';
import { themeColor } from '../../utils/ThemeUtils';

interface AndroidNfcModalProps {
    ModalStore: ModalStore;
}

@inject('ModalStore')
@observer
export default class AndroidNfcModal extends React.Component<
    AndroidNfcModalProps,
    {}
> {
    render() {
        const { ModalStore } = this.props;
        const {
            showAndroidNfcModal,
            toggleAndroidNfcModal,
            androidNfcModalIsNfcEnabled
        } = ModalStore;

        return (
            <ModalBox
                isOpen={showAndroidNfcModal}
                style={{
                    backgroundColor: 'transparent',
                    height: 380
                }}
                swipeToClose={false}
                backButtonClose={false}
                backdropPressToClose={false}
                position="bottom"
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 22
                    }}
                >
                    <View
                        style={{
                            backgroundColor: themeColor('modalBackground'),
                            borderRadius: 30,
                            padding: 35,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2
                            }
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 30,
                                fontWeight: 'bold',
                                color: themeColor('text'),
                                marginBottom: 30
                            }}
                        >
                            {androidNfcModalIsNfcEnabled
                                ? localeString(
                                      'components.AndroidNfcModal.ready'
                                  )
                                : localeString(
                                      'components.AndroidNfcModal.nfcDisabled'
                                  )}
                        </Text>
                        {androidNfcModalIsNfcEnabled && <NFC />}
                        <Text
                            style={{
                                fontSize: 18,
                                color: themeColor('text'),
                                marginTop: 30,
                                marginBottom: 30,
                                textAlign: 'center'
                            }}
                        >
                            {androidNfcModalIsNfcEnabled
                                ? localeString(
                                      'components.AndroidNfcModal.hold'
                                  )
                                : localeString(
                                      'components.AndroidNfcModal.enableInstructions'
                                  )}
                        </Text>
                        <View style={styles.buttons}>
                            {!androidNfcModalIsNfcEnabled && (
                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'general.openNfcSettings'
                                        )}
                                        onPress={() => {
                                            toggleAndroidNfcModal(false);
                                            NfcManager.goToNfcSetting();
                                        }}
                                        quaternary
                                    ></Button>
                                </View>
                            )}
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => toggleAndroidNfcModal(false)}
                                ></Button>
                            </View>
                        </View>
                    </View>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    buttons: {
        width: '100%'
    },
    button: {
        marginBottom: 20,
        width: 350
    }
});
