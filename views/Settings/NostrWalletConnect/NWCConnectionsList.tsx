import React from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Text,
    RefreshControl,
    Platform
} from 'react-native';
import { Divider, SearchBar, ButtonGroup } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Tag } from '../../../components/Channels/Tag';

import SettingsStore from '../../../stores/SettingsStore';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import DateTimeUtils from '../../../utils/DateTimeUtils';
import NostrConnectUtils from '../../../utils/NostrConnectUtils';

import NWCConnection, {
    ConnectionWarningType
} from '../../../models/NWCConnection';
import { Status, ExpirationStatus } from '../../../models/Status';

import Add from '../../../assets/images/SVG/Add.svg';
import Gear from '../../../assets/images/SVG/Gear.svg';
import NWCLogo from '../../../assets/images/SVG/nwc-logo.svg';

interface NWCConnectionsListProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

enum ConnectionFilter {
    Active = 'active',
    Expired = 'expired',
    All = 'all'
}

interface NWCConnectionsListState {
    searchQuery: string;
    connectionsLoading: boolean;
    error: string;
    filter: ConnectionFilter;
}

@inject('SettingsStore', 'NostrWalletConnectStore')
@observer
export default class NWCConnectionsList extends React.Component<
    NWCConnectionsListProps,
    NWCConnectionsListState
