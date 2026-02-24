import React from 'react';
import { Modal, Text, View } from 'react-native';

import Button from '../Button';
import CopyButton from '../CopyButton';
import seedStyles from '../seedStyles';

import { localeString } from '../../utils/LocaleUtils';

interface DangerousCopySeedModalProps {
    visible: boolean;
    seedPhrase: string[];
    onClose: () => void;
    dangerousText1Key?: string;
}

const DangerousCopySeedModal = ({
    visible,
    seedPhrase,
    onClose,
    dangerousText1Key = 'views.Settings.Seed.dangerousText1'
}: DangerousCopySeedModalProps) => (
    <Modal animationType="slide" transparent={true} visible={visible}>
        <View style={seedStyles.centeredView}>
            <View style={seedStyles.modal}>
                {visible && (
                    <View>
                        <Text
                            style={{
                                ...seedStyles.blackText,
                                fontSize: 40,
                                alignSelf: 'center',
                                marginBottom: 20
                            }}
                        >
                            {localeString('general.danger')}
                        </Text>
                        <Text
                            style={{
                                color: 'black',
                                margin: 10
                            }}
                        >
                            {localeString(dangerousText1Key)}
                        </Text>
                        <Text
                            style={{
                                ...seedStyles.blackText,
                                color: 'black',
                                margin: 10
                            }}
                        >
                            {localeString('views.Settings.Seed.dangerousText2')}
                        </Text>
                        <View style={seedStyles.button}>
                            <CopyButton
                                title={localeString(
                                    'views.Settings.Seed.dangerousButton'
                                )}
                                copyValue={seedPhrase.join(' ')}
                                icon={{
                                    name: 'warning',
                                    size: 25
                                }}
                            />
                        </View>
                        <View style={seedStyles.button}>
                            <Button
                                title={localeString('general.cancel')}
                                onPress={onClose}
                            />
                        </View>
                    </View>
                )}
            </View>
        </View>
    </Modal>
);

export default DangerousCopySeedModal;
