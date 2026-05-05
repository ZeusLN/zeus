import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';

import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ScreenRecordingWarningModalProps {
    ModalStore: ModalStore;
}

@inject('ModalStore')
@observer
export default class ScreenRecordingWarningModal extends React.Component<
    ScreenRecordingWarningModalProps,
    {}
> {
    render() {
        const { ModalStore } = this.props;
        const { showScreenRecordingWarning, toggleScreenRecordingWarning } =
            ModalStore;

        return (
            <ModalBox
                isOpen={showScreenRecordingWarning}
                swipeToClose={false}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
                }}
            >
                <View style={styles.container}>
                    <View
                        style={{
                            ...styles.card,
                            backgroundColor: themeColor('modalBackground')
                        }}
                    >
                        <Text
                            style={{
                                ...styles.title,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'components.ScreenRecordingWarningModal.title'
                            )}
                        </Text>
                        <Text
                            style={{
                                ...styles.body,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'components.ScreenRecordingWarningModal.message'
                            )}
                        </Text>
                        <Button
                            title={localeString('general.ok')}
                            onPress={() => toggleScreenRecordingWarning(false)}
                            secondary
                        />
                    </View>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    card: {
        borderRadius: 30,
        padding: 30,
        width: '100%'
    },
    title: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 22,
        marginBottom: 15
    },
    body: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 17,
        marginBottom: 25
    }
});
