import * as React from 'react';
import { StyleSheet, Text, View, ScrollView, Modal } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { CheckBox } from 'react-native-elements';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import SettingsStore from '../../stores/SettingsStore';

interface CustodialWalletWarningState {
    checkbox1: boolean;
    checkbox2: boolean;
    checkbox3: boolean;
    checkbox4: boolean;
    showModal: boolean;
    [key: string]: boolean | undefined;
}

interface CustodialWalletWarningProps {
    SettingsStore: SettingsStore;
    navigation: StackNavigationProp<any, any>;
}

@inject('SettingsStore')
@observer
export default class CustodialWalletWarning extends React.Component<
    CustodialWalletWarningProps,
    CustodialWalletWarningState
> {
    constructor(props: CustodialWalletWarningProps) {
        super(props);
        this.state = {
            checkbox1: false,
            checkbox2: false,
            checkbox3: false,
            checkbox4: false,
            showModal: false
        };
    }

    areAllChecked = () => {
        const { checkbox1, checkbox2, checkbox3, checkbox4 } = this.state;
        return checkbox1 && checkbox2 && checkbox3 && checkbox4;
    };

    toggleModal = () => {
        this.setState({
            showModal: !this.state.showModal,
            checkbox1: false,
            checkbox2: false,
            checkbox3: false,
            checkbox4: false
        });
    };

    updateNode = () => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;
        const { nodes, selectedNode } = settings;

        if (nodes && nodes.length > 0) {
            const currentNodeIndex = selectedNode || 0;
            const currentNode = nodes[currentNodeIndex];

            // Update the dismissCustodialWarning property
            const updatedNode = {
                ...currentNode,
                dismissCustodialWarning: true
            };

            // Replace the current node with the updated node
            const updatedNodes = [...nodes];
            updatedNodes[currentNodeIndex] = updatedNode;

            // Save the updated nodes array back to the settings
            updateSettings({ nodes: updatedNodes })
                .then(() => {
                    console.log('Node configuration updated successfully.');
                })
                .catch((error) => {
                    console.error(
                        'Failed to update node configuration:',
                        error
                    );
                });
        } else {
            console.error('No nodes available to update.');
        }
    };

    render() {
        const { SettingsStore, navigation } = this.props;
        const { showModal } = this.state;
        const nodes = SettingsStore?.settings?.nodes || [];

        // check if user has embedded node wallet configured already
        let hasEmbeddedWallet;
        if (nodes) {
            const result = nodes?.filter(
                (node) => node.implementation === 'embedded-lnd'
            );
            if (result.length > 0) {
                hasEmbeddedWallet = true;
            }
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: `⚠ ${localeString(
                            'general.warning'
                        ).toUpperCase()}`,
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        backgroundColor: themeColor('background')
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ margin: 20 }}>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.Settings.CustodialWalletWarning.graph1'
                            )}
                        </Text>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >
                            {localeString(
                                'views.Settings.CustodialWalletWarning.graph2'
                            )}
                        </Text>
                        {!hasEmbeddedWallet && (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.CustodialWalletWarning.graph3'
                                    )}
                                </Text>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.CustodialWalletWarning.graph4'
                                    )}
                                </Text>
                            </>
                        )}
                    </View>
                </ScrollView>
                {!hasEmbeddedWallet && (
                    <View style={{ bottom: 10 }}>
                        <View
                            style={{
                                paddingBottom: 10
                            }}
                        >
                            <Button
                                title={localeString(
                                    'views.Settings.CustodialWalletWarning.create'
                                )}
                                onPress={() => {
                                    navigation.navigate('WalletConfiguration', {
                                        newEntry: true,
                                        index:
                                            (nodes &&
                                                nodes.length &&
                                                Number(nodes.length)) ||
                                            0
                                    });
                                }}
                            />
                        </View>
                    </View>
                )}

                <Modal
                    visible={showModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={this.toggleModal}
                >
                    <View style={styles.modalOverlay}>
                        <View
                            style={{
                                ...styles.modalContainer,
                                backgroundColor: themeColor('modalBackground')
                            }}
                        >
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Settings.CustodialWalletWarning.dismissWarningHeader'
                                )}
                            </Text>
                            {[
                                localeString(
                                    'views.Settings.CustodialWalletWarning.dismissWarning1'
                                ),
                                localeString(
                                    'views.Settings.CustodialWalletWarning.dismissWarning2'
                                ),
                                localeString(
                                    'views.Settings.CustodialWalletWarning.dismissWarning3'
                                ),
                                localeString(
                                    'views.Settings.CustodialWalletWarning.dismissWarning4'
                                )
                            ].map((title, index) => (
                                <CheckBox
                                    key={index}
                                    title={title}
                                    checked={this.state[`checkbox${index + 1}`]}
                                    onPress={() =>
                                        this.setState((prevState) => ({
                                            [`checkbox${index + 1}`]:
                                                !prevState[
                                                    `checkbox${index + 1}`
                                                ]
                                        }))
                                    }
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        borderWidth: 0,
                                        width: '100%'
                                    }}
                                    textStyle={{
                                        ...styles.text,
                                        color: themeColor('text'),
                                        flex: 1
                                    }}
                                />
                            ))}
                            <View style={styles.modalButtonContainer}>
                                <Button
                                    title={localeString(
                                        'views.Settings.CustodialWalletWarning.dismissWarning'
                                    )}
                                    disabled={!this.areAllChecked()}
                                    onPress={() => {
                                        this.updateNode();
                                        this.toggleModal();
                                        navigation.popTo('Wallet');
                                    }}
                                    containerStyle={{ paddingBottom: 20 }}
                                />
                                <Button
                                    title={localeString('general.close')}
                                    onPress={() => {
                                        this.toggleModal();
                                    }}
                                    secondary
                                />
                            </View>
                        </View>
                    </View>
                </Modal>

                <Button
                    title={localeString(
                        'views.Settings.CustodialWalletWarning.dismissWarning'
                    )}
                    onPress={this.toggleModal}
                    secondary
                />
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontSize: 16,
        fontWeight: 'normal',
        paddingTop: 12
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        width: '86%',
        padding: 22,
        borderRadius: 10,
        alignItems: 'center'
    },
    modalButtonContainer: {
        marginTop: 20,
        width: '100%',
        alignItems: 'center'
    }
});
