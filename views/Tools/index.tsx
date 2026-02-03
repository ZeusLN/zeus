import * as React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import RNRestart from 'react-native-restart';

import AccountIcon from '../../assets/images/SVG/Account.svg';
import CashuIcon from '../../assets/images/SVG/Ecash.svg';
import CurrencyIcon from '../../assets/images/SVG/Bitcoin.svg';
import ForwardIcon from '../../assets/images/SVG/Caret Right-3.svg';
import SignIcon from '../../assets/images/SVG/Pen.svg';
import SpeedometerIcon from '../../assets/images/SVG/Speedometer.svg';
import SweepIcon from '../../assets/images/SVG/Sweep.svg';
import RebalanceIcon from '../../assets/images/SVG/RebalanceIcon.svg';
import ExportImportIcon from '../../assets/images/SVG/ExportImport.svg';
import WatchtowerIcon from '../../assets/images/SVG/Watchtower.svg';
import NWCIcon from '../../assets/images/SVG/nwc-logo.svg';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import LoadingIndicator from '../../components/LoadingIndicator';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { clearAllData } from '../../utils/DataClearUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { exportChannelDb } from '../../utils/ChannelMigrationUtils';

import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import { Icon } from '@rneui/themed';
import Feather from '@react-native-vector-icons/feather';

interface ToolsProps {
    navigation: StackNavigationProp<any, any>;
    route: RouteProp<{ Tools: { showClearDataModal?: boolean } }, 'Tools'>;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
}

interface ToolsState {
    isLoading: boolean;
}

@inject('SettingsStore', 'NodeInfoStore')
@observer
export default class Tools extends React.Component<ToolsProps, ToolsState> {
    focusListener: any = null;

    constructor(props: ToolsProps) {
        super(props);
        this.state = {
            isLoading: false
        };
    }

    componentDidMount() {
        const { navigation, route } = this.props;

        this.focusListener = navigation.addListener('focus', this.handleFocus);

        // Auto-show clear data modal if navigated with showClearDataModal param
        if (route.params?.showClearDataModal) {
            this.handleClearStorage();
        }
    }

    componentWillUnmount() {
        if (this.focusListener) {
            this.focusListener();
        }
    }

    handleFocus = () => this.props.SettingsStore.getSettings();

