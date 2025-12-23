import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';
import React from 'react';
import { FlatList, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import SettingsStore from '../../../stores/SettingsStore';

import { ConnectionActivity } from '../../../models/NWCConnection';
import Payment from '../../../models/Payment';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import Amount from '../../../components/Amount';
import LoadingIndicator from '../../../components/LoadingIndicator';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import Filter from '../../../assets/images/SVG/Filter On.svg';
import dateTimeUtils from '../../../utils/DateTimeUtils';

export interface NWCFilterState {
    sent: boolean;
    received: boolean;
    failed: boolean;
    pending: boolean;
}

export const NWC_DEFAULT_FILTERS: NWCFilterState = {
    sent: true,
    received: true,
    failed: true,
    pending: true
};

interface ConnectionActivityProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'NWCConnectionActivity', { connectionId: string }>;
    NostrWalletConnectStore: NostrWalletConnectStore;
    SettingsStore: SettingsStore;
}

interface ConnectionActivityState {
    activity: ConnectionActivity[];
    filteredActivity: ConnectionActivity[];
    connectionName: string | null;
    loading: boolean;
    error: string | null;
    activeFilters: NWCFilterState;
}

@inject('NostrWalletConnectStore', 'SettingsStore')
@observer
export default class NWCConnectionActivity extends React.Component<
    ConnectionActivityProps,
    ConnectionActivityState
