import * as React from 'react';
import {
    View,
    StyleSheet,
    Alert,
    ScrollView,
    Modal,
    TouchableOpacity,
    Platform,
    Image
} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import { inject, observer } from 'mobx-react';
import { CheckBox, Icon } from '@rneui/themed';
import { StackNavigationProp } from '@react-navigation/stack';
import RNFS from 'react-native-fs';
import {
    pick,
    types,
    isErrorWithCode,
    errorCodes
} from '@react-native-documents/picker';

import Header from '../../components/Header';
import Button from '../../components/Button';
import TextInput from '../../components/TextInput';
import Text from '../../components/Text';
import LoadingIndicator from '../../components/LoadingIndicator';
import NodeIdenticon, { NodeTitle } from '../../components/NodeIdenticon';
import ShowHideToggle from '../../components/ShowHideToggle';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor, isLightTheme } from '../../utils/ThemeUtils';
import { getPhoto } from '../../utils/PhotoUtils';
import {
    saveNodeConfigs,
    createExportFileContent as createExportFileContent,
    saveNodeConfigExportFile,
    decryptExportData
} from '../../utils/NodeConfigUtils';
import KeychainRecoveryUtils, {
    RecoveryResult,
    RecoveryScanResult
} from '../../utils/KeychainRecoveryUtils';

import SettingsStore, {
    Node,
    INTERFACE_KEYS
} from '../../stores/SettingsStore';
import moment from 'moment';

// Helper function to get human-readable implementation name
const getImplementationDisplayName = (
    implementation: string | undefined
): string => {
    if (!implementation) return 'Unknown';
    const found = INTERFACE_KEYS.find((item) => item.value === implementation);
    return found ? found.key : implementation;
};

interface NodeConfigExportImportProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface NodeConfigExportImportState {
    isLoading: boolean;
    activeModal:
        | 'none'
        | 'nodeSelection'
        | 'export'
        | 'info'
        | 'password'
        | 'importNodeSelection'
        | 'recovery'
        | 'recoveryNodeSelection';
    selectedNodes: Array<number>;
    exportPassword: string;
    confirmPassword: string;
    useEncryption: boolean;
    importFilePath: string | null;
    importPassword: string;
    importPasswordHidden: boolean;
    importData?: NodeConfigExport;
    // Import node selection
    importNodes: Node[];
    selectedImportNodes: Array<number>;
    // Recovery state
    isScanning: boolean;
    scanResult: RecoveryScanResult | null;
    selectedRecoveryResult: RecoveryResult | null;
    recoveryNodes: Node[];
    selectedRecoveryNodes: Array<number>;
}

interface NodeConfigExport {
    version: number;
    encrypted: boolean;
    data:
        | {
              nodes: Node[];
          }
        | string;
}

@inject('SettingsStore')
@observer
export default class NodeConfigExportImport extends React.Component<
    NodeConfigExportImportProps,
    NodeConfigExportImportState
