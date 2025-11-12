import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { inject, observer } from 'mobx-react';

import ModalBox from '../ModalBox';
import Button from '../Button';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import {
    handleEnableGraphSync,
    handleIgnoreOnce,
    handleNeverAskAgain
} from '../../utils/GraphSyncUtils';

import TransactionsStore from '../../stores/TransactionsStore';

interface GraphSyncPromptModalProps {
    TransactionsStore: TransactionsStore;
}

interface GraphSyncPromptModalState {
    loading: boolean;
}

@inject('TransactionsStore')
@observer
export default class GraphSyncPromptModal extends React.Component<
    GraphSyncPromptModalProps,
    GraphSyncPromptModalState
> {
    state = {
        loading: false
    };

    handleEnableAndRestart = async () => {
        const { loading } = this.state;
        const { TransactionsStore } = this.props;

        if (loading) return;
        this.setState({ loading: true });

        try {
            await handleEnableGraphSync();
            TransactionsStore.hideGraphSyncPrompt();
        } catch (error) {
            console.error('Error enabling graph sync:', error);
        } finally {
            this.setState({ loading: false });
        }
    };

    handleIgnoreOnce = async () => {
        const { loading } = this.state;

        if (loading) return;
        this.setState({ loading: true });

        try {
            await handleIgnoreOnce();
        } catch (error) {
            console.error('Error handling ignore once:', error);
        } finally {
            this.setState({ loading: false });
        }
    };

    handleNeverAskAgain = async () => {
        const { loading } = this.state;
        const { TransactionsStore } = this.props;

        if (loading) return;
        this.setState({ loading: true });

        try {
            await handleNeverAskAgain();
            TransactionsStore.proceedWithPayment();
        } catch (error) {
            console.error('Error handling never ask again:', error);
        } finally {
            this.setState({ loading: false });
        }
    };

    render() {
        const { TransactionsStore } = this.props;
        const { showGraphSyncPrompt } = TransactionsStore;

        return (
            <ModalBox
                isOpen={showGraphSyncPrompt}
                onClosed={() => TransactionsStore.hideGraphSyncPrompt()}
                swipeToClose={true}
                backButtonClose={true}
                backdropPressToClose={true}
                backdrop={true}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
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
                            backgroundColor: themeColor('modalBackground'),
                            borderRadius: 30,
                            padding: 30,
                            width: '100%',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2
                            },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            elevation: 5
                        }}
                    >
                        <Text
                            style={{
                                ...styles.header,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.GraphSyncPrompt.title')}
                        </Text>

                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text'),
                                marginBottom: 30
                            }}
                        >
                            {localeString('views.GraphSyncPrompt.message')}
                        </Text>

                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.GraphSyncPrompt.enableAndRestart'
                                )}
                                onPress={this.handleEnableAndRestart}
                                disabled={this.state.loading}
                                icon={{
                                    name: 'sync',
                                    size: 25,
                                    color: themeColor('background')
                                }}
                            />
                        </View>

                        <View style={styles.rowButtons}>
                            <View style={styles.halfButton}>
                                <Button
                                    title={
                                        localeString('general.ignore') +
                                        '\n' +
                                        localeString('general.once')
                                    }
                                    onPress={this.handleIgnoreOnce}
                                    disabled={this.state.loading}
                                    buttonStyle={{
                                        backgroundColor:
                                            themeColor('highlight'),
                                        borderColor: themeColor('highlight')
                                    }}
                                    titleStyle={{
                                        color: themeColor('background'),
                                        textAlign: 'center',
                                        flexShrink: 1,
                                        includeFontPadding: false
                                    }}
                                />
                            </View>
                            <View style={styles.halfButton}>
                                <Button
                                    title={
                                        localeString('general.neverAsk') +
                                        '\n' +
                                        localeString('general.again')
                                    }
                                    onPress={this.handleNeverAskAgain}
                                    disabled={this.state.loading}
                                    buttonStyle={{
                                        backgroundColor:
                                            themeColor('highlight'),
                                        borderColor: themeColor('highlight')
                                    }}
                                    titleStyle={{
                                        color: themeColor('background'),
                                        textAlign: 'center',
                                        flexShrink: 1,
                                        includeFontPadding: false
                                    }}
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
    header: {
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: 'bold',
        fontSize: 20,
        marginBottom: 15,
        textAlign: 'center'
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 16,
        lineHeight: 22,
        textAlign: 'center'
    },
    button: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 10
    },
    rowButtons: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginVertical: 10
    },
    halfButton: {
        flex: 1,
        marginHorizontal: 5,
        minWidth: 140
    }
});
