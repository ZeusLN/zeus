import React from 'react';
import { View, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';

import Text from '../../components/Text';
import Button from '../../components/Button';
import ModalBox from '../ModalBox';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { font } from '../../utils/FontUtils';

import ModalStore from '../../stores/ModalStore';

interface ChannelBackupModalProps {
    ModalStore?: ModalStore;
}

@inject('ModalStore')
@observer
export default class ChannelBackupModal extends React.Component<ChannelBackupModalProps> {
    render() {
        const { ModalStore } = this.props;
        const {
            showRestoreChannelModal,
            toggleRestoreChannelModal,
            onCheckOlympus,
            onImportFile,
            onContinueWithoutBackup,
            onCancelBackupModal
        } = ModalStore!;

        return (
            <ModalBox
                isOpen={showRestoreChannelModal}
                style={{
                    backgroundColor: themeColor('background'),
                    borderRadius: 24,
                    height: 480,
                    width: '90%',
                    alignSelf: 'center'
                }}
                onClosed={() => toggleRestoreChannelModal({ show: false })}
                swipeToClose={false}
                backButtonClose={true}
                backdropPressToClose={false}
                backdrop={true}
                position="center"
            >
                <View style={styles.container}>
                    <Text
                        style={{
                            ...styles.title,
                            fontFamily: font('marlideBold'),
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.Tools.migration.import')}
                    </Text>

                    <Text
                        style={{
                            ...styles.description,
                            color: themeColor('text')
                        }}
                    >
                        {`${localeString(
                            'views.Tools.migration.import.message1'
                        )}\n\n${localeString(
                            'views.Tools.migration.import.message2'
                        )}`}
                    </Text>

                    <Button
                        title={localeString(
                            'views.Tools.migration.import.olympus'
                        )}
                        onPress={() => {
                            if (onCheckOlympus) onCheckOlympus();
                            toggleRestoreChannelModal({ show: false });
                        }}
                        containerStyle={{ marginBottom: 16 }}
                    />

                    <Button
                        title={localeString(
                            'views.Tools.migration.import.local'
                        )}
                        onPress={() => {
                            if (onImportFile) onImportFile();
                            toggleRestoreChannelModal({ show: false });
                        }}
                        containerStyle={{ marginBottom: 16 }}
                    />

                    <Button
                        title={localeString(
                            'views.Tools.migration.import.noBackup'
                        )}
                        onPress={() => {
                            if (onContinueWithoutBackup)
                                onContinueWithoutBackup();
                            toggleRestoreChannelModal({ show: false });
                        }}
                        containerStyle={{ marginBottom: 16 }}
                        warning
                    />

                    <Button
                        title={localeString('general.cancel')}
                        onPress={() => {
                            if (onCancelBackupModal) onCancelBackupModal();
                            toggleRestoreChannelModal({ show: false });
                        }}
                        secondary
                    />
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    title: {
        fontSize: 32,
        marginBottom: 12,
        textAlign: 'center'
    },
    description: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 18,
        marginBottom: 28,
        textAlign: 'left'
    }
});
