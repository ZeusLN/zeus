import * as React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import Transaction from './../../models/Transaction';
import DateTimeUtils from './../../utils/DateTimeUtils';
import { inject, observer } from 'mobx-react';

import TransactionsStore from './../../stores/TransactionsStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

const AddBalance = require('./../../images/onchain-green.png');
const RemoveBalance = require('./../../images/onchain-red.png');
const AddBalancePending = require('./../../images/onchain-green-pending.png');
const RemoveBalancePending = require('./../../images/onchain-red-pending.png');

const AddBalanceDark = require('./../../images/onchain-green-dark.png');
const RemoveBalanceDark = require('./../../images/onchain-red-dark.png');
const AddBalancePendingDark = require('./../../images/onchain-green-pending-dark.png');
const RemoveBalancePendingDark = require('./../../images/onchain-red-pending-dark.png');

interface TransactionsProps {
    navigation: any;
    refresh: any;
    transactions: Array<Transaction>;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class Transactions extends React.Component<TransactionsProps> {
    renderSeparator = () => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkSeparator
                        : styles.lightSeparator
                }
            />
        );
    };

    viewTransaction = (transaction: Transaction) => {
        const { navigation } = this.props;
        navigation.navigate('Transaction', { transaction: transaction });
    };

    render() {
        const {
            refresh,
            transactions,
            TransactionsStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { loading } = TransactionsStore;
        const { getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const BalanceImage = (item: Transaction) => {
            const { getAmount, isConfirmed } = item;

            if (isConfirmed) {
                if (getAmount > 0) {
                    return theme === 'dark' ? AddBalanceDark : AddBalance;
                }

                return theme === 'dark' ? RemoveBalanceDark : RemoveBalance;
            }

            if (getAmount > 0) {
                return theme === 'dark'
                    ? AddBalancePendingDark
                    : AddBalancePending;
            }

            return theme === 'dark'
                ? RemoveBalancePendingDark
                : RemoveBalancePending;
        };

        const Balance = (item: Transaction) => (
            <Avatar source={BalanceImage(item)} />
        );

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                {(!!transactions && transactions.length > 0) || loading ? (
                    <FlatList
                        data={transactions}
                        renderItem={({ item }: any) => {
                            let subtitle =
                                item.getBlockHeight || 'Awaiting Confirmation';
                            if (item.time_stamp) {
                                subtitle.concat(
                                    ` | ${DateTimeUtils.listFormattedDate(
                                        item.time_stamp
                                    )}`
                                );
                            }
                            return (
                                <ListItem
                                    title={units && getAmount(item.getAmount)}
                                    subtitle={subtitle}
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor:
                                            theme === 'dark' ? 'black' : 'white'
                                    }}
                                    leftElement={Balance(item)}
                                    onPress={() => this.viewTransaction(item)}
                                    titleStyle={{
                                        color:
                                            theme === 'dark' ? 'white' : 'black'
                                    }}
                                    subtitleStyle={{
                                        color:
                                            theme === 'dark'
                                                ? 'gray'
                                                : '#8a8999'
                                    }}
                                />
                            );
                        }}
                        keyExtractor={(item, index) => `${item.tx}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => refresh()}
                    />
                ) : (
                    <Button
                        title="No Transactions"
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                        onPress={() => refresh()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    />
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    lightSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: '#CED0CE',
        marginLeft: '14%'
    },
    darkSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: 'darkgray',
        marginLeft: '14%'
    }
});