> {
    constructor(props: ConnectionActivityProps) {
        super(props);
        this.state = {
            activity: [],
            filteredActivity: [],
            connectionName: null,
            loading: false,
            error: null,
            activeFilters: { ...NWC_DEFAULT_FILTERS }
        };
    }

    async componentDidMount() {
        const { route } = this.props;
        const { connectionId } = route.params;
        await this.loadActivities(connectionId);
    }

    loadActivities = async (connectionId: string) => {
        const { NostrWalletConnectStore } = this.props;
        try {
            this.setState({ loading: true, error: null });
            const { name, activity } =
                await NostrWalletConnectStore.getActivities(connectionId);
            const enrichedActivity = await this.enrichActivitiesWithInvoiceData(
                activity
            );

            const filteredActivity = this.applyFilters(
                enrichedActivity,
                this.state.activeFilters
            );

            this.setState({
                activity: enrichedActivity,
                filteredActivity,
                connectionName: name,
                loading: false
            });
        } catch (e: any) {
            this.setState({
                error:
                    e.message ||
                    localeString(
                        'views.Settings.NostrWalletConnect.error.failedToLoadActivity'
                    ),
                loading: false
            });
        }
    };

    enrichActivitiesWithInvoiceData = async (
        activities: ConnectionActivity[]
    ): Promise<ConnectionActivity[]> => {
        const { NostrWalletConnectStore, SettingsStore } = this.props;

        const enrichedActivities = await Promise.all(
            activities.map(async (item) => {
                // Only fetch invoice data for pending make_invoice items
                if (item.type === 'make_invoice' && item.status === 'pending') {
                    try {
                        const invoice =
                            await NostrWalletConnectStore.getDecodedInvoice(
                                item.id
                            );

                        if (invoice) {
                            const locale = SettingsStore?.settings.locale;
                            invoice?.determineFormattedOriginalTimeUntilExpiry(
                                locale
                            );
                            invoice?.determineFormattedRemainingTimeUntilExpiry(
                                locale
                            );
                            return {
                                ...item,
                                isExpired: invoice.isExpired,
                                expiryLabel: invoice.formattedTimeUntilExpiry
                            };
                        }
                    } catch (e) {
                        console.error('Failed to fetch invoice:', e);
                    }
                }
                return item;
            })
        );

        return enrichedActivities;
    };

    applyFilters = (
        activities: ConnectionActivity[],
        filters: NWCFilterState
    ): ConnectionActivity[] => {
        const allFiltersActive = Object.values(filters).every(
            (v) => v === true
        );
        if (allFiltersActive) return activities;

        const noFiltersActive = Object.values(filters).every(
            (v) => v === false
        );
        if (noFiltersActive) return [];

        return activities.filter((item) => {
            const isSentType =
                item.type === 'pay_invoice' || item.type === 'pay_keysend';
            const isReceivedType = item.type === 'make_invoice';

            if (item.status === 'success') {
                return (
                    (isSentType && filters.sent) ||
                    (isReceivedType && filters.received)
                );
            }

            if (item.status === 'failed') {
                return (
                    (isSentType && filters.sent && filters.failed) ||
                    (isReceivedType && filters.received && filters.failed)
                );
            }

            if (item.status === 'pending') {
                return (
                    (isSentType && filters.sent && filters.pending) ||
                    (isReceivedType && filters.pending)
                );
            }

            return false;
        });
    };

    handleFilterChange = (newFilters: NWCFilterState) => {
        this.setState((prev) => ({
            activeFilters: newFilters,
            filteredActivity: this.applyFilters(prev.activity, newFilters)
        }));
    };

    handleRefresh = () => {
        const { route } = this.props;
        const connectionId = route.params?.connectionId;
        if (connectionId) {
            this.loadActivities(connectionId);
        }
    };

    getAmountColor = (item: ConnectionActivity) => {
        if (item.status === 'success') {
            return item.type === 'make_invoice' ? 'success' : 'warning';
        }
        if (item.status === 'failed') return 'warning';
        if (item.status === 'pending') return 'highlight';
        return 'secondaryText';
    };

    getActivityTitle = (item: ConnectionActivity): string => {
        if (item.type === 'pay_invoice' || item.type === 'pay_keysend') {
            if (item.status === 'failed') {
                return localeString('views.Payment.failedPayment');
            }
            if (item.status === 'pending') {
                return localeString('views.Payment.inTransitPayment');
            }
            return localeString('views.Activity.youSent');
        }

        // make_invoice
        if (item.isExpired) {
            return localeString('views.Activity.expiredPayment');
        }
        if (item.status === 'success') {
            return localeString('views.Activity.youReceived');
        }
        return localeString('views.Activity.requestedPayment');
    };

    getActivitySubtitle = (item: ConnectionActivity): string => {
        if (item.type === 'make_invoice') {
            return localeString('views.PaymentRequest.title');
        }
        return item.payment_source === 'lightning'
            ? localeString('general.lightning')
            : localeString('general.cashu');
    };

    navigateToPaymentDetails = (item: ConnectionActivity) => {
        const { navigation } = this.props;
        const payment = new Payment({
            payment_request: item.id,
            payment_hash: item.paymentHash,
            payment_preimage: item.preimage,
            value_sat: item.satAmount,
            amount: item.satAmount,
            status:
                item.status === 'success'
                    ? 'SUCCEEDED'
                    : item.status === 'failed'
                    ? 'FAILED'
                    : 'IN_FLIGHT',
            creation_date: item.lastprocessAt
                ? Math.floor(new Date(item.lastprocessAt).getTime() / 1000)
                : undefined,
            invoice: item.id
        });
        navigation.navigate('Payment', { payment });
    };

    navigateToInvoiceDetails = async (item: ConnectionActivity) => {
        const { navigation, NostrWalletConnectStore } = this.props;
        try {
            const invoice = await NostrWalletConnectStore.getDecodedInvoice(
                item.id
            );
            if (invoice) {
                navigation.navigate('Invoice', { invoice });
            }
        } catch (e) {
            console.error('Navigation to invoice failed:', e);
        }
    };

    handleActivityPress = (item: ConnectionActivity) => {
        if (item.type === 'pay_invoice' || item.type === 'pay_keysend') {
            this.navigateToPaymentDetails(item);
        } else if (item.type === 'make_invoice') {
            this.navigateToInvoiceDetails(item);
        }
    };

    navigateToFilter = () => {
        this.props.navigation.navigate('NWCConnectionActivityFilter', {
            activeFilters: this.state.activeFilters,
            onApply: this.handleFilterChange
        });
    };

    isDefaultFilter = (filters: NWCFilterState): boolean => {
        return (
            filters.sent === NWC_DEFAULT_FILTERS.sent &&
            filters.received === NWC_DEFAULT_FILTERS.received &&
            filters.failed === NWC_DEFAULT_FILTERS.failed &&
            filters.pending === NWC_DEFAULT_FILTERS.pending
        );
    };

    renderActivityListItem = ({ item }: { item: ConnectionActivity }) => {
        const title = this.getActivityTitle(item);
        const subtitle = this.getActivitySubtitle(item);

        return (
            <ListItem
                onPress={() => this.handleActivityPress(item)}
                containerStyle={{ backgroundColor: 'transparent' }}
            >
                <ListItem.Content>
                    <View style={styles.row}>
                        <ListItem.Title
                            style={{
                                ...styles.leftCell,
                                color: themeColor('text')
                            }}
                        >
                            {title}
                        </ListItem.Title>
                        <Amount
                            sats={item.satAmount}
                            sensitive
                            color={this.getAmountColor(item)}
                        />
                    </View>

                    <View style={styles.row}>
                        <ListItem.Subtitle
                            style={{
                                ...styles.leftCellSecondary,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {subtitle}
                        </ListItem.Subtitle>
                        <ListItem.Subtitle
                            style={{
                                ...styles.rightCellSecondary,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {dateTimeUtils.listFormattedDate(
                                new Date(item.lastprocessAt).getTime(),
                                'mmm d, HH:MM'
                            )}
                        </ListItem.Subtitle>
                    </View>

                    {item.type === 'make_invoice' &&
                        item.status === 'pending' &&
                        !item.isExpired &&
                        item.expiryLabel && (
                            <View style={styles.row}>
                                <ListItem.Subtitle
                                    style={{
                                        ...styles.leftCellSecondary,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Invoice.expiration')}
                                </ListItem.Subtitle>
                                <ListItem.Subtitle
                                    style={{
                                        ...styles.rightCellSecondary,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {item.expiryLabel}
                                </ListItem.Subtitle>
                            </View>
                        )}
                </ListItem.Content>
            </ListItem>
        );
    };

    renderSeparator = () => (
        <View
            style={{ height: 0.4, backgroundColor: themeColor('separator') }}
        />
    );

    render() {
        const {
            loading,
            filteredActivity,
            error,
            connectionName,
            activeFilters
        } = this.state;
        const { navigation } = this.props;

        const isDefaultFilter = this.isDefaultFilter(activeFilters);

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: connectionName || '',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <TouchableOpacity onPress={this.navigateToFilter}>
                            <Filter
                                fill={
                                    isDefaultFilter
                                        ? themeColor('text')
                                        : themeColor('highlight')
                                }
                                width={35}
                                height={35}
                            />
                        </TouchableOpacity>
                    }
                    navigation={navigation}
                />

                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : error ? (
                    <Button
                        title={error}
                        icon={{
                            name: 'error-outline',
                            color: themeColor('warning')
                        }}
                        onPress={this.handleRefresh}
                        buttonStyle={{ backgroundColor: 'transparent' }}
                        titleStyle={{ color: themeColor('warning') }}
                    />
                ) : filteredActivity.length > 0 ? (
                    <FlatList
                        data={filteredActivity.slice().reverse()}
                        renderItem={this.renderActivityListItem}
                        keyExtractor={(item, index) =>
                            `${item.type}-${item.lastprocessAt}-${index}`
                        }
                        ItemSeparatorComponent={this.renderSeparator}
                        refreshing={loading}
                        onRefresh={this.handleRefresh}
                    />
                ) : (
                    <Button
                        title={localeString('views.Activity.noActivity')}
                        icon={{
                            name: 'error-outline',
                            color: themeColor('text')
                        }}
                        onPress={this.handleRefresh}
                        buttonStyle={{ backgroundColor: 'transparent' }}
                        titleStyle={{ color: themeColor('text') }}
                    />
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%'
    },
    leftCell: {
        fontWeight: '600',
        fontFamily: 'PPNeueMontreal-Book',
        flexShrink: 1
    },
    leftCellSecondary: {
        fontFamily: 'PPNeueMontreal-Book',
        flexShrink: 1
    },
    rightCellSecondary: {
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'right'
    }
});
