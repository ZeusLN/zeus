import React from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Text,
    ScrollView
} from 'react-native';
import { Divider, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';

import LoadingIndicator from '../../../components/LoadingIndicator';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';

import SettingsStore from '../../../stores/SettingsStore';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

import NWCConnection from '../../../models/NWCConnection';

import Add from '../../../assets/images/SVG/Add.svg';

import Nostrich from '../../../assets/images/SVG/Nostrich.svg';
import Clock from '../../../assets/images/SVG/Clock.svg';
import Checkmark from '../../../assets/images/SVG/Checkmark.svg';

interface NostrWalletConnectProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface NostrWalletConnectState {
    searchQuery: string;
    connectionsLoading: boolean;
    error: string;
}

@inject('SettingsStore', 'NostrWalletConnectStore')
@observer
export default class NostrWalletConnect extends React.Component<
    NostrWalletConnectProps,
    NostrWalletConnectState
> {
    constructor(props: NostrWalletConnectProps) {
        super(props);
        this.state = {
            searchQuery: '',
            connectionsLoading: false,
            error: ''
        };
    }

    async componentDidMount() {
        this.props.navigation.addListener('focus', this.handleFocus);
        await this.loadSettings();
        await this.props.NostrWalletConnectStore.initializeService();
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.handleFocus);
    }

    loadSettings = async () => {
        try {
            this.setState({
                connectionsLoading: false,
                error: ''
            });
        } catch (error: any) {
            this.setState({
                error: localeString(
                    'views.Settings.NostrWalletConnect.failedToLoadConnections'
                ),
                connectionsLoading: false
            });
        }
    };

    handleFocus = async () => {
        await this.loadSettings();
        await this.props.NostrWalletConnectStore.initializeService();
    };

    navigateToConnectionDetails = (connection: NWCConnection) => {
        this.props.navigation.navigate('ConnectionDetails', {
            connectionId: connection.id
        });
    };

    getFilteredConnections = () => {
        const { connections } = this.props.NostrWalletConnectStore;
        const { searchQuery } = this.state;

        if (!searchQuery.trim()) {
            return connections;
        }

        return connections.filter((connection) =>
            connection.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    getConnectionStatus = (connection: NWCConnection) => {
        if (connection.isExpired) {
            return {
                status: 'expired',
                color: themeColor('error'),
                icon: Clock
            };
        }
        if (connection.hasRecentActivity) {
            return {
                status: 'active',
                color: themeColor('success'),
                icon: Checkmark
            };
        }
        return {
            status: 'idle',
            color: themeColor('secondaryText'),
            icon: Clock
        };
    };

    formatDate = (date: Date) => {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    renderConnection = ({ item: connection }: { item: NWCConnection }) => {
        return (
            <View>
                <TouchableOpacity
                    style={[
                        styles.connectionCard,
                        { backgroundColor: themeColor('background') }
                    ]}
                    onPress={() => this.navigateToConnectionDetails(connection)}
                >
                    <View style={styles.connectionHeader}>
                        <View style={styles.connectionInfo}>
                            <View style={styles.nameRow}>
                                <Text
                                    style={[
                                        styles.connectionName,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {connection.name}
                                </Text>
                            </View>
                            {connection.expiresAt && (
                                <View style={styles.expirySection}>
                                    <Text
                                        style={[
                                            styles.expiryText,
                                            {
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }
                                        ]}
                                    >
                                        {localeString(
                                            'views.Settings.NostrWalletConnect.expires'
                                        )}{' '}
                                        {this.formatDate(connection.expiresAt)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {connection.maxAmountSats && (
                        <View style={styles.budgetSection}>
                            <Text
                                style={[
                                    styles.budgetLabel,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString(
                                    'views.Settings.NostrWalletConnect.leftInBudget'
                                )}
                            </Text>
                            <Text
                                style={[
                                    styles.budgetAmount,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {connection.maxAmountSats.toLocaleString()} sats
                            </Text>
                            <View
                                style={[
                                    styles.budgetBar,
                                    { backgroundColor: themeColor('border') }
                                ]}
                            >
                                <View
                                    style={[
                                        styles.budgetBarFill,
                                        {
                                            width: '100%',
                                            backgroundColor:
                                                themeColor('highlight')
                                        }
                                    ]}
                                />
                            </View>
                            <View style={styles.budgetDetails}>
                                <Text
                                    style={[
                                        styles.budgetDetailText,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {connection.lastUsed
                                        ? `${localeString(
                                              'views.Settings.NostrWalletConnect.lastUsed'
                                          )} ${this.formatDate(
                                              connection.lastUsed
                                          )}`
                                        : localeString(
                                              'views.Settings.NostrWalletConnect.neverUsed'
                                          )}
                                </Text>
                                <Text
                                    style={[
                                        styles.budgetDetailText,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {connection.maxAmountSats.toLocaleString()}{' '}
                                    sats
                                    {connection.budgetRenewal !== 'never'
                                        ? ` / ${connection.budgetRenewal}`
                                        : ''}
                                </Text>
                            </View>
                        </View>
                    )}

                    {!connection.maxAmountSats && connection.lastUsed && (
                        <View style={styles.lastUsedSection}>
                            <Text
                                style={[
                                    styles.lastUsedText,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString(
                                    'views.Settings.NostrWalletConnect.lastUsed'
                                )}{' '}
                                {this.formatDate(connection.lastUsed)}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Nostrich
                fill={themeColor('text')}
                width={60}
                height={60}
                style={{ alignSelf: 'center', marginBottom: 16 }}
            />
            <Text
                style={[
                    styles.emptyStateTitle,
                    { color: themeColor('secondaryText') }
                ]}
            >
                {localeString(
                    'views.Settings.NostrWalletConnect.noConnections'
                )}
            </Text>
            <Text
                style={[
                    styles.emptyStateSubtitle,
                    { color: themeColor('secondaryText') }
                ]}
            >
                {localeString(
                    'views.Settings.NostrWalletConnect.createFirstConnection'
                )}
            </Text>
        </View>
    );

    render() {
        const { NostrWalletConnectStore, navigation } = this.props;
        const { connections, loading } = NostrWalletConnectStore;
        const { connectionsLoading } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.NostrWalletConnect.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        connectionsLoading || loading ? (
                            <LoadingIndicator size={20} />
                        ) : (
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('AddNWCConnection')
                                }
                                accessibilityLabel={localeString(
                                    'views.Settings.NostrWalletConnect.addConnection'
                                )}
                            >
                                <Add
                                    fill={themeColor('text')}
                                    width={30}
                                    height={30}
                                    style={{ alignSelf: 'center' }}
                                />
                            </TouchableOpacity>
                        )
                    }
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.container}
                    showsVerticalScrollIndicator={false}
                >
                    {this.state.error && (
                        <ErrorMessage message={this.state.error} dismissable />
                    )}

                    <View style={{ marginTop: 20 }}>
                        {connectionsLoading ? (
                            <View style={styles.connectionsLoadingContainer}>
                                <LoadingIndicator />
                            </View>
                        ) : (
                            <>
                                {connections.length > 0 && (
                                    <SearchBar
                                        placeholder={localeString(
                                            'general.search'
                                        )}
                                        onChangeText={(value?: string) =>
                                            this.setState({
                                                searchQuery: value ?? ''
                                            })
                                        }
                                        value={this.state.searchQuery}
                                        inputStyle={[
                                            styles.searchInput,
                                            { color: themeColor('text') }
                                        ]}
                                        placeholderTextColor={themeColor(
                                            'secondaryText'
                                        )}
                                        containerStyle={{
                                            backgroundColor: 'transparent',
                                            borderTopWidth: 0,
                                            borderBottomWidth: 0,
                                            paddingHorizontal: 0,
                                            marginBottom: 10
                                        }}
                                        inputContainerStyle={{
                                            borderRadius: 15,
                                            backgroundColor:
                                                themeColor('secondary')
                                        }}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType="visible-password"
                                        platform="default"
                                        showLoading={false}
                                        onClear={() =>
                                            this.setState({
                                                searchQuery: ''
                                            })
                                        }
                                        onCancel={() => {
                                            this.setState({
                                                searchQuery: ''
                                            });
                                        }}
                                        cancelButtonTitle="Cancel"
                                        cancelButtonProps={{}}
                                        searchIcon={{
                                            name: 'search',
                                            type: 'font-awesome'
                                        }}
                                        clearIcon={{
                                            name: 'close',
                                            type: 'font-awesome'
                                        }}
                                        showCancel={true}
                                        onBlur={() => {}}
                                        onFocus={() => {}}
                                        loadingProps={{}}
                                        lightTheme={false}
                                        round={false}
                                    />
                                )}

                                {this.getFilteredConnections().length > 0 ? (
                                    <FlatList
                                        data={this.getFilteredConnections()}
                                        renderItem={this.renderConnection}
                                        keyExtractor={(item) => item.id}
                                        showsVerticalScrollIndicator={false}
                                        ItemSeparatorComponent={() => (
                                            <Divider
                                                style={[
                                                    {
                                                        marginBottom: 15,
                                                        backgroundColor:
                                                            themeColor('border')
                                                    }
                                                ]}
                                            />
                                        )}
                                        contentContainerStyle={
                                            styles.connectionsList
                                        }
                                    />
                                ) : connections.length > 0 ? (
                                    <View style={styles.emptySearch}>
                                        <Text
                                            style={[
                                                styles.emptySearchText,
                                                {
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }
                                            ]}
                                        >
                                            {localeString(
                                                'views.Settings.NostrWalletConnect.noConnectionsFound'
                                            )}
                                        </Text>
                                    </View>
                                ) : (
                                    this.renderEmptyState()
                                )}
                            </>
                        )}
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 12
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    connectionsLoadingContainer: {
        paddingVertical: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    searchContainerStyle: {
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderBottomWidth: 0,
        width: '100%'
    },
    searchInputContainer: {
        borderRadius: 8
    },
    searchInput: {
        fontFamily: 'PPNeueMontreal-Book',
        borderRadius: 16
    },
    connectionsList: {
        paddingBottom: 20
    },
    connectionCard: {
        borderRadius: 16,
        padding: 10,
        marginBottom: 12
    },
    connectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    connectionInfo: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    connectionName: {
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600'
    },
    connectionSubtitle: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book'
    },
    budgetSection: {
        marginTop: 12
    },
    budgetLabel: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 4
    },
    budgetAmount: {
        fontSize: 24,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600',
        marginBottom: 8
    },
    budgetBar: {
        height: 8,
        borderRadius: 4,
        marginBottom: 8
    },
    budgetBarFill: {
        height: '100%',
        borderRadius: 4
    },
    budgetDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    budgetDetailText: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book'
    },
    lastUsedSection: {
        marginTop: 12
    },
    lastUsedText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    expirySection: {
        marginTop: 8
    },
    expiryText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4
    },
    detailLabel: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book'
    },
    detailValue: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book'
    },
    permissionsLabel: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 8
    },
    permissionsList: {
        flexDirection: 'row',
        flexWrap: 'wrap'
    },
    permissionTag: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginRight: 6,
        marginBottom: 4
    },
    permissionText: {
        fontSize: 10,
        fontFamily: 'PPNeueMontreal-Book',
        textTransform: 'capitalize'
    },
    emptyState: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60
    },
    emptyStateTitle: {
        textAlign: 'center',
        fontSize: 18,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600',
        marginBottom: 8
    },
    emptyStateSubtitle: {
        textAlign: 'center',
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        lineHeight: 20,
        marginBottom: 10
    },
    emptySearch: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40
    },
    emptySearchText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    qrModal: {
        width: '100%',
        borderRadius: 16,
        padding: 0,
        margin: 0
    },
    modalContent: {
        padding: 24
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 16
    },
    modalSubtitle: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        marginTop: 4
    },
    urlContainer: {
        borderRadius: 8,
        padding: 12,
        marginBottom: 16
    },
    urlText: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        lineHeight: 16
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 24
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'center'
    },
    closeButton: {
        borderRadius: 8,
        paddingHorizontal: 24,
        paddingVertical: 8
    },
    closeButtonText: {
        color: themeColor('text'),
        fontFamily: 'PPNeueMontreal-Book'
    }
});
