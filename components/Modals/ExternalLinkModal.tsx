import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Copy from '../../assets/images/SVG/Copy.svg';
import Leaving from '../../assets/images/SVG/Leaving.svg';

import Clipboard from '@react-native-clipboard/clipboard';

interface ExternalLinkModalProps {
    ModalStore: ModalStore;
}

@inject('ModalStore')
@observer
export default class ExternalLinkModal extends React.Component<
    ExternalLinkModalProps,
    {}
> {
    render() {
        const { ModalStore } = this.props;
        const {
            showExternalLinkModal,
            modalUrl,
            toggleExternalLinkModal,
            onPress
        } = ModalStore;

        return (
            <ModalBox
                isOpen={showExternalLinkModal}
                style={{
                    backgroundColor: 'transparent',
                    paddingLeft: 24,
                    paddingRight: 24,
                    height: 580
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
                        <Leaving />
                        <Text
                            style={{
                                fontSize: 24,
                                fontWeight: 'bold',
                                color: 'black'
                            }}
                        >
                            {localeString(
                                'components.ExternalLinkModal.externalLink'
                            )}
                        </Text>
                        <Text
                            style={{
                                marginTop: 20,
                                marginBottom: 25,
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'components.ExternalLinkModal.proceed'
                            )}
                        </Text>
                        <TouchableOpacity
                            style={{
                                borderWidth: 1,
                                borderRadius: 5,
                                marginBottom: 25,
                                backgroundColor: themeColor('background'),
                                marginLeft: -25,
                                marginRight: -25
                            }}
                            onPress={() => Clipboard.setString(modalUrl)}
                        >
                            <Text
                                style={{
                                    padding: 20,
                                    paddingRight: 45,
                                    paddingBottom: 5,
                                    fontWeight: 'bold',
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'components.ExternalLinkModal.copyLink'
                                )}
                            </Text>
                            <Text
                                style={{
                                    padding: 20,
                                    paddingRight: 45,
                                    color: themeColor('text')
                                }}
                            >
                                {modalUrl}
                            </Text>
                            <View
                                style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: 10
                                }}
                            >
                                <Copy
                                    height="30px"
                                    width="30px"
                                    stroke={themeColor('text')}
                                />
                            </View>
                        </TouchableOpacity>
                        <View style={styles.buttons}>
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.proceed')}
                                    onPress={onPress}
                                    tertiary
                                ></Button>
                            </View>
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() =>
                                        toggleExternalLinkModal(false)
                                    }
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
