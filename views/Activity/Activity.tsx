import * as React from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import DateTimeUtils from './../../utils/DateTimeUtils';
import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import ActivityStore from './../../stores/ActivityStore';
import UnitsStore from './../../stores/UnitsStore';

import Filter from './../../images/SVG/Filter On.svg';

interface ActivityProps {
    navigation: any;
    ActivityStore: ActivityStore;
    UnitsStore: UnitsStore;
}

@inject('ActivityStore', 'UnitsStore')
@observer
export default class Activity extends React.Component<ActivityProps, {}> {
    async UNSAFE_componentWillMount() {
        const { ActivityStore } = this.props;
        const { getActivityAndFilter, resetFilters } = ActivityStore;
        await resetFilters();
        getActivityAndFilter();
    }

    renderSeparator = () => <View style={styles.separator} />;

    getRightTitleStyle = (item: any) => {
        if (item.getAmount == 0) return 'gray';

        if (item.model === localeString('general.transaction')) {
            if (item.getAmount.includes('-')) return 'red';
            return 'green';
        }

        if (item.model === localeString('views.Payment.title')) return 'red';

        if (item.isPaid) return 'green';

        return themeColor('secondaryText');
    };

    render() {
        const { navigation, ActivityStore, UnitsStore } = this.props;
        const { getAmount } = UnitsStore;
        const {
            loading,
            filteredActivity,
            getActivityAndFilter
        } = ActivityStore;

        const CloseButton = () => (
            <Icon
                name="close"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        const FilterButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('ActivityFilter')}
            >
                <Filter />
            </TouchableOpacity>
        );

        return (
            <View style={styles.view}>
                <Header
                    leftComponent={<CloseButton />}
                    centerComponent={{
                        text: localeString('general.activity'),
                        style: { color: '#fff' }
                    }}
                    rightComponent={<FilterButton />}
                    backgroundColor="#1f2328"
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <ActivityIndicator size="large" color="#0000ff" />
                    </View>
                ) : !!filteredActivity && filteredActivity.length > 0 ? (
                    <FlatList
                        data={filteredActivity}
                        renderItem={({ item }: { item: any }) => {
                            let displayName = item.model;
                            let subTitle = item.model;
                            let rightTitle: any = ' ';
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
                                rightTitle = PrivacyUtils.sensitiveValue(
                                    getAmount(item.getAmount),
                                    null,
                                    true
                                );
                            }

                            if (
                                item.model ===
                                localeString('views.Payment.title')
                            ) {
                                displayName = localeString(
                                    'views.Activity.youSent'
                                );
                                subTitle = localeString('general.lightning');
                                rightTitle = PrivacyUtils.sensitiveValue(
                                    getAmount(item.getAmount),
                                    null,
                                    true
                                );
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
                                        : !item.getAmount.includes('-')
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
                                rightTitle =
                                    item.getAmount == 0
                                        ? '-'
                                        : PrivacyUtils.sensitiveValue(
                                              getAmount(item.getAmount),
                                              null,
                                              true
                                          );
                            }

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: themeColor(
                                                'background'
                                            )
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
                                                    color: themeColor('text')
                                                }}
                                            >
                                                {displayName}
                                            </ListItem.Title>
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {subTitle}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                        <ListItem.Content right>
                                            <ListItem.Title
                                                right
                                                style={{
                                                    fontWeight: '600',
                                                    color: this.getRightTitleStyle(
                                                        item
                                                    )
                                                }}
                                            >
                                                {rightTitle}
                                            </ListItem.Title>
                                            <ListItem.Subtitle
                                                right
                                                style={
                                                    styles.rightSubtitleStyle
                                                }
                                            >
                                                {DateTimeUtils.listFormattedDateShort(
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
                            color: themeColor('text')
                        }}
                    />
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    view: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    separator: {
        height: 0.4,
        backgroundColor: themeColor('separator')
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    },
    rightSubtitleStyle: {
        color: themeColor('secondaryText')
    }
});