> {
    state: NodeConfigExportImportState = {
        isLoading: false,
        activeModal: 'none',
        selectedNodes: [],
        exportPassword: '',
        confirmPassword: '',
        useEncryption: true,
        importFilePath: null,
        importPassword: '',
        importPasswordHidden: true,
        // Import node selection
        importNodes: [],
        selectedImportNodes: [],
        // Recovery state
        isScanning: false,
        scanResult: null,
        selectedRecoveryResult: null,
        recoveryNodes: [],
        selectedRecoveryNodes: []
    };

    private resetExportState = () => {
        this.setState({
            activeModal: 'none',
            exportPassword: '',
            confirmPassword: '',
            selectedNodes: []
        });
    };

    private resetImportState = () => {
        this.setState({
            activeModal: 'none',
            importFilePath: null,
            importPassword: '',
            importPasswordHidden: true,
            importNodes: [],
            selectedImportNodes: []
        });
    };

    private renderInfoModal = () => {
        const { activeModal } = this.state;

        return (
            <Modal
                animationType="slide"
                transparent
                visible={activeModal === 'info'}
                onRequestClose={() => this.setState({ activeModal: 'none' })}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={{
                            backgroundColor: isLightTheme()
                                ? '#ffffff'
                                : themeColor('secondary'),
                            borderRadius: 24,
                            padding: 20,
                            alignItems: 'center'
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 20,
                                marginBottom: 20
                            }}
                        >
                            {Platform.OS === 'android'
                                ? localeString(
                                      'views.Tools.nodeConfigExportImport.explainerAndroid'
                                  )
                                : localeString(
                                      'views.Tools.nodeConfigExportImport.explaineriOS'
                                  )}
                        </Text>
                        <Button
                            title={localeString('general.ok')}
                            onPress={() =>
                                this.setState({ activeModal: 'none' })
                            }
                            secondary
                        />
                    </View>
                </View>
            </Modal>
        );
    };

    private renderNodeSelectionModal = () => {
        const { activeModal, selectedNodes } = this.state;
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const nodes = settings.nodes || [];

        const allNodesSelected =
            nodes.length > 0 &&
            selectedNodes.length ===
                nodes.filter(
                    (node) =>
                        node.implementation !== 'embedded-lnd' &&
                        node.implementation !== 'embedded-ldk-node'
                ).length;

        return (
            <Modal
                visible={activeModal === 'nodeSelection'}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    this.setState({
                        selectedNodes: []
                    });
                }}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContent,
                            {
                                maxHeight: '80%',
                                backgroundColor: isLightTheme()
                                    ? '#ffffff'
                                    : themeColor('background')
                            }
                        ]}
                    >
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {nodes.length > 0 && (
                                <CheckBox
                                    title={localeString(
                                        'views.Tools.nodeConfigExportImport.selectAllConfigs'
                                    )}
                                    checked={allNodesSelected}
                                    onPress={() => {
                                        if (allNodesSelected) {
                                            this.setState({
                                                selectedNodes: []
                                            });
                                        } else {
                                            const selectableNodes = nodes
                                                .map((_, index) => index)
                                                .filter(
                                                    (index) =>
                                                        nodes[index]
                                                            .implementation !==
                                                            'embedded-lnd' &&
                                                        nodes[index]
                                                            .implementation !==
                                                            'embedded-ldk-node'
                                                );
                                            this.setState({
                                                selectedNodes: selectableNodes
                                            });
                                        }
                                    }}
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        borderWidth: 0,
                                        marginBottom: 15
                                    }}
                                    textStyle={{
                                        color: themeColor('text'),
                                        fontWeight: 'bold'
                                    }}
                                    checkedColor={themeColor('text')}
                                />
                            )}

                            {nodes.map((node: Node, index: number) => {
                                const isEmbedded =
                                    node.implementation === 'embedded-lnd' ||
                                    node.implementation === 'embedded-ldk-node';
                                const isSelected =
                                    selectedNodes.includes(index);

                                return (
                                    <View key={index} style={styles.nodeItem}>
                                        <CheckBox
                                            title={
                                                <View style={styles.nodeInfo}>
                                                    {node.photo ? (
                                                        <Image
                                                            source={{
                                                                uri: getPhoto(
                                                                    node.photo
                                                                )
                                                            }}
                                                            style={
                                                                styles.nodePhoto
                                                            }
                                                        />
                                                    ) : (
                                                        <NodeIdenticon
                                                            selectedNode={node}
                                                            width={42}
                                                            rounded
                                                        />
                                                    )}
                                                    <View
                                                        style={styles.nodeText}
                                                    >
                                                        <Text
                                                            numberOfLines={1}
                                                            ellipsizeMode="tail"
                                                            style={{
                                                                color: isEmbedded
                                                                    ? themeColor(
                                                                          'secondaryText'
                                                                      )
                                                                    : themeColor(
                                                                          'text'
                                                                      ),
                                                                fontSize: 16
                                                            }}
                                                        >
                                                            {NodeTitle(node)}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            {isEmbedded
                                                                ? `${localeString(
                                                                      'views.Tools.nodeConfigExportImport.notExportable'
                                                                  ).toUpperCase()} - ${getImplementationDisplayName(
                                                                      node.implementation
                                                                  )}`
                                                                : getImplementationDisplayName(
                                                                      node.implementation
                                                                  )}
                                                        </Text>
                                                    </View>
                                                </View>
                                            }
                                            checked={isSelected}
                                            disabled={isEmbedded}
                                            onPress={() => {
                                                if (isEmbedded) return;

                                                this.setState((prevState) => ({
                                                    selectedNodes:
                                                        prevState.selectedNodes.includes(
                                                            index
                                                        )
                                                            ? prevState.selectedNodes.filter(
                                                                  (n) =>
                                                                      n !==
                                                                      index
                                                              )
                                                            : [
                                                                  ...prevState.selectedNodes,
                                                                  index
                                                              ]
                                                }));
                                            }}
                                            iconRight={true}
                                            containerStyle={{
                                                backgroundColor: 'transparent',
                                                borderWidth: 0,
                                                marginBottom: 10,
                                                padding: 0
                                            }}
                                            uncheckedColor={
                                                isEmbedded
                                                    ? themeColor(
                                                          'secondaryText'
                                                      )
                                                    : themeColor('text')
                                            }
                                            checkedColor={themeColor('text')}
                                        />
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.buttonContainer}>
                            <Button
                                title={localeString('general.confirm')}
                                onPress={() => {
                                    this.setState({
                                        activeModal: 'export',
                                        useEncryption: true
                                    });
                                }}
                                disabled={selectedNodes.length === 0}
                                buttonStyle={{ marginBottom: 10 }}
                            />
                            <Button
                                title={localeString('general.close')}
                                onPress={() => {
                                    this.setState({
                                        activeModal: 'none',
                                        selectedNodes: []
                                    });
                                }}
                                secondary
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    private renderExportModal = () => {
        const { activeModal, exportPassword, confirmPassword, useEncryption } =
            this.state;

        return (
            <Modal
                visible={activeModal === 'export'}
                transparent={true}
                animationType="slide"
                onRequestClose={this.resetExportState}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContent,
                            {
                                backgroundColor: isLightTheme()
                                    ? '#ffffff'
                                    : themeColor('background')
                            }
                        ]}
                    >
                        <CheckBox
                            title={localeString('general.encrypt')}
                            checked={useEncryption}
                            onPress={() =>
                                this.setState({ useEncryption: !useEncryption })
                            }
                            containerStyle={{
                                backgroundColor: 'transparent',
                                borderWidth: 0
                            }}
                            textStyle={{
                                color: themeColor('text')
                            }}
                            checkedColor={themeColor('text')}
                        />

                        {useEncryption && (
                            <>
                                <TextInput
                                    placeholder={localeString(
                                        'views.Tools.nodeConfigExportImport.password'
                                    )}
                                    value={exportPassword}
                                    onChangeText={(text: string) =>
                                        this.setState({ exportPassword: text })
                                    }
                                    secureTextEntry
                                />
                                <TextInput
                                    placeholder={localeString(
                                        'views.Tools.nodeConfigExportImport.confirmPassword'
                                    )}
                                    value={confirmPassword}
                                    onChangeText={(text: string) =>
                                        this.setState({ confirmPassword: text })
                                    }
                                    secureTextEntry
                                />
                            </>
                        )}

                        {!useEncryption && (
                            <Text
                                style={{
                                    color: themeColor('error'),
                                    fontWeight: 'bold',
                                    marginBottom: 10
                                }}
                            >
                                {localeString(
                                    'views.Tools.nodeConfigExportImport.unencryptedWarning'
                                )}
                            </Text>
                        )}

                        <View style={styles.buttonContainer}>
                            <Button
                                title={localeString(
                                    'views.Tools.nodeConfigExportImport.exportConfigs'
                                )}
                                onPress={this.executeExport}
                                disabled={
                                    useEncryption &&
                                    (!exportPassword ||
                                        exportPassword !== confirmPassword)
                                }
                                buttonStyle={{ marginBottom: 10 }}
                            />
                            <Button
                                title={localeString('general.close')}
                                onPress={this.resetExportState}
                                secondary
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    private executeExport = async () => {
        const {
            selectedNodes: selectedNodeIndices,
            useEncryption,
            exportPassword
        } = this.state;
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        try {
            this.setState({ activeModal: 'none', isLoading: true });
            const nodes = settings?.nodes || [];
            const selectedNodeConfigs = selectedNodeIndices.map(
                (index) => nodes[index]
            );
            const exportFileContent = createExportFileContent(
                selectedNodeConfigs,
                useEncryption,
                exportPassword
            );

            const timestamp = moment().format('YYYYMMDD-HHmmss');
            const filename = `${timestamp}.zeus-wallet-config-backup`;

            await saveNodeConfigExportFile(filename, exportFileContent);
            this.setState({ isLoading: false });
            Alert.alert(
                localeString('general.success'),
                localeString(
                    'views.Tools.nodeConfigExportImport.exportSuccess'
                ),
                [
                    {
                        text: localeString('general.ok'),
                        onPress: () => this.resetExportState()
                    }
                ]
            );
        } catch (error) {
            this.handleError(
                error,
                'views.Tools.nodeConfigExportImport.exportError'
            );
        }
    };

    private handleImport = async () => {
        try {
            this.setState({ isLoading: true });
            const [result] = await pick({
                type: [types.allFiles]
            });

            const filePath = result.uri;
            if (!filePath) {
                throw new Error('No file selected');
            }

            await this.handleImportFile(filePath);
        } catch (error) {
            if (
                isErrorWithCode(error) &&
                error.code === errorCodes.OPERATION_CANCELED
            ) {
                // not really an error, user just canceled picking a file
                this.setState({ isLoading: false });
            } else {
                this.handleError(
                    error,
                    'views.Tools.nodeConfigExportImport.importError'
                );
            }
        }
    };

    private handleImportFile = async (filePath: string) => {
        try {
            const content = await RNFS.readFile(filePath, 'utf8');
            const importData: NodeConfigExport = JSON.parse(content);

            if (!importData.version || importData.version > 1) {
                this.handleError(
                    undefined,
                    'views.Tools.nodeConfigExportImport.importError'
                );
                return;
            }

            if (importData.encrypted) {
                this.setState({
                    activeModal: 'password',
                    importFilePath: filePath,
                    isLoading: false,
                    importData
                });
            } else {
                // Show node selection modal for unencrypted imports
                const nodes = (importData.data as { nodes: Node[] }).nodes;
                this.setState({
                    isLoading: false,
                    importNodes: nodes,
                    selectedImportNodes: nodes.map((_, i) => i), // Select all by default
                    activeModal: 'importNodeSelection'
                });
            }
        } catch (error) {
            this.handleError(
                error,
                'views.Tools.nodeConfigExportImport.importError'
            );
        }
    };

    private renderPasswordModal = () => {
        const { activeModal, importPassword, importPasswordHidden } =
            this.state;

        return (
            <Modal
                visible={activeModal === 'password'}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContent,
                            {
                                backgroundColor: isLightTheme()
                                    ? '#ffffff'
                                    : themeColor('background')
                            }
                        ]}
                    >
                        <Text style={styles.modalTitle}>
                            {localeString('views.Lockscreen.enterPassword')}
                        </Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder={'****************'}
                                value={importPassword}
                                onChangeText={(text: string) =>
                                    this.setState({ importPassword: text })
                                }
                                autoCapitalize="none"
                                autoCorrect={false}
                                secureTextEntry={importPasswordHidden}
                                style={styles.textInput}
                            />
                            <View style={styles.showHideToggle}>
                                <ShowHideToggle
                                    onPress={() =>
                                        this.setState({
                                            importPasswordHidden:
                                                !importPasswordHidden
                                        })
                                    }
                                />
                            </View>
                        </View>

                        <View style={styles.buttonContainer}>
                            <Button
                                title={localeString('general.proceed')}
                                onPress={() => {
                                    this.handlePasswordSubmit(importPassword);
                                }}
                                disabled={!importPassword}
                                buttonStyle={{ marginBottom: 10 }}
                            />
                            <Button
                                title={localeString('general.close')}
                                onPress={this.resetImportState}
                                secondary
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    private renderImportNodeSelectionModal = () => {
        const { activeModal, importNodes, selectedImportNodes } = this.state;

        const allNodesSelected =
            importNodes.length > 0 &&
            selectedImportNodes.length === importNodes.length;

        return (
            <Modal
                visible={activeModal === 'importNodeSelection'}
                transparent={true}
                animationType="slide"
                onRequestClose={this.resetImportState}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContent,
                            {
                                maxHeight: '80%',
                                backgroundColor: isLightTheme()
                                    ? '#ffffff'
                                    : themeColor('background')
                            }
                        ]}
                    >
                        <Text style={styles.modalTitle}>
                            {localeString(
                                'views.Tools.nodeConfigExportImport.selectConfigsToImport'
                            )}
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {importNodes.length > 1 && (
                                <CheckBox
                                    title={localeString(
                                        'views.Tools.nodeConfigExportImport.selectAllConfigs'
                                    )}
                                    checked={allNodesSelected}
                                    onPress={() => {
                                        if (allNodesSelected) {
                                            this.setState({
                                                selectedImportNodes: []
                                            });
                                        } else {
                                            this.setState({
                                                selectedImportNodes:
                                                    importNodes.map((_, i) => i)
                                            });
                                        }
                                    }}
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        borderWidth: 0,
                                        marginBottom: 15
                                    }}
                                    textStyle={{
                                        color: themeColor('text'),
                                        fontWeight: 'bold'
                                    }}
                                    checkedColor={themeColor('text')}
                                />
                            )}

                            {importNodes.map((node: Node, index: number) => {
                                const isSelected =
                                    selectedImportNodes.includes(index);

                                return (
                                    <View key={index} style={styles.nodeItem}>
                                        <CheckBox
                                            title={
                                                <View style={styles.nodeInfo}>
                                                    <NodeIdenticon
                                                        selectedNode={node}
                                                        width={42}
                                                        rounded
                                                    />
                                                    <View
                                                        style={styles.nodeText}
                                                    >
                                                        <Text
                                                            numberOfLines={1}
                                                            ellipsizeMode="tail"
                                                            style={{
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                fontSize: 16
                                                            }}
                                                        >
                                                            {NodeTitle(node)}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            {getImplementationDisplayName(
                                                                node.implementation
                                                            )}
                                                        </Text>
                                                    </View>
                                                </View>
                                            }
                                            checked={isSelected}
                                            onPress={() => {
                                                this.setState((prevState) => ({
                                                    selectedImportNodes:
                                                        prevState.selectedImportNodes.includes(
                                                            index
                                                        )
                                                            ? prevState.selectedImportNodes.filter(
                                                                  (n) =>
                                                                      n !==
                                                                      index
                                                              )
                                                            : [
                                                                  ...prevState.selectedImportNodes,
                                                                  index
                                                              ]
                                                }));
                                            }}
                                            iconRight={true}
                                            containerStyle={{
                                                backgroundColor: 'transparent',
                                                borderWidth: 0,
                                                marginBottom: 10,
                                                padding: 0
                                            }}
                                            uncheckedColor={themeColor('text')}
                                            checkedColor={themeColor('text')}
                                        />
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.buttonContainer}>
                            <Button
                                title={localeString(
                                    'views.Tools.nodeConfigExportImport.importSelected'
                                )}
                                onPress={this.executeImport}
                                disabled={selectedImportNodes.length === 0}
                                buttonStyle={{ marginBottom: 10 }}
                            />
                            <Button
                                title={localeString('general.close')}
                                onPress={this.resetImportState}
                                secondary
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    private handlePasswordSubmit = async (password: string) => {
        const { importData } = this.state;

        try {
            this.setState({ isLoading: true });

            const nodes = decryptExportData(
                importData!.data as string,
                password
            );

            // Show node selection modal for encrypted imports
            this.setState({
                isLoading: false,
                importNodes: nodes,
                selectedImportNodes: nodes.map((_, i) => i), // Select all by default
                activeModal: 'importNodeSelection'
            });
        } catch (error) {
            this.setState({ activeModal: 'password', isLoading: false });
            this.handleError(error, 'views.Lockscreen.incorrectPassword');
        }
    };

    private executeImport = async () => {
        const { importNodes, selectedImportNodes } = this.state;

        try {
            this.setState({ isLoading: true, activeModal: 'none' });

            // Only import selected nodes
            const nodesToImport = selectedImportNodes.map(
                (index) => importNodes[index]
            );

            await saveNodeConfigs(nodesToImport, this.props.SettingsStore);
            this.setState({ isLoading: false });

            Alert.alert(
                localeString('general.success'),
                localeString(
                    'views.Tools.nodeConfigExportImport.importSuccess'
                ),
                [
                    {
                        text: localeString('general.ok'),
                        onPress: () => {
                            this.resetImportState();
                            this.props.navigation.navigate('Wallets');
                        }
                    }
                ]
            );
        } catch (error) {
            this.handleError(
                error,
                'views.Tools.nodeConfigExportImport.importError'
            );
        }
    };

    private handleError = (error: any, errorMessageKey: string) => {
        this.setState({ isLoading: false });
        console.error(localeString(errorMessageKey), error);
        Alert.alert(
            localeString('general.error'),
            localeString(errorMessageKey)
        );
    };

    // Recovery methods
    private handleRecoveryScan = async () => {
        this.setState({
            activeModal: 'recovery',
            isScanning: true,
            scanResult: null
        });

        try {
            const result = await KeychainRecoveryUtils.scanForRecoverableData();
            this.setState({ scanResult: result, isScanning: false });
        } catch (error) {
            console.error('Recovery scan failed:', error);
            this.setState({ isScanning: false });
            Alert.alert(
                localeString('general.error'),
                localeString(
                    'views.Tools.nodeConfigExportImport.recovery.scanError'
                )
            );
        }
    };

    private handleRecoveryPreview = (result: RecoveryResult) => {
        // Parse the nodes from the recovery data
        try {
            const settings = JSON.parse(result.data);
            const nodes = settings.nodes || [];
            this.setState({
                selectedRecoveryResult: result,
                recoveryNodes: nodes,
                selectedRecoveryNodes: nodes.map((_: any, i: number) => i), // Select all by default
                activeModal: 'recoveryNodeSelection'
            });
        } catch (e) {
            console.error('Failed to parse recovery data:', e);
            Alert.alert(
                localeString('general.error'),
                localeString(
                    'views.Tools.nodeConfigExportImport.recovery.parseError'
                )
            );
        }
    };

    private handleRecoveryRestore = async () => {
        const { recoveryNodes, selectedRecoveryNodes } = this.state;

        this.setState({ isLoading: true, activeModal: 'none' });

        try {
            // Get only the selected nodes
            const selectedNodes = selectedRecoveryNodes.map(
                (index) => recoveryNodes[index]
            );

            // Use saveNodeConfigs to append to existing nodes (same as import flow)
            await saveNodeConfigs(selectedNodes, this.props.SettingsStore);

            this.setState({ isLoading: false });

            Alert.alert(
                localeString('general.success'),
                localeString(
                    'views.Tools.nodeConfigExportImport.recovery.restoreSuccess'
                ).replace('{count}', String(selectedNodes.length)),
                [
                    {
                        text: localeString('general.ok'),
                        onPress: () => {
                            this.resetRecoveryState();
                            this.props.navigation.navigate('Wallets');
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Recovery restore failed:', error);
            this.setState({ isLoading: false });
            Alert.alert(
                localeString('general.error'),
                localeString(
                    'views.Tools.nodeConfigExportImport.recovery.restoreError'
                )
            );
        }
    };

    private resetRecoveryState = () => {
        this.setState({
            activeModal: 'none',
            scanResult: null,
            selectedRecoveryResult: null,
            isScanning: false,
            recoveryNodes: [],
            selectedRecoveryNodes: []
        });
    };

    // DEV-only methods for testing recovery
    private handleDevCopyToLegacy = async () => {
        this.setState({ isLoading: true });

        try {
            const result = await KeychainRecoveryUtils.copyToLegacyLocations();

            this.setState({ isLoading: false });

            if (result.success) {
                Alert.alert(
                    'DEV: Copy Complete',
                    `Copied current settings to ${
                        result.locations.length
                    } legacy location(s):\n\n${result.locations.join('\n')}`
                );
            } else {
                Alert.alert(
                    'DEV: Copy Failed',
                    result.error || 'Unknown error'
                );
            }
        } catch (error) {
            this.setState({ isLoading: false });
            Alert.alert('DEV: Copy Failed', String(error));
        }
    };

    private handleDevClearLegacy = async () => {
        Alert.alert(
            'DEV: Clear Legacy Locations',
            'This will clear all legacy storage locations. Current settings will NOT be affected.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        this.setState({ isLoading: true });

                        try {
                            const result =
                                await KeychainRecoveryUtils.clearLegacyLocations();

                            this.setState({ isLoading: false });

                            if (result.success) {
                                Alert.alert(
                                    'DEV: Clear Complete',
                                    `Cleared ${
                                        result.cleared.length
                                    } legacy location(s):\n\n${result.cleared.join(
                                        '\n'
                                    )}`
                                );
                            } else {
                                Alert.alert(
                                    'DEV: Clear Failed',
                                    result.error || 'Unknown error'
                                );
                            }
                        } catch (error) {
                            this.setState({ isLoading: false });
                            Alert.alert('DEV: Clear Failed', String(error));
                        }
                    }
                }
            ]
        );
    };

    private renderRecoveryModal = () => {
        const { activeModal, isScanning, scanResult } = this.state;

        const recoverableSettings =
            scanResult?.settingsFound.filter((r) => r.source !== 'current') ||
            [];
        const hasRecoverableData = recoverableSettings.length > 0;

        return (
            <Modal
                animationType="slide"
                transparent
                visible={activeModal === 'recovery'}
                onRequestClose={this.resetRecoveryState}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContent,
                            {
                                backgroundColor: isLightTheme()
                                    ? '#ffffff'
                                    : themeColor('background'),
                                maxHeight: '85%'
                            }
                        ]}
                    >
                        <Text style={styles.modalTitle}>
                            {localeString(
                                'views.Tools.nodeConfigExportImport.recovery.title'
                            )}
                        </Text>

                        {isScanning ? (
                            <View style={styles.scanningContainer}>
                                <LoadingIndicator />
                                <Text style={{ marginTop: 15 }}>
                                    {localeString(
                                        'views.Tools.nodeConfigExportImport.recovery.scanning'
                                    )}
                                </Text>
                            </View>
                        ) : (
                            <ScrollView
                                style={{ maxHeight: 400 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {Platform.OS === 'ios' && (
                                    <View style={styles.warningBanner}>
                                        <Icon
                                            name="alert-circle"
                                            type="feather"
                                            color={themeColor('warning')}
                                            size={18}
                                        />
                                        <Text style={styles.warningBannerText}>
                                            {localeString(
                                                'views.Tools.nodeConfigExportImport.recovery.iOSWarning'
                                            )}
                                        </Text>
                                    </View>
                                )}

                                {hasRecoverableData ? (
                                    <>
                                        <Text style={styles.recoverySubtitle}>
                                            {localeString(
                                                'views.Tools.nodeConfigExportImport.recovery.foundData'
                                            )}
                                        </Text>
                                        {recoverableSettings.map(
                                            (result, index) =>
                                                this.renderRecoveryItem(
                                                    result,
                                                    index
                                                )
                                        )}
                                    </>
                                ) : scanResult ? (
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyStateText}>
                                            {localeString(
                                                'views.Tools.nodeConfigExportImport.recovery.noDataFound'
                                            )}
                                        </Text>
                                        <Text style={styles.emptyStateSubtext}>
                                            {localeString(
                                                'views.Tools.nodeConfigExportImport.recovery.noDataFoundDesc'
                                            )}
                                        </Text>
                                    </View>
                                ) : null}
                            </ScrollView>
                        )}

                        <View style={styles.buttonContainer}>
                            {!isScanning && scanResult && (
                                <Button
                                    title={localeString(
                                        'views.Tools.nodeConfigExportImport.recovery.rescan'
                                    )}
                                    onPress={() => this.handleRecoveryScan()}
                                    secondary
                                    buttonStyle={{ marginBottom: 10 }}
                                />
                            )}
                            <Button
                                title={localeString('general.close')}
                                onPress={this.resetRecoveryState}
                                secondary
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    private renderRecoveryItem = (result: RecoveryResult, index: number) => {
        const sourceName = KeychainRecoveryUtils.getSourceDisplayName(
            result.source
        );
        const preview = KeychainRecoveryUtils.parseSettingsPreview(result.data);

        return (
            <TouchableOpacity
                key={`${result.key}-${result.source}-${index}`}
                style={[
                    styles.recoveryItem,
                    { backgroundColor: themeColor('secondary') }
                ]}
                onPress={() => this.handleRecoveryPreview(result)}
            >
                <View style={styles.recoveryItemHeader}>
                    <Icon
                        name="database"
                        type="feather"
                        color={themeColor('warning')}
                        size={20}
                    />
                    <Text style={styles.recoveryItemTitle}>
                        {result.description}
                    </Text>
                </View>
                <Text style={styles.recoveryItemSource}>{sourceName}</Text>
                {preview && (
                    <Text style={styles.recoveryItemPreview}>
                        {`${preview.nodeCount} ${
                            preview.nodeCount === 1
                                ? localeString('general.wallet')
                                : localeString('general.wallets')
                        }`}
                    </Text>
                )}
                <Text style={styles.tapToRestore}>
                    {localeString(
                        'views.Tools.nodeConfigExportImport.recovery.tapToRestore'
                    )}
                </Text>
            </TouchableOpacity>
        );
    };

    private renderRecoveryNodeSelectionModal = () => {
        const {
            activeModal,
            selectedRecoveryResult,
            recoveryNodes,
            selectedRecoveryNodes
        } = this.state;

        if (!selectedRecoveryResult) return null;

        const sourceName = KeychainRecoveryUtils.getSourceDisplayName(
            selectedRecoveryResult.source
        );

        const allNodesSelected =
            recoveryNodes.length > 0 &&
            selectedRecoveryNodes.length === recoveryNodes.length;

        return (
            <Modal
                animationType="slide"
                transparent
                visible={activeModal === 'recoveryNodeSelection'}
                onRequestClose={() =>
                    this.setState({ activeModal: 'recovery' })
                }
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContent,
                            {
                                maxHeight: '80%',
                                backgroundColor: isLightTheme()
                                    ? '#ffffff'
                                    : themeColor('background')
                            }
                        ]}
                    >
                        <Text style={styles.modalTitle}>
                            {localeString(
                                'views.Tools.nodeConfigExportImport.recovery.selectConfigsToRestore'
                            )}
                        </Text>

                        <View style={styles.previewSection}>
                            <Text style={styles.previewLabel}>
                                {localeString(
                                    'views.Tools.nodeConfigExportImport.recovery.source'
                                )}
                            </Text>
                            <Text style={styles.previewValue}>
                                {sourceName}
                            </Text>
                        </View>

                        <ScrollView
                            style={{ maxHeight: 300 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {recoveryNodes.length > 1 && (
                                <CheckBox
                                    title={localeString(
                                        'views.Tools.nodeConfigExportImport.selectAllConfigs'
                                    )}
                                    checked={allNodesSelected}
                                    onPress={() => {
                                        if (allNodesSelected) {
                                            this.setState({
                                                selectedRecoveryNodes: []
                                            });
                                        } else {
                                            this.setState({
                                                selectedRecoveryNodes:
                                                    recoveryNodes.map(
                                                        (_, i) => i
                                                    )
                                            });
                                        }
                                    }}
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        borderWidth: 0,
                                        marginBottom: 15
                                    }}
                                    textStyle={{
                                        color: themeColor('text'),
                                        fontWeight: 'bold'
                                    }}
                                    checkedColor={themeColor('text')}
                                />
                            )}

                            {recoveryNodes.map((node: Node, index: number) => {
                                const isSelected =
                                    selectedRecoveryNodes.includes(index);

                                return (
                                    <View key={index} style={styles.nodeItem}>
                                        <CheckBox
                                            title={
                                                <View style={styles.nodeInfo}>
                                                    <NodeIdenticon
                                                        selectedNode={node}
                                                        width={42}
                                                        rounded
                                                    />
                                                    <View
                                                        style={styles.nodeText}
                                                    >
                                                        <Text
                                                            numberOfLines={1}
                                                            ellipsizeMode="tail"
                                                            style={{
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                fontSize: 16
                                                            }}
                                                        >
                                                            {NodeTitle(node)}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            {getImplementationDisplayName(
                                                                node.implementation
                                                            )}
                                                        </Text>
                                                    </View>
                                                </View>
                                            }
                                            checked={isSelected}
                                            onPress={() => {
                                                this.setState((prevState) => ({
                                                    selectedRecoveryNodes:
                                                        prevState.selectedRecoveryNodes.includes(
                                                            index
                                                        )
                                                            ? prevState.selectedRecoveryNodes.filter(
                                                                  (n) =>
                                                                      n !==
                                                                      index
                                                              )
                                                            : [
                                                                  ...prevState.selectedRecoveryNodes,
                                                                  index
                                                              ]
                                                }));
                                            }}
                                            iconRight={true}
                                            containerStyle={{
                                                backgroundColor: 'transparent',
                                                borderWidth: 0,
                                                marginBottom: 10,
                                                padding: 0
                                            }}
                                            uncheckedColor={themeColor('text')}
                                            checkedColor={themeColor('text')}
                                        />
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.buttonContainer}>
                            <Button
                                title={localeString(
                                    'views.Tools.nodeConfigExportImport.recovery.restoreSelected'
                                )}
                                onPress={this.handleRecoveryRestore}
                                disabled={selectedRecoveryNodes.length === 0}
                                buttonStyle={{ marginBottom: 10 }}
                            />
                            <Button
                                title={localeString('general.goBack')}
                                onPress={() =>
                                    this.setState({ activeModal: 'recovery' })
                                }
                                secondary
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    render() {
        const { isLoading } = this.state;

        return (
            <ScrollView showsVerticalScrollIndicator={false}>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Tools.nodeConfigExportImport.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <TouchableOpacity
                            style={{ marginRight: 4, marginTop: -4 }}
                            onPress={() =>
                                this.setState({ activeModal: 'info' })
                            }
                        >
                            <Text style={{ fontSize: 24 }}>ⓘ</Text>
                        </TouchableOpacity>
                    }
                    navigation={this.props.navigation}
                />
                {this.renderNodeSelectionModal()}
                {this.renderExportModal()}
                {this.renderInfoModal()}
                {this.renderPasswordModal()}
                {this.renderImportNodeSelectionModal()}
                {this.renderRecoveryModal()}
                {this.renderRecoveryNodeSelectionModal()}

                <View style={styles.container}>
                    {isLoading ? (
                        <LoadingIndicator />
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[
                                    styles.optionButton,
                                    { backgroundColor: themeColor('secondary') }
                                ]}
                                onPress={() =>
                                    this.setState({
                                        activeModal: 'nodeSelection'
                                    })
                                }
                            >
                                <Feather
                                    name="upload"
                                    size={24}
                                    color={themeColor('text')}
                                />
                                <Text style={styles.optionText}>
                                    {localeString(
                                        'views.Tools.nodeConfigExportImport.exportConfigs'
                                    )}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.optionButton,
                                    { backgroundColor: themeColor('secondary') }
                                ]}
                                onPress={this.handleImport}
                            >
                                <Feather
                                    name="download"
                                    size={24}
                                    color={themeColor('text')}
                                />
                                <Text style={styles.optionText}>
                                    {localeString(
                                        'views.Tools.nodeConfigExportImport.importConfigs'
                                    )}
                                </Text>
                            </TouchableOpacity>

                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={[
                                        styles.optionButton,
                                        {
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderLeftWidth: 4,
                                            borderLeftColor:
                                                themeColor('warning')
                                        }
                                    ]}
                                    onPress={this.handleRecoveryScan}
                                >
                                    <Feather
                                        name="refresh-cw"
                                        size={24}
                                        color={themeColor('warning')}
                                    />
                                    <Text
                                        style={{
                                            ...styles.optionText,
                                            color: themeColor('warning')
                                        }}
                                    >
                                        {localeString(
                                            'views.Tools.nodeConfigExportImport.recovery.restoreLegacy'
                                        )}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {__DEV__ && (
                                <>
                                    <TouchableOpacity
                                        style={[
                                            styles.optionButton,
                                            {
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderLeftWidth: 4,
                                                borderLeftColor: '#9C27B0'
                                            }
                                        ]}
                                        onPress={this.handleDevCopyToLegacy}
                                    >
                                        <Feather
                                            name="copy"
                                            size={24}
                                            color="#9C27B0"
                                        />
                                        <Text
                                            style={{
                                                ...styles.optionText,
                                                color: '#9C27B0'
                                            }}
                                        >
                                            DEV: Copy to legacy locations
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.optionButton,
                                            {
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderLeftWidth: 4,
                                                borderLeftColor:
                                                    themeColor('error')
                                            }
                                        ]}
                                        onPress={this.handleDevClearLegacy}
                                    >
                                        <Feather
                                            name="trash-2"
                                            size={24}
                                            color={themeColor('error')}
                                        />
                                        <Text
                                            style={{
                                                ...styles.optionText,
                                                color: themeColor('error')
                                            }}
                                        >
                                            DEV: Clear legacy locations
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginVertical: 10,
        borderRadius: 10
    },
    optionText: {
        marginLeft: 15,
        fontSize: 16
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        width: '85%',
        padding: 20,
        borderRadius: 10
    },
    modalTitle: {
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold'
    },
    buttonContainer: {
        width: '100%',
        marginTop: 20
    },
    nodeItem: {
        marginBottom: 10
    },
    nodeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    nodePhoto: {
        width: 42,
        height: 42,
        borderRadius: 21
    },
    nodeText: {
        marginLeft: 10,
        flex: 1
    },
    inputContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10
    },
    textInput: {
        flex: 1
    },
    showHideToggle: {
        alignSelf: 'center',
        marginLeft: 10
    },
    // Recovery styles
    scanningContainer: {
        alignItems: 'center',
        paddingVertical: 40
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15
    },
    warningBannerText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 13,
        lineHeight: 18
    },
    recoverySubtitle: {
        fontSize: 14,
        opacity: 0.7,
        marginBottom: 15
    },
    recoveryItem: {
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#FFC107'
    },
    recoveryItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    recoveryItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10
    },
    recoveryItemSource: {
        fontSize: 13,
        opacity: 0.7,
        marginLeft: 30
    },
    recoveryItemPreview: {
        fontSize: 14,
        marginTop: 5,
        marginLeft: 30
    },
    tapToRestore: {
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 8,
        opacity: 0.6
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 15,
        textAlign: 'center'
    },
    emptyStateSubtext: {
        fontSize: 13,
        opacity: 0.7,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 10
    },
    previewSection: {
        marginBottom: 15
    },
    previewLabel: {
        fontSize: 13,
        opacity: 0.7,
        marginBottom: 3
    },
    previewValue: {
        fontSize: 16
    }
});
