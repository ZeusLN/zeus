import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';
import UrlUtils from '../../utils/UrlUtils';

interface InfoModalProps {
    ModalStore: ModalStore;
}

@inject('ModalStore')
@observer
export default class InfoModal extends React.Component<InfoModalProps, {}> {
    render() {
        const { ModalStore } = this.props;
        const { showInfoModal, infoModalText, infoModalLink, toggleInfoModal } =
            ModalStore;

        return (
            <ModalBox
                isOpen={showInfoModal}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
                }}
                onClosed={() => toggleInfoModal()}
                ref="modal"
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <View
                        style={{
                            backgroundColor: 'white',
                            borderRadius: 30,
                            padding: 30,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2
                            }
                        }}
                    >
                        {typeof infoModalText === 'string' && (
                            <Text
                                style={{
                                    fontFamily: 'Lato-Regular',
                                    fontSize: 20,
                                    marginBottom: 40
                                }}
                            >
                                {infoModalText}
                            </Text>
                        )}

                        {Array.isArray(infoModalText) &&
                            infoModalText.map((text: string) => (
                                <Text
                                    style={{
                                        fontFamily: 'Lato-Regular',
                                        fontSize: 20,
                                        marginBottom: 40
                                    }}
                                >
                                    {text}
                                </Text>
                            ))}

                        <View style={styles.buttons}>
                            {infoModalLink && (
                                <View
                                    style={{
                                        ...styles.button,
                                        marginBottom: 25
                                    }}
                                >
                                    <Button
                                        title={localeString(
                                            'general.learnMore'
                                        )}
                                        onPress={() => {
                                            UrlUtils.goToUrl(infoModalLink);
                                            toggleInfoModal();
                                        }}
                                        tertiary
                                    ></Button>
                                </View>
                            )}
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.close')}
                                    onPress={() => toggleInfoModal()}
                                    secondary
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
        width: 350
    }
});
