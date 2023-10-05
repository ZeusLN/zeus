import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import NavigationService from '../../NavigationService';

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
        const {
            showInfoModal,
            infoModalText,
            infoModalLink,
            infoModalNav,
            toggleInfoModal
        } = this.props.ModalStore;

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
                            width: '100%',
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
                            infoModalText.map((text: string, index: number) => (
                                <Text
                                    key={index}
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
                            {(infoModalLink || infoModalNav) && (
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
                                            toggleInfoModal();
                                            if (infoModalLink)
                                                UrlUtils.goToUrl(infoModalLink);
                                            if (infoModalNav)
                                                NavigationService.navigate(
                                                    infoModalNav
                                                );
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
