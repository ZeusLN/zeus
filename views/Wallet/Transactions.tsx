import * as React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Button, List, ListItem } from 'react-native-elements';
import Transaction from './../../models/Transaction';
import { inject, observer } from 'mobx-react';

import TransactionsStore from './../../stores/TransactionsStore';
import UnitsStore from './../../stores/UnitsStore';

const AddBalance = require('./../../images/onchain-green.png');
const RemoveBalance = require('./../../images/onchain-red.png');
const AddBalancePending = require('./../../images/onchain-green-pending.png');
const RemoveBalancePending = require('./../../images/onchain-red-pending.png');

interface TransactionsProps {
    navigation: any;
    refresh: any;
    transactions: Array<Transaction>;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
}

@inject('UnitsStore')
@observer
export default class Transactions extends React.Component<TransactionsProps> {
    renderSeparator = () => <View style={styles.separator} />;

    viewTransaction = (transaction: Transaction) => {
          const { navigation } = this.props;
          navigation.navigate('Transaction', { transaction: transaction });
    }

    render() {
        const { refresh, transactions, TransactionsStore, UnitsStore } = this.props;
        const { loading } = TransactionsStore;
        const { getAmount, units } = UnitsStore;

        const Balance = (item: Transaction) => {
            const { amount, num_confirmations } = item;
            if (num_confirmations && num_confirmations > 0) {
                if (amount > 0) {
                    return AddBalance;
                }

                return RemoveBalance;
            }

            if (amount > 0) {
                return AddBalancePending;
            }

            return RemoveBalancePending;
        }

        return (
            <View>
                {(!!transactions && transactions.length > 0) || loading ? <List>
                        <FlatList
                            data={transactions}
                            renderItem={({ item }: any) => {
                                const date = new Date(item.time_stamp * 1000);
                                const subtitle = item.block_height ? `${item.block_height} | ${date}` : date.toString();
                                return (
                                    <ListItem
                                        key={item.tx_hash}
                                        title={units && getAmount(item.amount)}
                                        subtitle={subtitle}
                                        containerStyle={{ borderBottomWidth: 0 }}
                                        avatar={Balance(item)}
                                        onPress={() => this.viewTransaction(item)}
                                    />
                                );
                            }}
                            keyExtractor={item => item.tx_hash}
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                            refreshing={loading}
                            onRefresh={() => refresh()}
                        />
                </List> : <Button
                    title="No Transactions"
                    icon={{
                        name: "error-outline",
                        size: 25,
                        color: "black"
                    }}
                    backgroundColor="transparent"
                    color="black"
                    onPress={() => refresh()}
                    borderRadius={30}
                />}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    separator: {
        height: 1,
        width: "86%",
        backgroundColor: "#CED0CE",
        marginLeft: "14%"
    }
});