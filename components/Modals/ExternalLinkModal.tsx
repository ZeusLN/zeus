import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';
import CopyBox from '../../components/CopyBox';

import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';

import Leaving from '../../assets/images/SVG/Leaving.svg';

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
        const {
            showExternalLinkModal,
            modalUrl,
            toggleExternalLinkModal,
            onPress
        } = this.props.ModalStore;

        return (
            <ModalBox
                isOpen={showExternalLinkModal}
                style={{
                    backgroundColor: 'transparent',
                    paddingLeft: 24,
                    paddingRight: 24,
                    height: 580
                }}
                onClosed={() => toggleExternalLinkModal(false)}
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
                        <CopyBox
                            heading={localeString(
                                'components.ExternalLinkModal.copyLink'
                            )}
                            URL={modalUrl}
                            headingCopied={localeString(
                                'components.ExternalLinkModal.copied'
                            )}
                            theme="dark"
                        />
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
