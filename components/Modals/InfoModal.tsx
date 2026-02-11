import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
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
            infoModalBackgroundColor,
            infoModalOnClose,
            toggleInfoModal
        } = ModalStore;

        return (
            <ModalBox
                isOpen={showInfoModal}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200,
                    zIndex: 9999
                }}
                swipeToClose
                backdropPressToClose
                onClosed={() => {
                    if (ModalStore.showInfoModal) {
                        toggleInfoModal({});
                    }
                }}
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
                            backgroundColor:
                                infoModalBackgroundColor ||
                                themeColor('modalBackground'),
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
                        <TouchableOpacity
                            style={styles.closeIcon}
                            onPress={() => toggleInfoModal({})}
                            accessibilityLabel={localeString('general.close')}
                        >
                            <Text
                                style={{
                                    fontFamily: font('marlideBold'),
                                    color: themeColor('text'),
                                    fontSize: 18
                                }}
                            >
                                ✕
                            </Text>
                        </TouchableOpacity>
                        {infoModalLink && (
                            <TouchableOpacity
                                style={styles.helpIcon}
                                onPress={() => {
                                    toggleInfoModal({});
                                    UrlUtils.goToUrl(infoModalLink);
                                }}
                                accessibilityLabel={localeString(
                                    'general.learnMore'
                                )}
                            >
                                <Text
                                    style={{
                                        fontFamily: font('marlideBold'),
                                        color: themeColor('text'),
                                        fontSize: 20
                                    }}
                                >
                                    ?
                                </Text>
                            </TouchableOpacity>
                        )}

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
                                            tertiary={index >= 1}
                                            quaternary={index >= 2}
                                        />
                                    </View>
                                )
                            )}
                            {infoModalOnClose ? (
                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'cashu.upgradePrompt.dontRemind'
                                        )}
                                        onPress={() => {
                                            const onClose = infoModalOnClose;
                                            toggleInfoModal({});
                                            if (onClose) onClose();
                                        }}
                                        secondary
                                    />
                                </View>
                            ) : (
                                <View style={styles.button}>
                                    <Button
                                        title={localeString('general.close')}
                                        onPress={() => toggleInfoModal({})}
                                        secondary
                                    />
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </ModalBox>
        );
    }
}

const baseIconStyle = {
    position: 'absolute' as const,
    top: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1
};

const styles = StyleSheet.create({
    closeIcon: {
        ...baseIconStyle,
        left: 16
    },
    helpIcon: {
        ...baseIconStyle,
        right: 16
    },
    buttons: {
        width: '100%',
        alignItems: 'center'
    },
    button: {
        width: 350
    }
});
