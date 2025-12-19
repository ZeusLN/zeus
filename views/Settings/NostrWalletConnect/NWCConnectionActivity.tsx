import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';
import React from 'react';
import { FlatList, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import NostrWalletConnectStore from '../../../stores/NostrWalletConnectStore';
import { ConnectionActivity } from '../../../models/NWCConnection';
import Payment from '../../../models/Payment';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import Amount from '../../../components/Amount';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import PrivacyUtils from '../../../utils/PrivacyUtils';

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
}

interface ConnectionActivityState {
    activity: ConnectionActivity[];
    filteredActivity: ConnectionActivity[];
    connectionName: string | null;
    loading: boolean;
    error: string | null;
    activeFilters: NWCFilterState;
}

@inject('NostrWalletConnectStore')
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

            const filteredActivity = this.applyFilters(
                activity,
                this.state.activeFilters
            );

            this.setState({
                activity,
                filteredActivity,
                connectionName: name,
                loading: false
            });
        } catch (e: any) {
            this.setState({
                error: e.message || 'Failed to load activity',
                loading: false
            });
        }
    };

    applyFilters = (
        activities: ConnectionActivity[],
        filters: NWCFilterState
    ): ConnectionActivity[] => {
        const allFiltersActive = Object.values(filters).every(
            (v) => v === true
        );
        if (allFiltersActive) {
            return activities;
        }
        const noFiltersActive = Object.values(filters).every(
            (v) => v === false
        );
        if (noFiltersActive) {
            return [];
        }
        return activities.filter((item) => {
            const isSentType =
                item.type === 'pay_invoice' || item.type === 'pay_keysend';
            const isReceivedType = item.type === 'make_invoice';

            if (item.status === 'success') {
                if (isSentType && filters.sent) return true;
                if (isReceivedType && filters.received) return true;
                return false;
            }

            if (item.status === 'failed') {
                if (isSentType && filters.sent && filters.failed) return true;
                if (isReceivedType && filters.received && filters.failed)
                    return true;
                return false;
            }

            if (item.status === 'pending') {
                if (isSentType && filters.sent && filters.pending) return true;
                if (isReceivedType && filters.pending) return true;
                return false;
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

    getRightTitleTheme = (item: ConnectionActivity) => {
        if (item.status === 'success') {
            return item.type === 'make_invoice' ? 'success' : 'warning';
        }
        if (item.status === 'failed') return 'warning';
        if (item.status === 'pending') return 'highlight';
        return 'secondaryText';
    };

    navigateToFilter = () => {
        this.props.navigation.navigate('NWCConnectionActivityFilter', {
            activeFilters: this.state.activeFilters,
            onApply: this.handleFilterChange
        });
    };

    renderActivityListItem = ({ item }: { item: ConnectionActivity }) => {
        let title = '';
        let subtitle = '';
        let onPress = () => {};

        const { navigation, NostrWalletConnectStore } = this.props;

        switch (item.type) {
            case 'pay_invoice':
            case 'pay_keysend':
                onPress = () => {
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
                            ? Math.floor(
                                  new Date(item.lastprocessAt).getTime() / 1000
                              )
                            : undefined,
                        invoice: item.id
                    });
                    navigation.navigate('Payment', { payment });
                };
                title =
                    item.status === 'failed'
                        ? localeString('views.Payment.failedPayment')
                        : item.status === 'pending'
                        ? localeString('views.Payment.inTransitPayment')
                        : localeString('views.Activity.youSent');
                break;
            case 'make_invoice':
                onPress = async () => {
                    try {
                        const invoice =
                            await NostrWalletConnectStore.getDecodedInvoice(
                                item.id
                            );
                        navigation.navigate('Invoice', { invoice });
                    } catch (e) {
                        console.log('Navigation failed:', e);
                    }
                };
                title =
                    item.status === 'success'
                        ? localeString('views.Activity.youReceived')
                        : localeString('views.Activity.requestedPayment');
                break;
        }

        const source =
            item.payment_source === 'lightning'
                ? localeString('general.lightning')
                : localeString('general.cashu');

        const typeText =
            item.type === 'pay_invoice'
                ? localeString('views.Payment.title')
                : item.type === 'make_invoice'
                ? localeString('views.Invoice.title')
                : 'Keysend';

        subtitle = `${source} • ${typeText}`;

        const time = item.lastprocessAt
            ? new Date(item.lastprocessAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
              })
            : '';

        return (
            <ListItem
                onPress={onPress}
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
                            color={this.getRightTitleTheme(item)}
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
                            {time}
                        </ListItem.Subtitle>
                    </View>

                    {item.status && (
                        <View style={styles.row}>
                            <ListItem.Subtitle
                                style={{
                                    ...styles.leftCellSecondary,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Channel.status')}
                            </ListItem.Subtitle>
                            <ListItem.Subtitle
                                style={{
                                    ...styles.rightCellSecondary,
                                    color:
                                        item.status === 'success'
                                            ? themeColor('success')
                                            : item.status === 'failed'
                                            ? themeColor('warning')
                                            : themeColor('highlight')
                                }}
                            >
                                {item.status.charAt(0).toUpperCase() +
                                    item.status.slice(1)}
                            </ListItem.Subtitle>
                        </View>
                    )}

                    {item.error && (
                        <View style={styles.row}>
                            <ListItem.Subtitle
                                style={{
                                    ...styles.leftCellSecondary,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('general.error')}
                            </ListItem.Subtitle>
                            <ListItem.Subtitle
                                style={{
                                    ...styles.rightCellSecondary,
                                    color: themeColor('warning')
                                }}
                                ellipsizeMode="tail"
                            >
                                {PrivacyUtils.sensitiveValue({
                                    input: item.error,
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
            style={{ height: 0.4, backgroundColor: themeColor('separator') }}
        />
    );

    isDefaultFilter = (filters: NWCFilterState): boolean => {
        return (
            filters.sent === NWC_DEFAULT_FILTERS.sent &&
            filters.received === NWC_DEFAULT_FILTERS.received &&
            filters.failed === NWC_DEFAULT_FILTERS.failed &&
            filters.pending === NWC_DEFAULT_FILTERS.pending
        );
    };

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
