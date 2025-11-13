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
import { Divider, SearchBar, ButtonGroup } from 'react-native-elements';
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

import NWCConnection from '../../../models/NWCConnection';
import { Status, ExpirationStatus } from '../../../models/Status';

import Add from '../../../assets/images/SVG/Add.svg';
import Gear from '../../../assets/images/SVG/Gear.svg';
import NWCLogo from '../../../assets/images/SVG/nwc-logo.svg';

interface NWCConnectionsListProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

type ConnectionFilter = 'active' | 'expired' | 'all';

interface NWCConnectionsListState {
    searchQuery: string;
    connectionsLoading: boolean;
    error: string;
    refreshing: boolean;
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
            refreshing: false,
            filter: 'all'
        };
    }

    async componentDidMount() {
        this.props.navigation.addListener('focus', this.handleFocus);
        await this.loadSettings();
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.handleFocus);
    }

    loadSettings = async () => {
        try {
            this.setState({
                connectionsLoading: true,
                error: ''
            });
            await this.props.NostrWalletConnectStore.loadConnections();
            this.setState({
                connectionsLoading: false
            });
        } catch (error: any) {
            this.setState({
                error: localeString(
                    'stores.NostrWalletConnectStore.error.failedToLoadConnections'
                ),
                connectionsLoading: false
            });
        }
    };

    handleFocus = async () => {
        await this.loadSettings();
    };

    getFilterOptions = () => {
        const { connections } = this.props.NostrWalletConnectStore;
        return [
            {
                key: 'all' as ConnectionFilter,
                label: localeString('general.all'),
                count: connections.length
            },
            {
                key: 'active' as ConnectionFilter,
                label: localeString('general.active'),
                count: connections.filter((c) => c.isActive).length
            },
            {
                key: 'expired' as ConnectionFilter,
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

    getStatus = (connection: NWCConnection) => {
        return connection.isExpired ? ExpirationStatus.Expired : Status.Active;
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
                            <Tag
                                status={
                                    connection.isExpired
                                        ? ExpirationStatus.Expired
                                        : Status.Active
                                }
                            />
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
                                {`${connection.remainingBudget.toLocaleString()} ${localeString(
                                    'general.sats'
                                )}`}
                            </Text>
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
                                          )} ${DateTimeUtils.listFormattedDateOrder(
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
                                {DateTimeUtils.listFormattedDateOrder(
                                    connection.lastUsed
                                )}
                            </Text>
                        </View>
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
                                            onRefresh={this.loadSettings}
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
    lastUsedSection: {
        marginTop: 8
    },
    lastUsedText: {
        fontSize: 13,
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
