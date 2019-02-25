import * as React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Button, List, ListItem } from 'react-native-elements';
import Invoice from './../../models/Invoice';
import { inject, observer } from 'mobx-react';

import InvoicesStore from './../../stores/InvoicesStore';
import UnitsStore from './../../stores/UnitsStore';

const AddBalance = require('./../../images/lightning-green.png');
const AddBalancePending = require('./../../images/lightning-green-pending.png');

interface InvoicesProps {
    invoices: Array<Invoice>;
    navigation: any;
    refresh: any;
    InvoicesStore: InvoicesStore;
    UnitsStore: UnitsStore;
}

@inject('UnitsStore')
@observer
export default class InvoicesView extends React.Component<InvoicesProps, {}> {
    renderSeparator = () => <View style={styles.separator} />;

    render() {
        const { invoices, navigation, refresh, InvoicesStore, UnitsStore } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading } = InvoicesStore;

        return (
            <View style={{ flex: 1 }}>
                {(!!invoices && invoices.length > 0) || loading  ? <List>
                        <FlatList
                            data={invoices}
                            renderItem={({ item }) => {
                                const settleDate = new Date(Number(item.settle_date) * 1000).toString();
                                const creationDate = new Date(Number(item.creation_date) * 1000).toString();
                                const { settled } = item;
                                return (
                                    <ListItem
                                        key={item.r_hash}
                                        title={item.memo || "No memo"}
                                        subtitle={`${settled ? 'Paid' : 'Unpaid'}: ${units && getAmount(item.value)} | ${settled ? settleDate : creationDate}`}
                                        containerStyle={{ borderBottomWidth: 0 }}
                                        avatar={item.settled ? AddBalance : AddBalancePending}
                                        onPress={() => navigation.navigate('Invoice', { invoice: item })}
                                    />
                                );
                            }}
                            keyExtractor={item => item.r_hash}
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                            refreshing={loading}
                            onRefresh={() => refresh()}
                        />
                </List> : <Button
                    title="No Invoices"
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