    handleClearStorage = () => {
        Alert.alert(
            localeString('views.Tools.clearStorage.title'),
            localeString('views.Tools.clearStorage.message'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('views.Tools.clearStorage.confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllData();
                            RNRestart.Restart();
                        } catch (error) {
                            console.error('Failed to clear storage:', error);
                            Alert.alert(
                                localeString('general.error'),
                                localeString('views.Tools.clearStorage.error')
                            );
                        }
                    }
                }
            ]
        );
    };

    handleExportChannels = () => {
        Alert.alert(
            localeString('views.Tools.migration.export.title'),

            `${localeString('views.Tools.migration.export.text1')}\n\n` +
                `⚠️ ${localeString('views.Tools.migration.export.text2')}`,
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('views.Tools.migration.export.confirm'),
                    style: 'default',
                    onPress: async () => {
                        const { SettingsStore, NodeInfoStore } = this.props;
                        const { isSqlite }: any = SettingsStore;
                        const isTestnet = NodeInfoStore!.nodeInfo.isTestNet;
                        const lndDir = () =>
                            this.props.SettingsStore.lndDir || 'lnd';

                        await exportChannelDb(
                            lndDir(),
                            isTestnet,
                            isSqlite,
                            (loading) => this.setState({ isLoading: loading })
                        );
                    }
                }
            ]
        );
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;

        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const forwardArrowColor = themeColor('secondaryText');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Tools.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        this.state.isLoading ? (
                            <LoadingIndicator size={34} />
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1,
                        marginTop: 10
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {BackendUtils.supportsAccounts() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Accounts')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <AccountIcon
                                            fill={themeColor('text')}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Accounts.title')}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                    {selectedNode &&
                        BackendUtils.supportsNostrWalletConnectService() && (
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    marginVertical: 5
                                }}
                            >
                                <TouchableOpacity
                                    style={styles.columnField}
                                    onPress={() =>
                                        navigation.navigate(
                                            'NostrWalletConnect'
                                        )
                                    }
                                >
                                    <View style={styles.icon}>
                                        <NWCIcon
                                            fill={themeColor('text')}
                                            width={23}
                                            height={23}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.title'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                    {selectedNode && BackendUtils.supportsWatchtowerClient() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('Watchtowers')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <WatchtowerIcon
                                            fill={themeColor('text')}
                                            width={23}
                                            height={23}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Tools.watchtowers'
                                        )}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode && BackendUtils.isLNDBased() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() => navigation.navigate('BumpFee')}
                            >
                                <View style={styles.icon}>
                                    <SpeedometerIcon
                                        fill={themeColor('text')}
                                        width={23}
                                        height={23}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.BumpFee.title')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode && BackendUtils.supportsMessageSigning() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('SignVerifyMessage')
                                }
                            >
                                <View style={styles.icon}>
                                    <SignIcon
                                        fill={themeColor('text')}
                                        width={18}
                                        height={18}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.SignMessage.title'
                                    )}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() =>
                                navigation.navigate('CurrencyConverter')
                            }
                        >
                            <View style={styles.icon}>
                                <CurrencyIcon
                                    fill={themeColor('text')}
                                    width={18}
                                    height={18}
                                />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Settings.CurrencyConverter.title'
                                )}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {selectedNode && BackendUtils.supportsChannelManagement() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Rebalance')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <RebalanceIcon
                                            fill={themeColor('text')}
                                            width={18}
                                            height={18}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Rebalance.title')}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {BackendUtils.supportsSweep() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Sweep')}
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <SweepIcon
                                            fill={themeColor('text')}
                                            width={18}
                                            height={18}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Sweep.title')}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode && BackendUtils.supportsOnchainSends() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('WIFSweeper')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <Icon
                                            name="key-plus"
                                            type="material-design"
                                            color={themeColor('text')}
                                            size={25}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Wif.title')}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedNode && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate('ActivityExport')
                                }
                            >
                                <View style={styles.icon}>
                                    <Icon
                                        name="upload"
                                        type="feather"
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={18}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('views.ActivityExport.title')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {BackendUtils.supportsCashuWallet() &&
                        settings?.ecash?.enableCashu && (
                            <View
                                style={{
                                    backgroundColor: themeColor('secondary'),
                                    width: '90%',
                                    borderRadius: 10,
                                    alignSelf: 'center',
                                    marginVertical: 5
                                }}
                            >
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate('CashuTools')
                                    }
                                >
                                    <View style={styles.columnField}>
                                        <View style={styles.icon}>
                                            <CashuIcon
                                                fill={themeColor('text')}
                                                width={20}
                                                height={20}
                                            />
                                        </View>
                                        <Text
                                            style={{
                                                ...styles.columnText,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString('views.Tools.cashu')}
                                        </Text>
                                        <View style={styles.ForwardArrow}>
                                            <ForwardIcon
                                                stroke={forwardArrowColor}
                                            />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() =>
                                navigation.navigate('NodeConfigExportImport')
                            }
                        >
                            <View style={styles.icon}>
                                <ExportImportIcon
                                    stroke={themeColor('text')}
                                    width={18}
                                    height={18}
                                />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Tools.nodeConfigExportImport.title'
                                )}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>
                    </View>
                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity
                            style={styles.columnField}
                            onPress={() => this.handleExportChannels()}
                        >
                            <View style={styles.icon}>
                                <Feather
                                    name="upload"
                                    size={24}
                                    color={themeColor('text')}
                                />
                            </View>
                            <Text
                                style={{
                                    ...styles.columnText,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Tools.migration.export')}
                            </Text>
                            <View style={styles.ForwardArrow}>
                                <ForwardIcon stroke={forwardArrowColor} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {BackendUtils.supportsWithdrawalRequests() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                style={styles.columnField}
                                onPress={() =>
                                    navigation.navigate(
                                        'CreateWithdrawalRequest'
                                    )
                                }
                            >
                                <View style={styles.icon}>
                                    <Icon
                                        name="edit"
                                        type="feather"
                                        color={themeColor('text')}
                                        underlayColor="transparent"
                                        size={18}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('text')
                                    }}
                                >
                                    {localeString('general.withdrawalRequest')}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {BackendUtils.supportsDevTools() && (
                        <View
                            style={{
                                backgroundColor: themeColor('secondary'),
                                width: '90%',
                                borderRadius: 10,
                                alignSelf: 'center',
                                marginVertical: 5
                            }}
                        >
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('DeveloperTools')
                                }
                            >
                                <View style={styles.columnField}>
                                    <View style={styles.icon}>
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontSize: 14,
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {'</>'}
                                        </Text>
                                    </View>
                                    <Text
                                        style={{
                                            ...styles.columnText,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Tools.developers')}
                                    </Text>
                                    <View style={styles.ForwardArrow}>
                                        <ForwardIcon
                                            stroke={forwardArrowColor}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View
                        style={{
                            backgroundColor: themeColor('secondary'),
                            width: '90%',
                            borderRadius: 10,
                            alignSelf: 'center',
                            marginVertical: 5
                        }}
                    >
                        <TouchableOpacity onPress={this.handleClearStorage}>
                            <View style={styles.columnField}>
                                <View style={styles.icon}>
                                    <Icon
                                        name="trash-2"
                                        type="feather"
                                        color={themeColor('warning')}
                                        size={20}
                                    />
                                </View>
                                <Text
                                    style={{
                                        ...styles.columnText,
                                        color: themeColor('warning')
                                    }}
                                >
                                    {localeString(
                                        'views.Tools.clearStorage.title'
                                    )}
                                </Text>
                                <View style={styles.ForwardArrow}>
                                    <ForwardIcon stroke={forwardArrowColor} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    columnField: {
        flex: 1,
        flexDirection: 'row',
        marginVertical: 8,
        alignItems: 'center'
    },
    icon: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center'
    },
    photo: {
        alignSelf: 'center',
        width: 60,
        height: 60,
        borderRadius: 68
    },
    columnText: {
        fontSize: 16,
        flex: 1,
        fontFamily: 'PPNeueMontreal-Book'
    },
    separationLine: {
        borderColor: '#A7A9AC',
        opacity: 0.2,
        borderWidth: 0.5,
        marginLeft: 50,
        marginRight: 40
    },
    ForwardArrow: {
        alignItems: 'flex-end',
        padding: 6,
        marginRight: 6
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    picker: {
        width: 100
    },
    pickerDark: {
        width: 100,
        color: 'white'
    },
    button: {
        paddingTop: 10
    },
    lurkerField: {
        paddingTop: 15,
        paddingLeft: 10
    }
});
