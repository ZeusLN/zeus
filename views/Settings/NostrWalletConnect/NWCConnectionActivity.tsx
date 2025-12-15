import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';
import React from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
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

interface ConnectionActivityProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'NWCConnectionActivity', { connectionId: string }>;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

interface ConnectionActivityState {
    activity: ConnectionActivity[];
    connectionName: string | null;
    loading: boolean;
    error: string | null;
}

interface ActivityListItemProps {
    item: ConnectionActivity;
    getRightTitleTheme: (
        item: ConnectionActivity
    ) =>
        | 'text'
        | 'highlight'
        | 'secondaryText'
        | 'success'
        | 'warning'
        | 'warningReserve';
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
            loading: false,
            error: null,
            activity: [],
            connectionName: null
        };
    }

    async componentDidMount() {
        const { route } = this.props;
        const connectionId = route.params.connectionId;
        if (!connectionId) {
            this.setState({ error: 'Connection id not found in props' });
            return;
        }
        this.getConnectionActivities(connectionId);
    }

    async getConnectionActivities(connectionId: string) {
        try {
            this.setState({ loading: true });
            const { NostrWalletConnectStore } = this.props;
            const { name, activity } =
                await NostrWalletConnectStore.getActivities(connectionId);
            this.setState({
                loading: false,
                activity,
                connectionName: name
            });
        } catch (error) {
            this.setState({
                error: (error as Error).message,
                loading: false
            });
        }
    }
    renderActivityListItem = ({
        item,
        getRightTitleTheme
    }: ActivityListItemProps) => {
        let displayName = '';
        let subTitle = '';
        let handleNaviagtion: () => void = () => {};
        const { navigation, NostrWalletConnectStore } = this.props;
        switch (item.type) {
            case 'pay_invoice':
                handleNaviagtion = () => {
                    const payment = new Payment({
                        payment_request: item.id,
                        payment_hash: item.paymentHash,
                        payment_preimage: item.preimage,
                        value_sat: item.satAmount,
                        amount: item.satAmount,
                        // fees_paid: item.fees_paid, // Not available in ConnectionActivity yet
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
                    navigation.navigate('Payment', {
                        payment
                    });
                };

                displayName =
                    item.status === 'failed'
                        ? localeString('views.Payment.failedPayment')
                        : item.status === 'pending'
                        ? localeString('views.Payment.inTransitPayment')
                        : localeString('views.Activity.youSent');
                break;
            case 'make_invoice':
                handleNaviagtion = async () => {
                    try {
                        const invoice =
                            await NostrWalletConnectStore.getDecodedInvoice(
                                item.id
                            );
                        navigation.navigate('Invoice', {
                            invoice
                        });
                    } catch (e) {
                        console.log('failed to navigate', e);
                    }
                };
                displayName =
                    item.status === 'success'
                        ? localeString('views.Activity.youReceived')
                        : localeString('views.Activity.requestedPayment');
                break;
            case 'pay_keysend':
                displayName =
                    item.status === 'failed'
                        ? localeString('views.Payment.failedPayment')
                        : item.status === 'pending'
                        ? localeString('views.Payment.inTransitPayment')
                        : localeString('views.Activity.youSent');
                break;
        }
        const paymentSourceText =
            item.payment_source === 'lightning'
                ? localeString('general.lightning')
                : localeString('general.cashu');

        const activityTypeText =
            item.type === 'pay_invoice'
                ? localeString('views.Payment.title')
                : item.type === 'make_invoice'
                ? localeString('views.Invoice.title')
                : 'Keysend';

        subTitle = `${paymentSourceText} • ${activityTypeText}`;
        // Format timestamp
        const displayTime = item.lastprocessAt
            ? new Date(item.lastprocessAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
              })
            : '';
        return (
            <ListItem
                onPress={() => handleNaviagtion()}
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: 'transparent'
                }}
            >
                <ListItem.Content>
                    <View style={styles.row}>
                        <ListItem.Title
                            style={{
                                ...styles.leftCell,
                                fontWeight: '600',
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {displayName}
                        </ListItem.Title>

                        <View
                            style={{
                                ...styles.rightCell,
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                columnGap: 5,
                                rowGap: -5,
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Amount
                                sats={item.satAmount}
                                sensitive
                                color={getRightTitleTheme(item)}
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <ListItem.Subtitle
                            right
                            style={{
                                ...styles.leftCell,
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {subTitle}
                        </ListItem.Subtitle>

                        <ListItem.Subtitle
                            style={{
                                ...styles.rightCell,
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {displayTime}
                        </ListItem.Subtitle>
                    </View>

                    {item.status && (
                        <View style={styles.row}>
                            <ListItem.Subtitle
                                style={{
                                    ...styles.leftCell,
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString('views.Channel.status')}
                            </ListItem.Subtitle>

                            <ListItem.Subtitle
                                style={{
                                    ...styles.rightCell,
                                    color:
                                        item.status === 'success'
                                            ? themeColor('success')
                                            : item.status === 'failed'
                                            ? themeColor('warning')
                                            : themeColor('highlight'),
                                    fontFamily: 'Lato-Regular'
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
                                    ...styles.leftCell,
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    flexShrink: 0,
                                    flex: 0,
                                    width: 'auto',
                                    overflow: 'hidden'
                                }}
                                numberOfLines={1}
                            >
                                {localeString('general.error')}
                            </ListItem.Subtitle>

                            <ListItem.Subtitle
                                style={{
                                    ...styles.rightCell,
                                    color: themeColor('warning'),
                                    fontFamily: 'Lato-Regular',
                                    flexWrap: 'wrap',
                                    flexShrink: 1
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
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    getRightTitleTheme = (item: ConnectionActivity) => {
        if (item.status === 'success') {
            return item.type === 'make_invoice' ? 'success' : 'warning';
        }
        if (item.status === 'failed') {
            return 'warning';
        }
        if (item.status === 'pending') {
            return 'highlight';
        }
        return 'secondaryText';
    };

    handleRefresh = () => {
        const { route } = this.props;
        const connectionId = route.params.connectionId;
        if (connectionId) {
            this.getConnectionActivities(connectionId);
        }
    };

    render() {
        const { loading, activity, error, connectionName } = this.state;
        const { navigation } = this.props;

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
                    navigation={navigation}
                />

                {loading && activity.length === 0 ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : error ? (
                    <Button
                        title={error}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('warning')
                        }}
                        onPress={this.handleRefresh}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('warning'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    />
                ) : activity?.length > 0 ? (
                    <FlatList
                        data={activity.slice().reverse()}
                        renderItem={({ item }: { item: ConnectionActivity }) =>
                            this.renderActivityListItem({
                                item,
                                getRightTitleTheme: this.getRightTitleTheme
                            })
                        }
                        keyExtractor={(item, index) =>
                            `${item.type}-${item.lastprocessAt}-${index}`
                        }
                        ItemSeparatorComponent={this.renderSeparator}
                        refreshing={loading}
                        onRefresh={this.handleRefresh}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={10}
                    />
                ) : (
                    <Button
                        title={localeString('views.Activity.noActivity')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={this.handleRefresh}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    />
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        columnGap: 10
    },
    leftCell: {
        flexGrow: 0,
        flexShrink: 1
    },
    rightCell: {
        flexGrow: 0,
        flexShrink: 1,
        textAlign: 'right'
    }
});
