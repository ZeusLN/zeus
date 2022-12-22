import * as React from 'react';
import {
    FlatList,
    NativeModules,
    NativeEventEmitter,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Amount from '../../components/Amount';
import LoadingIndicator from '../../components/LoadingIndicator';

import DateTimeUtils from './../../utils/DateTimeUtils';
import { localeString } from './../../utils/LocaleUtils';
import RESTUtils from './../../utils/RESTUtils';
import { themeColor } from './../../utils/ThemeUtils';

import ActivityStore from './../../stores/ActivityStore';
import SettingsStore from './../../stores/SettingsStore';

import Filter from './../../assets/images/SVG/Filter On.svg';

interface ActivityProps {
    navigation: any;
    ActivityStore: ActivityStore;
    SettingsStore: SettingsStore;
}

@inject('ActivityStore', 'SettingsStore')
@observer
export default class Activity extends React.Component<ActivityProps, {}> {
    transactionListener: any;
    invoicesListener: any;

    async UNSAFE_componentWillMount() {
        const { ActivityStore } = this.props;
        const { getActivityAndFilter, resetFilters } = ActivityStore;
        await resetFilters();
        getActivityAndFilter();
        if (RESTUtils.isLNDBased()) {
            this.subscribeEvents();
        }
    }

    UNSAFE_componentWillReceiveProps = (newProps: any) => {
        const { ActivityStore } = newProps;
        const { getActivityAndFilter } = ActivityStore;
        getActivityAndFilter();
    };

    componentWillUnmount() {
        if (this.transactionListener && this.transactionListener.stop)
            this.transactionListener.stop();
        if (this.invoicesListener && this.invoicesListener.stop)
            this.invoicesListener.stop();
    }

    subscribeEvents = () => {
        const { ActivityStore, SettingsStore } = this.props;
        const { implementation } = SettingsStore;

        if (implementation === 'lightning-node-connect') {
            const { LncModule } = NativeModules;
            const eventEmitter = new NativeEventEmitter(LncModule);
            this.transactionListener = eventEmitter.addListener(
                RESTUtils.subscribeTransactions(),
                () => {
                    ActivityStore.updateTransactions();
                }
            );

            this.invoicesListener = eventEmitter.addListener(
                RESTUtils.subscribeInvoices(),
                () => {
                    ActivityStore.updateInvoices();
                }
            );
        }

        if (implementation === 'lnd') {
            RESTUtils.subscribeTransactions().then(() =>
                ActivityStore.updateTransactions()
            );

            RESTUtils.subscribeInvoices().then(() =>
                ActivityStore.updateInvoices()
            );
        }
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    // TODO this feels like an odd place to do all this deciding
    // TODO on-chain has "-" sign but lightning doesn't?
    getRightTitleTheme = (item: any) => {
        if (item.getAmount == 0) return 'secondaryText';

        if (item.model === localeString('general.transaction')) {
            if (item.getAmount.toString().includes('-')) return 'warning';
            return 'success';
        }

        if (item.model === localeString('views.Payment.title'))
            return 'warning';

        if (item.model === localeString('views.Invoice.title')) {
            if (item.isExpired && !item.isPaid) {
                return 'text';
            } else if (!item.isPaid) {
                return 'highlight';
            }
        }

        if (item.isPaid) return 'success';

        return 'secondaryText';
    };

    render() {
        const { navigation, ActivityStore } = this.props;
        const { loading, filteredActivity, getActivityAndFilter } =
            ActivityStore;

        const CloseButton = () => (
            <Icon
                name="close"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        const FilterButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('ActivityFilter')}
            >
                <Filter fill={themeColor('text')} />
            </TouchableOpacity>
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text: localeString('general.activity'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={<FilterButton />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : !!filteredActivity && filteredActivity.length > 0 ? (
                    <FlatList
                        data={filteredActivity}
                        renderItem={({ item }: { item: any }) => {
                            let displayName = item.model;
                            let subTitle = item.model;
                            if (
                                item.model ===
                                localeString('views.Invoice.title')
                            ) {
                                displayName = item.isPaid
                                    ? localeString('views.Activity.youReceived')
                                    : localeString(
                                          'views.Activity.requestedPayment'
                                      );
                                subTitle = item.isPaid
                                    ? localeString('general.lightning')
                                    : `${localeString(
                                          'views.PaymentRequest.title'
                                      )}: ${
                                          item.isExpired
                                              ? localeString(
                                                    'views.Activity.expired'
                                                )
                                              : item.expirationDate
                                      }`;
                            }

                            if (
                                item.model ===
                                localeString('views.Payment.title')
                            ) {
                                displayName = localeString(
                                    'views.Activity.youSent'
                                );
                                subTitle = localeString('general.lightning');
                            }

                            if (
                                item.model ===
                                localeString('general.transaction')
                            ) {
                                displayName =
                                    item.getAmount == 0
                                        ? localeString(
                                              'views.Activity.channelOperation'
                                          )
                                        : !item.getAmount
                                              .toString()
                                              .includes('-')
                                        ? localeString(
                                              'views.Activity.youReceived'
                                          )
                                        : localeString(
                                              'views.Activity.youSent'
                                          );
                                subTitle =
                                    item.num_confirmations == 0
                                        ? `${localeString(
                                              'general.onchain'
                                          )}: ${localeString(
                                              'general.unconfirmed'
                                          )}`
                                        : localeString('general.onchain');
                            }

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background')
                                        }}
                                        onPress={() => {
                                            if (
                                                item.model ===
                                                localeString(
                                                    'views.Invoice.title'
                                                )
                                            ) {
                                                navigation.navigate('Invoice', {
                                                    invoice: item
                                                });
                                            }

                                            if (
                                                item.model ===
                                                localeString(
                                                    'general.transaction'
                                                )
                                            ) {
                                                navigation.navigate(
                                                    'Transaction',
                                                    {
                                                        transaction: item
                                                    }
                                                );
                                            }

                                            if (
                                                item.model ===
                                                localeString(
                                                    'views.Payment.title'
                                                )
                                            ) {
                                                navigation.navigate('Payment', {
                                                    payment: item
                                                });
                                            }
                                        }}
                                    >
                                        <ListItem.Content>
                                            <ListItem.Title
                                                right
                                                style={{
                                                    fontWeight: '600',
                                                    color: themeColor('text'),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {displayName}
                                            </ListItem.Title>
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {subTitle}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                        <ListItem.Content right>
                                            <Amount
                                                sats={item.getAmount}
                                                sensitive
                                                color={this.getRightTitleTheme(
                                                    item
                                                )}
                                            />
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {item.getTimestamp === 0
                                                    ? item.getBlockHeight
                                                    : DateTimeUtils.listFormattedDateShort(
                                                          item.getTimestamp
                                                      )}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                    </ListItem>
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) => `${item.model}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => getActivityAndFilter()}
                    />
                ) : (
                    <Button
                        title={localeString('views.Activity.noActivity')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => getActivityAndFilter()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }}
                    />
                )}
            </View>
        );
    }
}