> {
    constructor(props: NWCConnectionsListProps) {
        super(props);
        this.state = {
            searchQuery: '',
            connectionsLoading: false,
            error: '',
            filter: ConnectionFilter.All
        };
    }

    componentDidMount() {
        const { navigation } = this.props;
        navigation.addListener('focus', this.handleFocus);
        this.getConnections();
    }
    componentWillUnmount() {
        const { navigation } = this.props;
        navigation.removeListener('focus', this.handleFocus);
    }
    async getConnections() {
        try {
            this.setState({
                connectionsLoading: true,
                error: ''
            });
            const { NostrWalletConnectStore, SettingsStore } = this.props;
            if (!SettingsStore.connecting) {
                await NostrWalletConnectStore.loadMaxBudget();
            }
            await NostrWalletConnectStore.loadConnections();
            this.setState({
                connectionsLoading: false
            });
        } catch (error) {
            this.setState({
                connectionsLoading: false,
                error: localeString(
                    'stores.NostrWalletConnectStore.error.failedToLoadConnections'
                )
            });
        }
    }
    handleFocus = async () => {
        await this.getConnections();
    };
    getFilterOptions = () => {
        const { connections } = this.props.NostrWalletConnectStore;
        return [
            {
                key: ConnectionFilter.All,
                label: localeString('general.all'),
                count: connections.length
            },
            {
                key: ConnectionFilter.Active,
                label: localeString('general.active'),
                count: connections.filter((c) => c.isActive).length
            },
            {
                key: ConnectionFilter.Expired,
                label: localeString('channel.expirationStatus.expired'),
                count: connections.filter((c) => c.isExpired).length
            }
        ];
    };

    navigateToConnectionDetails = (connection: NWCConnection) => {
        this.props.navigation.navigate('NWCConnectionDetails', {
            connectionId: connection.id
        });
    };

    getFilterButtonIndex = () => {
        const filters = this.getFilterOptions();
        return filters.findIndex((f) => f.key === this.state.filter);
    };

    handleFilterChange = (selectedIndex: number) => {
        const filters = this.getFilterOptions();
        const selectedFilter = filters[selectedIndex];
        if (selectedFilter) {
            this.setState({ filter: selectedFilter.key });
        }
    };

    getFilteredConnections = () => {
        const { connections } = this.props.NostrWalletConnectStore;
        const { searchQuery, filter } = this.state;

        let filteredConnections = connections;

        // Apply status filter
        if (filter === 'active') {
            filteredConnections = filteredConnections.filter((c) => c.isActive);
        } else if (filter === 'expired') {
            filteredConnections = filteredConnections.filter(
                (c) => c.isExpired
            );
        }

        // Apply search filter
        if (searchQuery.trim()) {
            filteredConnections = filteredConnections.filter((connection) =>
                connection.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
            );
        }

        return filteredConnections;
    };

    renderConnection = ({
        item: connection,
        index
    }: {
        item: NWCConnection;
        index: number;
    }) => {
        const hasPaymentPermissions = NostrConnectUtils.hasPaymentPermissions(
            connection.permissions
        );
        return (
            <View style={{ paddingTop: index === 0 ? 10 : 0 }}>
                <TouchableOpacity
                    style={[
                        styles.connectionCard,
                        { backgroundColor: themeColor('background') }
                    ]}
                    onPress={() => this.navigateToConnectionDetails(connection)}
                >
                    <View style={styles.connectionHeader}>
                        <View
                            style={[
                                styles.connectionInfo,
                                {
                                    paddingBottom: !hasPaymentPermissions
                                        ? 15
                                        : 0
                                }
                            ]}
                        >
                            <Text
                                style={[
                                    styles.connectionName,
                                    { color: themeColor('text') }
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {connection.name}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                                {!hasPaymentPermissions && (
                                    <Tag status={Status.ReadOnly} />
                                )}
                                {connection.hasWarnings && (
                                    <Tag
                                        status={
                                            connection.primaryWarning?.type ==
                                            ConnectionWarningType.BudgetLimitReached
                                                ? Status.LimitExceed
                                                : ExpirationStatus.LSPDiscretion
                                        }
                                    />
                                )}
                                <Tag
                                    status={
                                        connection.isExpired
                                            ? ExpirationStatus.Expired
                                            : Status.Active
                                    }
                                />
                            </View>
                        </View>
                    </View>
                    {connection.maxAmountSats && (
                        <View style={styles.budgetSection}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    gap: 10,
                                    alignItems: 'center'
                                }}
                            >
                                <Text
                                    style={[
                                        styles.budgetAmount,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {`${connection.remainingBudget.toLocaleString()} ${localeString(
                                        'general.sats'
                                    )}`}
                                </Text>
                                <Text
                                    style={[
                                        styles.budgetLabel,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.leftInBudget'
                                    ).toLowerCase()}
                                </Text>
                            </View>

                            <View style={styles.budgetBarContainer}>
                                <View
                                    style={[
                                        styles.budgetBarBackground,
                                        {
                                            backgroundColor:
                                                themeColor('secondary')
                                        }
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.budgetBarProgress,
                                        {
                                            width: `${Math.min(
                                                100,
                                                connection.budgetUsagePercentage
                                            )}%`,
                                            backgroundColor:
                                                connection.budgetUsagePercentage >=
                                                80
                                                    ? themeColor('delete')
                                                    : themeColor('success')
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
                                          )} ${DateTimeUtils.listFormattedDateShort(
                                              connection.lastUsed.getTime() /
                                                  1000
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
                                    {`${connection.totalSpendSats.toLocaleString()} / ${connection.maxAmountSats.toLocaleString()} ${localeString(
                                        'general.sats'
                                    )}`}
                                    {connection.budgetRenewal !== 'never'
                                        ? ` (${connection.budgetRenewal})`
                                        : ''}
                                </Text>
                            </View>
                        </View>
                    )}
                    {!hasPaymentPermissions && (
                        <Text
                            style={[
                                styles.budgetDetailText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {connection.lastUsed
                                ? `${localeString(
                                      'views.Settings.NostrWalletConnect.lastUsed'
                                  )} ${DateTimeUtils.listFormattedDateShort(
                                      connection.lastUsed.getTime() / 1000
                                  )}`
                                : localeString(
                                      'views.Settings.NostrWalletConnect.neverUsed'
                                  )}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    renderEmptyState = () => (
        <View style={styles.emptyState}>
            <NWCLogo
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
        const { NostrWalletConnectStore, navigation, SettingsStore } =
            this.props;
        const { connections, loading } = NostrWalletConnectStore;
        const { connectionsLoading, error } = this.state;

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
                            <View style={{ marginRight: 10 }}>
                                <LoadingIndicator size={30} />
                            </View>
                        ) : (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 15
                                }}
                            >
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(
                                            'AddOrEditNWCConnection'
                                        )
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
                                {!(
                                    Platform.OS === 'ios' &&
                                    (SettingsStore.implementation !==
                                        'embedded-lnd' ||
                                        !SettingsStore.settings?.ecash
                                            ?.enableCashu)
                                ) && (
                                    <TouchableOpacity
                                        onPress={() =>
                                            navigation.navigate('NWCSettings')
                                        }
                                        accessibilityLabel={localeString(
                                            'views.Settings.title'
                                        )}
                                    >
                                        <Gear
                                            fill={themeColor('text')}
                                            width={30}
                                            height={30}
                                            style={{ alignSelf: 'center' }}
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )
                    }
                    navigation={navigation}
                />

                {error && <ErrorMessage message={error} dismissable />}

                <View style={{ marginTop: 20 }}>
                    {connectionsLoading ? (
                        <View style={styles.connectionsLoadingContainer}>
                            <LoadingIndicator />
                        </View>
                    ) : (
                        <View style={{ paddingHorizontal: 5 }}>
                            {connections.length > 0 && (
                                <>
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
                                            paddingHorizontal: 0
                                        }}
                                        inputContainerStyle={{
                                            borderRadius: 15,
                                            backgroundColor:
                                                themeColor('secondary')
                                        }}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType="visible-password"
                                        platform="ios"
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
                                    />

                                    {/* Filter Buttons */}
                                    <ButtonGroup
                                        onPress={this.handleFilterChange}
                                        selectedIndex={this.getFilterButtonIndex()}
                                        buttons={this.getFilterOptions().map(
                                            (option) => {
                                                const isSelected =
                                                    this.state.filter ===
                                                    option.key;
                                                return {
                                                    element: () => (
                                                        <Text
                                                            style={[
                                                                styles.filterButtonText,
                                                                {
                                                                    color: isSelected
                                                                        ? themeColor(
                                                                              'background'
                                                                          )
                                                                        : themeColor(
                                                                              'text'
                                                                          )
                                                                }
                                                            ]}
                                                        >
                                                            {option.label} (
                                                            {option.count})
                                                        </Text>
                                                    )
                                                } as any;
                                            }
                                        )}
                                        selectedButtonStyle={{
                                            backgroundColor:
                                                themeColor('highlight'),
                                            borderRadius: 8
                                        }}
                                        containerStyle={{
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderRadius: 12,
                                            borderColor:
                                                themeColor('secondary'),
                                            marginHorizontal: 5,
                                            marginBottom: 10,
                                            height: 40
                                        }}
                                        innerBorderStyle={{
                                            color: themeColor('secondary')
                                        }}
                                    />
                                </>
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
                                    refreshControl={
                                        <RefreshControl
                                            refreshing={connectionsLoading}
                                            onRefresh={this.getConnections}
                                            tintColor={themeColor('text')}
                                            colors={[themeColor('highlight')]}
                                        />
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
                        </View>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    connectionsLoadingContainer: {
        paddingVertical: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    searchInput: {
        fontFamily: 'PPNeueMontreal-Book',
        borderRadius: 16
    },
    connectionsList: {
        paddingBottom: 10,
        height: '100%'
    },
    connectionCard: {
        borderRadius: 12,
        paddingHorizontal: 5,
        paddingVertical: 5,
        marginBottom: 4
    },
    connectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    connectionInfo: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12
    },
    filterButtonText: {
        fontSize: 13,
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center'
    },
    connectionName: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600',
        flex: 1,
        marginRight: 8
    },
    budgetSection: {
        marginTop: 8
    },
    budgetLabel: {
        fontSize: 13,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 6
    },
    budgetAmount: {
        fontSize: 20,
        fontFamily: 'PPNeueMontreal-Book',
        fontWeight: '600',
        marginBottom: 8
    },
    budgetBarContainer: {
        position: 'relative',
        marginBottom: 8,
        height: 8
    },
    budgetBarBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: 8,
        borderRadius: 4,
        width: '100%'
    },
    budgetBarProgress: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: 8
    },
    budgetDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    budgetDetailText: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book'
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
    }
});
