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
import Icon from 'react-native-vector-icons/Feather';
import { inject, observer } from 'mobx-react';
import { CheckBox } from 'react-native-elements';
import { StackNavigationProp } from '@react-navigation/stack';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';

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

import SettingsStore, { Node } from '../../stores/SettingsStore';
import moment from 'moment';

interface NodeConfigExportImportProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface NodeConfigExportImportState {
    isLoading: boolean;
    activeModal: 'none' | 'nodeSelection' | 'export' | 'info' | 'password';
    selectedNodes: Array<number>;
    exportPassword: string;
    confirmPassword: string;
    useEncryption: boolean;
    importFilePath: string | null;
    importPassword: string;
    importPasswordHidden: boolean;
    importData?: NodeConfigExport;
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
        importPasswordHidden: true
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
            importPasswordHidden: true
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
                nodes.filter((node) => node.implementation !== 'embedded-lnd')
                    .length;

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
                        <ScrollView>
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
                                                        'embedded-lnd'
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
                                    node.implementation === 'embedded-lnd';
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
                                                            {NodeTitle(
                                                                node,
                                                                32
                                                            )}
                                                        </Text>
                                                        {isEmbedded && (
                                                            <Text
                                                                style={{
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    ),
                                                                    fontSize: 12
                                                                }}
                                                            >
                                                                {localeString(
                                                                    'views.Tools.nodeConfigExportImport.notExportable'
                                                                )}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                            }
                                            checked={isSelected}
                                            disabled={isEmbedded}
                                            onPress={() => {
                                                if (isEmbedded) return;

                                                const newSelectedNodes =
                                                    isSelected
                                                        ? selectedNodes.filter(
                                                              (n) => n !== index
                                                          )
                                                        : [
                                                              ...selectedNodes,
                                                              index
                                                          ];

                                                this.setState({
                                                    selectedNodes:
                                                        newSelectedNodes
                                                });
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
            const result = await DocumentPicker.pick({
                type: [DocumentPicker.types.allFiles],
                copyTo: 'cachesDirectory'
            });

            const filePath = result[0].fileCopyUri;
            if (!filePath) {
                throw new Error('No file selected');
            }

            await this.handleImportFile(filePath);
        } catch (error) {
            if (DocumentPicker.isCancel(error)) {
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
                await this.executeImport(importData);
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

    private handlePasswordSubmit = async (password: string) => {
        const { importData } = this.state;

        try {
            this.setState({ activeModal: 'none', isLoading: true });

            const nodes = decryptExportData(
                importData!.data as string,
                password
            );
            await this.executeImport({
                ...importData!,
                data: { nodes }
            });

            this.resetImportState();
            this.setState({ isLoading: false });
        } catch (error) {
            this.setState({ activeModal: 'password' });
            this.handleError(error, 'views.Lockscreen.incorrectPassword');
        }
    };

    private executeImport = async (importData: NodeConfigExport) => {
        try {
            if (!importData.version || importData.version > 1) {
                throw new Error('Unsupported export version');
            }

            if (typeof importData.data === 'string') {
                throw new Error('Cannot import encrypted data directly');
            }
            const nodes = importData.data.nodes;

            await saveNodeConfigs(nodes, this.props.SettingsStore);
            this.setState({ isLoading: false });

            Alert.alert(
                localeString('general.success'),
                localeString(
                    'views.Tools.nodeConfigExportImport.importSuccess'
                ),
                [
                    {
                        text: localeString('general.ok'),
                        onPress: () => this.props.navigation.navigate('Wallets')
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

    render() {
        const { isLoading } = this.state;

        return (
            <ScrollView>
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
                                <Icon
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
                                <Icon
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
        width: '80%',
        padding: 20,
        borderRadius: 10
    },
    modalTitle: {
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center'
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
    }
});
