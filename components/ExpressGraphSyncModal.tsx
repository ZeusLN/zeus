import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { observer } from 'mobx-react';

import Button from './Button';
import ModalBox from './ModalBox';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface ExpressGraphSyncModalProps {
    onEnableAndRestart?: () => void;
    onSkip?: () => void;
}

interface ExpressGraphSyncModalState {
    isVisible: boolean;
}

@observer
export default class ExpressGraphSyncModal extends React.Component<
    ExpressGraphSyncModalProps,
    ExpressGraphSyncModalState
> {
    constructor(props: ExpressGraphSyncModalProps) {
        super(props);
        this.state = {
            isVisible: false
        };
    }

    public show = () => {
        this.setState({ isVisible: true });
    };

    public hide = () => {
        this.setState({ isVisible: false });
    };

    private handleEnableAndRestart = () => {
        const { onEnableAndRestart } = this.props;
        this.hide();
        if (onEnableAndRestart) {
            onEnableAndRestart();
        }
    };

    private handleSkip = () => {
        const { onSkip } = this.props;
        this.hide();
        if (onSkip) {
            onSkip();
        }
    };

    render() {
        const { isVisible } = this.state;

        return (
            <ModalBox
                isOpen={isVisible}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 300
                }}
                onClosed={this.hide}
            >
                <View style={styles.container}>
                    <View
                        style={[
                            styles.modalContent,
                            { backgroundColor: themeColor('modalBackground') }
                        ]}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <Text
                                style={[
                                    styles.title,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {localeString(
                                    'components.ExpressGraphSyncModal.title'
                                )}
                            </Text>
                        </View>

                        {/* Content */}
                        <View style={styles.content}>
                            <Text
                                style={[
                                    styles.description,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString(
                                    'components.ExpressGraphSyncModal.description'
                                )}
                            </Text>

                            <View style={styles.benefitsList}>
                                <Text
                                    style={[
                                        styles.benefitItem,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    •{' '}
                                    {localeString(
                                        'components.ExpressGraphSyncModal.benefit1'
                                    )}
                                </Text>
                                <Text
                                    style={[
                                        styles.benefitItem,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    •{' '}
                                    {localeString(
                                        'components.ExpressGraphSyncModal.benefit2'
                                    )}
                                </Text>
                                <Text
                                    style={[
                                        styles.benefitItem,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    •{' '}
                                    {localeString(
                                        'components.ExpressGraphSyncModal.benefit3'
                                    )}
                                </Text>
                            </View>

                            <Text
                                style={[
                                    styles.note,
                                    { color: themeColor('warning') }
                                ]}
                            >
                                {localeString(
                                    'components.ExpressGraphSyncModal.restartNote'
                                )}
                            </Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                            <Button
                                title={localeString(
                                    'components.ExpressGraphSyncModal.enableAndRestart'
                                )}
                                onPress={this.handleEnableAndRestart}
                                containerStyle={styles.primaryButton}
                                accessibilityLabel={localeString(
                                    'components.ExpressGraphSyncModal.enableAndRestart'
                                )}
                            />

                            <Button
                                title={localeString(
                                    'components.ExpressGraphSyncModal.skipForNow'
                                )}
                                onPress={this.handleSkip}
                                secondary
                                containerStyle={styles.secondaryButton}
                                accessibilityLabel={localeString(
                                    'components.ExpressGraphSyncModal.skipForNow'
                                )}
                            />
                        </View>
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
        alignItems: 'center',
        paddingHorizontal: 20
    },
    modalContent: {
        borderRadius: 20,
        padding: 30,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    header: {
        marginBottom: 20,
        alignItems: 'center'
    },
    title: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 22,
        fontWeight: '600',
        textAlign: 'center'
    },
    content: {
        marginBottom: 30
    },
    description: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 20
    },
    benefitsList: {
        marginBottom: 20
    },
    benefitItem: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8
    },
    note: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        opacity: 0.8
    },
    actions: {
        gap: 15
    },
    primaryButton: {
        marginBottom: 0
    },
    secondaryButton: {
        marginBottom: 0
    }
});
