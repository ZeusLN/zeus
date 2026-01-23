import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';
import React from 'react';
import {
    FlatList,
    View,
    StyleSheet,
    TouchableOpacity,
    Text
} from 'react-native';
import { Button, ListItem } from '@rneui/themed';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import SettingsStore from '../../../stores/SettingsStore';

import { ConnectionActivity } from '../../../models/NWCConnection';
import Invoice from '../../../models/Invoice';
import CashuInvoice from '../../../models/CashuInvoice';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import Amount from '../../../components/Amount';
import LoadingIndicator from '../../../components/LoadingIndicator';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import PrivacyUtils from '../../../utils/PrivacyUtils';
import dateTimeUtils from '../../../utils/DateTimeUtils';

import Filter from '../../../assets/images/SVG/Filter On.svg';

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
        const { connectionId } = this.props.route.params;
        await this.loadActivities(connectionId);
    }

    loadActivities = async (connectionId: string) => {
        const { NostrWalletConnectStore } = this.props;

        try {
            this.setState({ loading: true, error: null });

            const { name, activity } =
                await NostrWalletConnectStore.getActivities(connectionId);
            const safeActivity = Array.isArray(activity) ? activity : [];
            const filteredActivity = this.applyFilters(
                safeActivity,
                this.state.activeFilters
            );

            this.setState({
                activity: safeActivity,
                filteredActivity: Array.isArray(filteredActivity)
                    ? filteredActivity
                    : [],
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
                activity: [],
                filteredActivity: [],
                loading: false
            });
        }
    };

    applyFilters = (
        activities: ConnectionActivity[],
        filters: NWCFilterState
    ): ConnectionActivity[] => {
        if (!activities || !Array.isArray(activities)) {
            return [];
        }
        const allFiltersActive = Object.values(filters).every(
            (value) => value === true
        );
        if (allFiltersActive) return activities;

        const noFiltersActive = Object.values(filters).every(
            (value) => value === false
        );
        if (noFiltersActive) return [];

        return activities.filter((item) => {
            const isSent =
                item.type === 'pay_invoice' || item.type === 'pay_keysend';
            const isReceived = item.type === 'make_invoice';

            if (item.status === 'success') {
                return (
                    (isSent && filters.sent) || (isReceived && filters.received)
                );
            }

            if (item.status === 'failed') {
                return (
                    (isSent && filters.sent && filters.failed) ||
                    (isReceived && filters.received && filters.failed)
                );
            }

            if (item.status === 'pending') {
                return (
                    (isSent && filters.sent && filters.pending) ||
                    (isReceived && filters.pending)
                );
            }

            return false;
        });
    };

    handleFilterChange = (newFilters: NWCFilterState) => {
        this.setState((prevState) => {
            const safeActivity = Array.isArray(prevState.activity)
                ? prevState.activity
                : [];
            const filtered = this.applyFilters(safeActivity, newFilters);
            return {
                activeFilters: newFilters,
                filteredActivity: Array.isArray(filtered) ? filtered : []
            };
        });
    };

    handleRefresh = () => {
        const connectionId = this.props.route.params?.connectionId;
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
        const isSent =
            item.type === 'pay_invoice' || item.type === 'pay_keysend';

        if (isSent) {
            if (item.status === 'failed')
                return localeString('views.Payment.failedPayment');
            if (item.status === 'pending')
                return localeString('views.Payment.inTransitPayment');
            return localeString('views.Activity.youSent');
        }

        if (item.isExpired)
            return localeString('views.Activity.expiredRequested');
        if (item.status === 'success')
            return localeString('views.Activity.youReceived');
        return localeString('views.Activity.requestedPayment');
    };

    getActivitySubtitle = (item: ConnectionActivity): string => {
        if (
            (item.type === 'make_invoice' || item.type === 'pay_invoice') &&
            item.payment_source === 'cashu'
        ) {
            return localeString('general.cashu');
        }
        return localeString('views.PaymentRequest.title');
    };

    getAmount = (item: ConnectionActivity) => {
        if (item.type === 'make_invoice' && item.invoice) {
            return item.invoice.getAmount;
        }

        if (
            (item.type === 'pay_invoice' || item.type === 'pay_keysend') &&
            item.payment
        ) {
            return item.payment.getAmount;
        }

        return item.satAmount;
    };

    navigateToPaymentDetails = (item: ConnectionActivity) => {
        if (item.payment_source === 'cashu') {
            this.props.navigation.navigate('CashuPayment', {
                payment: item.payment
            });
        } else {
            this.props.navigation.navigate('Payment', {
                payment: item.payment
            });
        }
    };

    navigateToInvoiceDetails = (item: ConnectionActivity) => {
        const { navigation } = this.props;

        try {
            if (!item.invoice) return;

            if (
                item.payment_source === 'cashu' &&
                item.invoice instanceof CashuInvoice
            ) {
                navigation.navigate('CashuInvoice', { invoice: item.invoice });
            } else if (item.invoice instanceof Invoice) {
                navigation.navigate('Invoice', { invoice: item.invoice });
            }
        } catch (e) {
            console.error('Navigation to invoice failed:', e);
        }
    };

    handleActivityPress = (item: ConnectionActivity) => {
        const isSent =
            item.type === 'pay_invoice' || item.type === 'pay_keysend';

        if (isSent && item.status !== 'failed') {
            this.navigateToPaymentDetails(item);
        } else if (item.type === 'make_invoice' && item.status !== 'failed') {
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
        const displayTime =
            item.invoice?.getDisplayTime || item.payment?.getDisplayTime;
        const displayTimeShort =
            item.invoice?.getDisplayTimeShort ||
            item.payment?.getDisplayTimeShort ||
            dateTimeUtils.listFormattedDate(
                item.createdAt?.toString()!,
                'HH:MM tt'
            );
        const note = item.payment?.getNote || item.invoice?.getNote;
        const showExpiry =
            item.type === 'make_invoice' &&
            item.status === 'pending' &&
            !item.isExpired;

        return (
            <ListItem
                onPress={() => this.handleActivityPress(item)}
                containerStyle={{ backgroundColor: 'transparent' }}
            >
                <ListItem.Content>
                    <View style={styles.row}>
                        <ListItem.Title
                            style={[
                                styles.leftCell,
                                { color: themeColor('text') }
                            ]}
                        >
                            {title}
                        </ListItem.Title>
                        <Amount
                            sats={this.getAmount(item)}
                            sensitive
                            color={this.getAmountColor(item)}
                        />
                    </View>

                    {displayTime && (
                        <View style={styles.row}>
                            <ListItem.Subtitle
                                style={[
                                    styles.leftCellSecondary,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {subtitle}
                            </ListItem.Subtitle>
                            <ListItem.Subtitle
                                style={[
                                    styles.rightCellSecondary,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                <Text>{displayTimeShort}</Text>
                            </ListItem.Subtitle>
                        </View>
                    )}

                    {showExpiry && (
                        <View style={styles.row}>
                            <ListItem.Subtitle
                                style={[
                                    styles.leftCellSecondary,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString('views.Invoice.expiration')}
                            </ListItem.Subtitle>
                            <ListItem.Subtitle
                                style={[
                                    styles.rightCellSecondary,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {item.invoice?.formattedTimeUntilExpiry}
                            </ListItem.Subtitle>
                        </View>
                    )}

                    {note && (
                        <View style={styles.row}>
                            <ListItem.Subtitle
                                style={[
                                    styles.noteLabel,
                                    { color: themeColor('text') }
                                ]}
                                numberOfLines={1}
                            >
                                {localeString('general.note')}
                            </ListItem.Subtitle>
                            <ListItem.Subtitle
                                style={[
                                    styles.noteValue,
                                    { color: themeColor('secondaryText') }
                                ]}
                                ellipsizeMode="tail"
                            >
                                {PrivacyUtils.sensitiveValue({
                                    input: note,
                                    condenseAtLength: 100
                                })?.toString()}
                            </ListItem.Subtitle>
                        </View>
                    )}
                </ListItem.Content>
            </ListItem>
        );
    };

    renderSeparator = () => (
        <View
            style={{
                ...styles.separator,
                backgroundColor: themeColor('background')
            }}
        />
    );

    renderEmptyState = () => (
        <Button
            title={localeString('views.Activity.noActivity')}
            icon={{ name: 'error-outline', color: themeColor('text') }}
            onPress={this.handleRefresh}
            buttonStyle={{ backgroundColor: 'transparent' }}
            titleStyle={{ color: themeColor('text') }}
        />
    );

    renderError = () => (
        <Button
            title={this.state.error || ''}
            icon={{ name: 'error-outline', color: themeColor('warning') }}
            onPress={this.handleRefresh}
            buttonStyle={{ backgroundColor: 'transparent' }}
            titleStyle={{ color: themeColor('warning') }}
        />
    );

    getSafeFilteredActivity = (): ConnectionActivity[] => {
        const { filteredActivity } = this.state;
        if (!filteredActivity) return [];
        if (!Array.isArray(filteredActivity)) return [];
        try {
            return filteredActivity.slice().reverse();
        } catch (e) {
            console.error('Error processing filteredActivity:', e);
            return [];
        }
    };

    renderContent = () => {
        const { loading, error } = this.state;

        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <LoadingIndicator />
                </View>
            );
        }

        if (error) {
            return this.renderError();
        }

        const safeFilteredActivity = this.getSafeFilteredActivity();

        if (!safeFilteredActivity || safeFilteredActivity.length === 0) {
            return this.renderEmptyState();
        }

        return (
            <FlatList
                data={safeFilteredActivity}
                renderItem={this.renderActivityListItem}
                keyExtractor={(item, index) =>
                    `${item.type}-${
                        item.id || item.createdAt || index
                    }-${index}`
                }
                ItemSeparatorComponent={this.renderSeparator}
                refreshing={loading}
                onRefresh={this.handleRefresh}
            />
        );
    };

    render() {
        const { connectionName, activeFilters } = this.state;
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
                {this.renderContent()}
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
    },
    noteLabel: {
        fontFamily: 'Lato-Regular',
        flexShrink: 0,
        flex: 0,
        width: 'auto'
    },
    noteValue: {
        fontFamily: 'Lato-Regular',
        flexWrap: 'wrap',
        flexShrink: 1
    },
    separator: {
        height: 0.4
    },
    loadingContainer: {
        padding: 50
    }
});
