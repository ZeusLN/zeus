import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';

import { font } from '../../utils/FontUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface InfoModalProps {
    ModalStore: ModalStore;
}

@inject('ModalStore')
@observer
export default class InfoModal extends React.Component<InfoModalProps, {}> {
    render() {
        const { ModalStore } = this.props;
        const {
            showInfoModal,
            infoModalTitle,
            infoModalText,
            infoModalLink,
            infoModalAdditionalButtons,
            toggleInfoModal
        } = ModalStore;

        const additionalButtonsCount = infoModalAdditionalButtons?.length || 0;

        return (
            <ModalBox
                isOpen={showInfoModal}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
                }}
                onClosed={() => toggleInfoModal({})}
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
                            backgroundColor: themeColor('secondary'),
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
                        {infoModalTitle && (
                            <Text
                                style={{
                                    fontFamily: font('marlideBold'),
                                    color: themeColor('text'),
                                    fontSize: 34,
                                    textAlign: 'center',
                                    marginBottom: 20
                                }}
                            >
                                {infoModalTitle}
                            </Text>
                        )}

                        {typeof infoModalText === 'string' && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('text'),
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
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('text'),
                                        fontSize: 18,
                                        marginBottom: 20
                                    }}
                                >
                                    {text}
                                </Text>
                            ))}

                        <View style={styles.buttons}>
                            {infoModalAdditionalButtons?.map(
                                ({ title, callback }, index) => (
                                    <View
                                        key={index}
                                        style={{
                                            ...styles.button,
                                            marginBottom: 25
                                        }}
                                    >
                                        <Button
                                            title={title}
                                            onPress={() => {
                                                toggleInfoModal({});
                                                if (callback) callback();
                                            }}
                                            // index 0 = primary (default)
                                            tertiary={index === 1}
                                            quaternary={index >= 1}
                                        />
                                    </View>
                                )
                            )}
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
                                            toggleInfoModal({});
                                            UrlUtils.goToUrl(infoModalLink);
                                        }}
                                        // Style based on the count of preceding additional buttons
                                        // additionalButtonsCount 0 => index 0 (primary)
                                        secondary={additionalButtonsCount === 1} // index 1 = secondary
                                        tertiary={additionalButtonsCount === 2} // index 2 = tertiary
                                        quaternary={additionalButtonsCount >= 3} // index 3+ = quaternary
                                    />
                                </View>
                            )}
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.close')}
                                    onPress={() => toggleInfoModal({})}
                                    secondary
                                />
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
        width: '100%',
        alignItems: 'center'
    },
    button: {
        width: 350
    }
});
