import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';

import NFC from '../../assets/images/SVG/NFC.svg';

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
        const { showAndroidNfcModal, toggleAndroidNfcModal } =
            this.props.ModalStore;

        return (
            <ModalBox
                isOpen={showAndroidNfcModal}
                style={{
                    backgroundColor: 'transparent',
                    paddingLeft: 24,
                    paddingRight: 24,
                    height: 380
                }}
                swipeToClose={false}
                backButtonClose={false}
                backdropPressToClose={false}
                position="bottom"
                ref="modal"
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
                            backgroundColor: 'white',
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
                                color: 'darkgrey',
                                marginBottom: 30
                            }}
                        >
                            {localeString('components.AndroidNfcModal.ready')}
                        </Text>
                        <NFC />
                        <Text
                            style={{
                                fontSize: 18,
                                color: 'black',
                                marginTop: 30,
                                marginBottom: 30,
                                textAlign: 'center'
                            }}
                        >
                            {localeString('components.AndroidNfcModal.hold')}
                        </Text>
                        <View style={styles.buttons}>
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => toggleAndroidNfcModal(false)}
                                    quaternary
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
