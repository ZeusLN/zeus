import React from 'react';
import { View, StyleSheet } from 'react-native';

import Text from '../Text';
import LoadingIndicator from '../LoadingIndicator';
import ModalBox from '../ModalBox';

import { themeColor } from '../../utils/ThemeUtils';

interface ChannelBackupLoadingModalProps {
    isOpen: boolean;
    message?: string;
}

export default class ChannelBackupLoadingModal extends React.Component<ChannelBackupLoadingModalProps> {
    render() {
        const { isOpen, message } = this.props;

        return (
            <ModalBox
                isOpen={isOpen}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
                }}
                swipeToClose={false}
                backButtonClose={false}
                backdropPressToClose={false}
                backdrop={true}
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
                            backgroundColor: themeColor('background'),
                            borderRadius: 24,
                            padding: 30,
                            width: '80%',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <LoadingIndicator size={60} />
                        {message ? (
                            <Text
                                style={{
                                    ...styles.message,
                                    color: themeColor('text')
                                }}
                            >
                                {message}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    message: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 18,
        marginTop: 20,
        textAlign: 'center'
    }
});
